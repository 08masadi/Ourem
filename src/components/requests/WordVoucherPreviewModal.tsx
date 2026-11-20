'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ReimbursementRequest } from '@/types/database';
import { Download, Printer, X, Loader2, FileText } from 'lucide-react';
import {
  generateReimbursementDocx,
  downloadDocxFile,
  formatCurrencyNumber,
  formatDateSlash,
  formatRfNumber,
  DocxApprover,
} from '@/lib/wordVoucherGenerator';
import {
  parseAccountBlocksFromDescription,
  normalizeAccount,
  getCleanDescription,
  extractMetadataFromDescription,
} from '@/lib/formatters';
import { printWordDocument } from '@/lib/printUtils';

interface WordVoucherPreviewModalProps {
  request: ReimbursementRequest;
  sameDateRequests?: ReimbursementRequest[];
  financeApprover?: DocxApprover;
  directorApprover?: DocxApprover;
  onClose: () => void;
}

export default function WordVoucherPreviewModal({
  request,
  sameDateRequests,
  financeApprover,
  directorApprover,
  onClose,
}: WordVoucherPreviewModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    document.body.classList.add('has-word-modal-open');
    return () => {
      document.body.classList.remove('has-word-modal-open');
    };
  }, []);

  const targetRequests =
    sameDateRequests && sameDateRequests.length > 0 ? sameDateRequests : [request];
  const determinedType = request.reimbursement_type || 'Petty Cash';

  // 1. Gather all itemized entries
  const itemizedList: Array<{
    itemNum: number;
    date: string;
    description: string;
    receipt: string;
    cost: number;
  }> = [];

  let runningItem = 1;
  targetRequests.forEach((reqItem) => {
    const blocks = parseAccountBlocksFromDescription(
      reqItem.description,
      reqItem.account || reqItem.category,
      Number(reqItem.amount) || 0,
      reqItem.customer,
      reqItem.receipt_url
    );

    blocks.forEach((block) => {
      const blockAcc = normalizeAccount(
        block.account || reqItem.account || reqItem.category,
        determinedType
      );
      const blockAmount = Number(block.amount) || 0;
      const entries =
        block.entries && block.entries.length > 0
          ? block.entries
          : [{ customer: reqItem.customer || '', description: reqItem.title }];

      entries.forEach((entry, eIdx) => {
        const cleanDesc = getCleanDescription(entry.description);
        const itemDesc =
          cleanDesc && cleanDesc.trim()
            ? cleanDesc.trim()
            : reqItem.title && !reqItem.title.startsWith('Form Lembur')
            ? reqItem.title.trim()
            : '';

        itemizedList.push({
          itemNum: runningItem++,
          date: formatDateSlash(entry.receipt_date || reqItem.request_date),
          description: itemDesc,
          receipt: 'Attached',
          cost: eIdx === 0 ? blockAmount : 0,
        });
      });
    });
  });

  const totalAmount = targetRequests.reduce(
    (sum, r) => sum + (Number(r.amount) || 0),
    0
  );

  // 2. Collect all unique receipt photos
  const receiptUrlSet = new Set<string>();
  targetRequests.forEach((r) => {
    if (r.receipt_url) receiptUrlSet.add(r.receipt_url);
    const blocks = parseAccountBlocksFromDescription(
      r.description,
      r.account || r.category,
      Number(r.amount) || 0,
      r.customer,
      r.receipt_url
    );
    blocks.forEach((b) => {
      if (b.receipt_url) receiptUrlSet.add(b.receipt_url);
    });
  });
  const allReceiptUrls = Array.from(receiptUrlSet).filter(Boolean);

  const meta = extractMetadataFromDescription(request.description);

  // Requester details: Based on employee profile / metadata (not role/jabatan)
  const rawRequesterName =
    request.profiles?.full_name ||
    (request as any).nama_karyawan ||
    meta.full_name ||
    (request.profiles?.email ? request.profiles.email.split('@')[0] : 'Employee');

  const rawRequesterEmail =
    request.profiles?.email ||
    meta.email ||
    '';

  const nameLower = (rawRequesterName || '').toLowerCase();
  const emailLower = (rawRequesterEmail || '').toLowerCase();

  let directoryPhone = '';
  let directoryId = '';
  if (nameLower.includes('miskadi') || emailLower.includes('miskadi')) {
    directoryPhone = '085710002923';
    directoryId = 'CSK-007';
  } else if (nameLower.includes('bryan') || emailLower.includes('bryan')) {
    directoryPhone = '0882 3991 9129';
    directoryId = 'CSK-003';
  } else if (nameLower.includes('staff') || emailLower.includes('karyawan')) {
    directoryPhone = '0882 3991 9129';
    directoryId = 'CSK-002';
  }

  let localPhone = '';
  let localId = '';
  if (typeof window !== 'undefined') {
    localPhone =
      (request.user_id ? localStorage.getItem(`ourem_phone_${request.user_id}`) : null) ||
      localStorage.getItem('ourem_user_phone') ||
      '';
    localId =
      (request.user_id ? localStorage.getItem(`ourem_employee_id_${request.user_id}`) : null) ||
      localStorage.getItem('ourem_user_employee_id') ||
      '';
  }

  const requesterName = rawRequesterName;

  const requesterPhone =
    request.profiles?.phone ||
    (request.profiles as any)?.phone ||
    meta.phone ||
    (nameLower.includes('miskadi') ? '085710002923' : '') ||
    localPhone ||
    directoryPhone ||
    '';

  const requesterEmail = rawRequesterEmail;

  let requesterId =
    request.profiles?.employee_id ||
    (request.profiles as any)?.employee_id ||
    meta.employee_id ||
    (nameLower.includes('miskadi') ? 'CSK-007' : '') ||
    localId ||
    directoryId ||
    `CSK-${(request.user_id || '001').slice(-3).toUpperCase()}`;

  if (requesterId.startsWith('CSK-4') && directoryId) {
    requesterId = directoryId;
  }

  const requesterJabatan =
    request.department ||
    request.profiles?.department ||
    meta.department ||
    'Staff OPS';

  const bankName =
    request.profiles?.bank_name ||
    meta.bank_name ||
    'BCA';

  const bankAccount =
    request.profiles?.bank_account_number ||
    meta.bank_account_number ||
    '';

  const bankHolder =
    request.profiles?.bank_account_holder ||
    meta.bank_account_holder ||
    requesterName;

  const memoText = bankName ? `Pembayaran ke Rekening ${bankName}` : 'Pembayaran ke Rekening BCA';
  const purposeText =
    request.title || getCleanDescription(request.description) || 'Reimburst Operasional';

  const requestDateFormatted = formatDateSlash(request.request_date);
  const rfNumberFormatted =
    request.rf_number || meta.rf_number || formatRfNumber(request.request_date, request.id);

  // Approver details
  const finName = financeApprover?.name || 'Dwi N';
  const dirName = directorApprover?.name || 'Adrian Nugroho';
  const isPaid = request.payment_status === 'Paid';
  const paymentDate = request.payment_action_at
    ? formatDateSlash(request.payment_action_at)
    : isPaid
    ? requestDateFormatted
    : '';

  // Min rows for itemized expenses table
  const minRows = 10;
  const totalItemCount = Math.max(minRows, itemizedList.length);

  // Pagination for receipts (6 per page)
  const receiptsPerPage = 6;
  const numReceiptPages =
    allReceiptUrls.length > 0 ? Math.ceil(allReceiptUrls.length / receiptsPerPage) : 0;

  const handlePrint = () => {
    printWordDocument(printRef.current, `Reimbursement-${rfNumberFormatted}`);
  };

  const handleDownloadDocx = async () => {
    try {
      setIsExporting(true);
      const blob = await generateReimbursementDocx({
        request,
        sameDateRequests,
        financeApprover,
        directorApprover,
      });
      const safeName = requesterName.replace(/\s+/g, '-');
      const safeDate = (request.request_date || '').replace(/\//g, '-');
      const fileName = `Reimbursement-${safeName}-${safeDate}.docx`;
      await downloadDocxFile(blob, fileName);
    } catch (err: any) {
      alert('Gagal membuat dokumen Word: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl my-4 flex flex-col max-h-[95vh]">
        {/* Top Control Bar (Hidden on print) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 shrink-0 print:hidden">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <span>Preview Form Reimbursement (Format Word & Cetak)</span>
            </h2>
            <p className="text-xs text-slate-400">
              Format resmi PT. Citra Sari Kencana & Ouffice.co.id &bull; Sesuai Template Dokumen Word
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="Cetak langsung dokumen"
            >
              <Printer className="w-4 h-4 text-orange-400" />
              <span className="hidden sm:inline">Cetak</span>
            </button>

            <button
              onClick={handleDownloadDocx}
              disabled={isExporting}
              type="button"
              className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              title="Unduh dokumen dalam format MS Word (.docx)"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Word (.docx)</span>
            </button>

            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          <div
            ref={printRef}
            className="printable-word-doc bg-white text-black p-6 sm:p-10 print:p-0 print:shadow-none print:rounded-none rounded-2xl shadow-lg mx-auto max-w-[210mm] text-[11pt] leading-normal font-sans"
            style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt' }}
          >
            {/* ================= PAGE 1 ================= */}
            <div
              className="word-preview-page-1 min-h-[297mm] print:min-h-0 print:h-auto flex flex-col justify-between"
              style={{
                pageBreakAfter: allReceiptUrls.length > 0 ? 'always' : 'auto',
                breakAfter: allReceiptUrls.length > 0 ? 'page' : 'auto',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
              }}
            >
              <div>
                {/* Header Title */}
                <h1 className="text-2xl font-black text-[#E65100] tracking-tight">
                  Reimbursement Form
                </h1>
                <p className="text-[11pt] font-bold text-gray-600 mb-4">
                  PT. CITRA SARI KENCANA (Ouffice.co.id)
                </p>

                {/* Top Section: Requester Table (Left) + Request Date & RF Number (Right) */}
                <div className="flex justify-between items-start gap-4 mb-4">
                  {/* Left: Requester Info */}
                  <table className="border-collapse text-[11pt] w-[58%]">
                    <tbody>
                      <tr>
                        <td className="py-1 pr-1 font-normal text-gray-700 whitespace-nowrap w-[110px]">
                          Requester Name
                        </td>
                        <td className="py-1 pr-2 font-normal text-gray-700 text-right w-[15px]">
                          :
                        </td>
                        <td className="py-1 px-2 border border-gray-400 font-bold bg-white">
                          {requesterName}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-1 font-normal text-gray-700 whitespace-nowrap">
                          Phone
                        </td>
                        <td className="py-1 pr-2 font-normal text-gray-700 text-right">
                          :
                        </td>
                        <td className="py-1 px-2 border border-gray-400 bg-white">
                          {requesterPhone}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-1 font-normal text-gray-700 whitespace-nowrap">
                          Email
                        </td>
                        <td className="py-1 pr-2 font-normal text-gray-700 text-right">
                          :
                        </td>
                        <td className="py-1 px-2 border border-gray-400 text-blue-600 underline bg-white">
                          {requesterEmail}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Right: Request Date & RF Number Box */}
                  <table className="border-collapse text-[11pt] w-[38%] text-center">
                    <tbody>
                      <tr>
                        <td className="bg-[#B95318] text-white font-bold py-1 px-2 border border-gray-400 text-[11pt]">
                          Request Date
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-2 border border-gray-400 font-semibold bg-white">
                          {requestDateFormatted}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-[#B95318] text-white font-bold py-1 px-2 border border-gray-400 text-[11pt]">
                          RF Number
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-2 border border-gray-400 font-mono font-bold bg-white">
                          {rfNumberFormatted}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Make Check Payable To */}
                <div className="mb-4">
                  <h2 className="text-[11pt] font-bold text-black mb-1.5">
                    Make Check Payable To
                  </h2>
                  <div className="flex justify-between items-start gap-4">
                    {/* Left: Name, ID, Jabatan, Memo */}
                    <table className="border-collapse text-[11pt] w-[58%]">
                      <tbody>
                        <tr>
                          <td className="py-1 pr-1 font-normal text-gray-700 whitespace-nowrap w-[90px]">
                            Name
                          </td>
                          <td className="py-1 pr-2 font-normal text-gray-700 text-right w-[15px]">
                            :
                          </td>
                          <td className="py-1 px-2 border border-gray-400 font-bold bg-white">
                            {requesterName}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1 pr-1 font-normal text-gray-700 whitespace-nowrap">
                            ID
                          </td>
                          <td className="py-1 pr-2 font-normal text-gray-700 text-right">
                            :
                          </td>
                          <td className="py-1 px-2 border border-gray-400 font-mono bg-white">
                            {requesterId}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1 pr-1 font-normal text-gray-700 whitespace-nowrap">
                            Jabatan
                          </td>
                          <td className="py-1 pr-2 font-normal text-gray-700 text-right">
                            :
                          </td>
                          <td className="py-1 px-2 border border-gray-400 bg-white">
                            {requesterJabatan}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1 pr-1 font-normal text-gray-700 whitespace-nowrap">
                            Memo
                          </td>
                          <td className="py-1 pr-2 font-normal text-gray-700 text-right">
                            :
                          </td>
                          <td className="py-1 px-2 border border-gray-400 bg-white">
                            {memoText}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Right: Bank Account Box */}
                    <div className="border border-gray-400 p-2.5 w-[38%] text-[11pt] bg-white space-y-1">
                      <div className="font-bold">BANK {bankName.toUpperCase()}</div>
                      <div className="font-bold">A/C : {bankAccount}</div>
                      <div className="font-bold">AN. : {bankHolder.toUpperCase()}</div>
                    </div>
                  </div>
                </div>

                {/* Describe Purpose */}
                <div className="mb-4">
                  <h2 className="text-[11pt] font-bold text-black mb-1.5">Describe Purpose</h2>
                  <div className="border border-gray-400 p-2 min-h-[30px] text-[11pt] bg-white">
                    {purposeText}
                  </div>
                </div>

                {/* Itemized Expenses */}
                <div className="mb-4">
                  <h2 className="text-[11pt] font-bold text-[#E65100] mb-1.5">
                    Itemized Expenses
                  </h2>
                  <table className="w-full border-collapse text-[11pt]">
                    <thead>
                      <tr className="bg-[#B95318] text-white font-bold text-center">
                        <th className="py-1 px-1.5 border border-gray-400 w-[6%]">ITEM</th>
                        <th className="py-1 px-1.5 border border-gray-400 w-[14%]">DATE</th>
                        <th className="py-1 px-2 border border-gray-400 w-[48%] text-left">
                          DESCRIPTION
                        </th>
                        <th className="py-1 px-1.5 border border-gray-400 w-[14%]">RECEIPT</th>
                        <th className="py-1 px-2 border border-gray-400 w-[18%] text-right">
                          COST
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: totalItemCount }).map((_, idx) => {
                        const item = itemizedList[idx];
                        return (
                          <tr key={idx} className="h-[22px]">
                            <td className="border border-gray-400 text-center py-0.5 px-1 font-semibold text-gray-700">
                              {idx + 1}
                            </td>
                            <td className="border border-gray-400 text-center py-0.5 px-1">
                              {item ? item.date : ''}
                            </td>
                            <td className="border border-gray-400 py-0.5 px-2 text-left">
                              {item ? item.description : ''}
                            </td>
                            <td className="border border-gray-400 text-center py-0.5 px-1">
                              {item ? item.receipt : ''}
                            </td>
                            <td className="border border-gray-400 text-right py-0.5 px-2 font-mono">
                              {item && item.cost > 0
                                ? formatCurrencyNumber(item.cost)
                                : ''}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total Row */}
                      <tr className="font-bold">
                        <td colSpan={3} className="text-right py-1 px-2 border-0">
                          TOTAL
                        </td>
                        <td className="text-center py-1 px-1.5 border border-gray-400 bg-[#F8CBAD]">
                          IDR
                        </td>
                        <td className="text-right py-1 px-2 border border-gray-400 bg-[#F8CBAD] font-mono">
                          {formatCurrencyNumber(totalAmount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="text-right text-[10px] italic text-gray-600 mt-1">
                    Don't forget to include receipts!
                  </div>
                </div>

                {/* Approval */}
                <div className="mb-2">
                  <h2 className="text-[11pt] font-bold text-black mb-1.5">Approval</h2>
                  <table className="w-full border-collapse text-[11pt]">
                    <tbody>
                      {/* Names & Position */}
                      <tr>
                        <td className="border border-gray-400 py-1.5 px-2 w-[60%]">
                          <div className="flex justify-between items-center">
                            <span>{finName}</span>
                            <span>{dirName}</span>
                          </div>
                        </td>
                        <td className="border border-gray-400 py-1.5 px-2 w-[40%]">
                          <div className="flex justify-between items-center">
                            <span>Finance</span>
                            <span>Direktur</span>
                          </div>
                        </td>
                      </tr>
                      {/* Sub-labels */}
                      <tr className="text-[9px] text-gray-500">
                        <td className="pt-0.5 pb-1 px-1">Approved By (Name)</td>
                        <td className="pt-0.5 pb-1 px-1">Position</td>
                      </tr>
                      {/* Signature & Date */}
                      <tr>
                        <td className="border border-gray-400 py-1 px-2 h-[45px] align-middle">
                          {/* Kotak tanda tangan kosong untuk tanda tangan basah / manual */}
                        </td>
                        <td className="border border-gray-400 py-1 px-2 h-[45px] align-middle font-mono">
                          {paymentDate}
                        </td>
                      </tr>
                      {/* Sub-labels */}
                      <tr className="text-[9px] text-gray-500">
                        <td className="pt-0.5 px-1">Signature</td>
                        <td className="pt-0.5 px-1">Date</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ================= PAGE 2+: RECEIPTS ================= */}
            {/* Dynamic: Only render the exact number of frames corresponding to uploaded photos */}
            {numReceiptPages > 0 &&
              Array.from({ length: numReceiptPages }).map((_, pIdx) => {
                const startIndex = pIdx * receiptsPerPage;
                const pagePhotos = allReceiptUrls.slice(
                  startIndex,
                  startIndex + receiptsPerPage
                );

                const topPhotos = pagePhotos.slice(0, 3);
                const botPhotos = pagePhotos.length > 3 ? pagePhotos.slice(3, 6) : [];

                return (
                  <div
                    key={pIdx}
                    className="word-receipts-page min-h-[297mm] print:min-h-0 print:h-auto pt-10 border-t border-dashed border-gray-300 mt-10 print:border-0 print:pt-0 print:mt-0"
                    style={{
                      pageBreakBefore: 'always',
                      breakBefore: 'page',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                    }}
                  >
                    <h2 className="text-2xl font-black text-[#E65100] tracking-tight mb-4">
                      {pIdx === 0 ? 'Receipts' : `Receipts (Hal. ${pIdx + 1})`}
                    </h2>

                    {/* 3-Column Grid */}
                    <div className="space-y-4">
                      {/* Top Row: Up to 3 frames */}
                      <div className="grid grid-cols-3 gap-4">
                        {topPhotos.map((url, idx) => (
                          <div
                            key={idx}
                            className="border-2 border-[#ED7D31] rounded-none p-1.5 h-[230px] flex items-center justify-center bg-white"
                          >
                            <img
                              src={url}
                              alt={`Receipt ${startIndex + idx + 1}`}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Bottom Row: Only if photos > 3 */}
                      {botPhotos.length > 0 && (
                        <div className="grid grid-cols-3 gap-4">
                          {botPhotos.map((url, idx) => (
                            <div
                              key={idx}
                              className="border-2 border-[#ED7D31] rounded-none p-1.5 h-[230px] flex items-center justify-center bg-white"
                            >
                              <img
                                src={url}
                                alt={`Receipt ${startIndex + 4 + idx}`}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
