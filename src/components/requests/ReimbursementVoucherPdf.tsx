'use client';

import React, { useRef, useState } from 'react';
import { ReimbursementType, ReimbursementVoucherPrintData } from '@/types/database';
import { Download, Printer, X, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { normalizeAccount } from '@/lib/formatters';

interface ReimbursementVoucherPdfProps {
  data: ReimbursementVoucherPrintData;
  onClose: () => void;
}

interface AccountGroup {
  key: string;
  account: string;
  totalAmount: number;
  items: Array<{
    customer: string;
    description: string;
    amount: number;
  }>;
}

export default function ReimbursementVoucherPdf({
  data,
  onClose,
}: ReimbursementVoucherPdfProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const isPettyCash = data.type === 'Petty Cash';
  const titleText = isPettyCash ? 'PETTY CASH REIMBURSEMENT' : 'VOUCHER REIMBURSEMENT';

  // Group items by distinct block so identical accounts in different columns/cards remain separate
  const accountGroups: AccountGroup[] = [];
  data.items.forEach((item, idx) => {
    const acc = normalizeAccount(item.account, data.type);
    const key = (item as any).blockId || `item-${idx}-${acc}`;
    let group = accountGroups.find((g) => g.key === key);
    if (!group) {
      group = {
        key,
        account: acc,
        totalAmount: item.amount,
        items: [],
      };
      accountGroups.push(group);
    }
    group.items.push({
      customer: item.customer,
      description: item.description,
      amount: item.amount,
    });
  });

  // Calculate table empty filler rows count (row height is 15pt)
  const totalItemRows = data.items.length;
  const minRows = 10;
  const emptyRowsCount = Math.max(0, minRows - totalItemRows);
  const emptyRows = Array.from({ length: emptyRowsCount });

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsExporting(true);

    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const safeDate = data.date.replace(/\//g, '-');
      const fileName = `${data.type.replace(/\s+/g, '-')}-${data.requestedBy}-${safeDate}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Gagal export PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl my-4 flex flex-col max-h-[95vh]">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              Preview Cetak Voucher Reimbursement
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isExporting}
              type="button"
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Container */}
        <div className="overflow-auto flex-1 flex justify-center p-2 bg-slate-950/70 rounded-2xl border border-slate-800">
          {/* Printable Sheet formatted with Calibri 11pt */}
          <div
            ref={printRef}
            className="w-[1000px] min-h-[580px] bg-white text-slate-900 p-8 shadow-2xl relative flex flex-col justify-between print:shadow-none print:w-full print:m-0 print:p-4"
            style={{
              border: '2px solid #1E3A8A',
              fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
              fontSize: '11pt',
            }}
          >
            {/* Document Body */}
            <div
              className="relative z-10 flex flex-col justify-between h-full"
              style={{ fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif", fontSize: '11pt' }}
            >
              {/* Header: 3-Column Layout: Left (Ouffice), Center (Title), Right (CSK Logo) */}
              <div>
                <div className="grid grid-cols-12 items-center pb-3 border-b-2 border-[#EA580C]/40 gap-2">
                  {/* Left: Brand Logo - Official Ouffice.co.id */}
                  <div className="col-span-3 flex items-center justify-start">
                    <img
                      src="/ouffice-logo.png"
                      alt="Ouffice.co.id"
                      className="h-16 sm:h-20 w-auto object-contain"
                      crossOrigin="anonymous"
                    />
                  </div>

                  {/* Center: Title (Petty Cash Reimbursement) - Enlarged & Bold */}
                  <div className="col-span-6 text-center">
                    <h1
                      className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-wide uppercase"
                      style={{ color: '#EA580C', fontFamily: "'Calibri', sans-serif", fontWeight: 900 }}
                    >
                      {titleText}
                    </h1>
                  </div>

                  {/* Right: Brand Logo - Citra Sari Kencana (Sized to match Ouffice) */}
                  <div className="col-span-3 flex items-center justify-end">
                    <img
                      src="/csk-logo.png"
                      alt="Citra Sari Kencana"
                      className="h-16 sm:h-20 w-auto object-contain"
                      crossOrigin="anonymous"
                    />
                  </div>
                </div>

                {/* Info Boxes - Shorter width, enlarged padding & font like before */}
                <div
                  className="flex justify-between items-center mt-3 font-bold"
                  style={{ fontFamily: "'Calibri', sans-serif", fontSize: '11pt' }}
                >
                  {/* Left Side: REQUESTED BY & DEPARTMENT */}
                  <div className="flex items-center gap-3">
                    {/* REQUESTED BY */}
                    <div className="w-56 border border-[#EA580C] px-3 py-2 rounded-sm">
                      <div
                        className="text-[#EA580C] font-bold tracking-wider mb-0.5"
                        style={{ fontSize: '9pt', fontFamily: "'Calibri', sans-serif" }}
                      >
                        REQUESTED BY :
                      </div>
                      <div
                        className="font-extrabold text-slate-900 uppercase"
                        style={{ fontSize: '12pt', fontFamily: "'Calibri', sans-serif" }}
                      >
                        {data.requestedBy || 'MISKADI'}
                      </div>
                    </div>

                    {/* DEPARTMENT */}
                    <div className="w-56 border border-[#EA580C] px-3 py-2 rounded-sm">
                      <div
                        className="text-[#EA580C] font-bold tracking-wider mb-0.5"
                        style={{ fontSize: '9pt', fontFamily: "'Calibri', sans-serif" }}
                      >
                        DEPARTMENT :
                      </div>
                      <div
                        className="font-extrabold text-slate-900 uppercase"
                        style={{ fontSize: '12pt', fontFamily: "'Calibri', sans-serif" }}
                      >
                        {data.department || 'STAFF OPS'}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: DATE */}
                  <div className="w-48 border border-[#EA580C] px-3 py-2 rounded-sm">
                    <div
                      className="text-[#EA580C] font-bold tracking-wider mb-0.5"
                      style={{ fontSize: '9pt', fontFamily: "'Calibri', sans-serif" }}
                    >
                      DATE :
                    </div>
                    <div
                      className="font-extrabold text-center text-slate-900"
                      style={{
                        fontSize: '12pt',
                        fontFamily: "'Calibri', sans-serif",
                      }}
                    >
                      {data.date}
                    </div>
                  </div>
                </div>

                {/* Main Table with Calibri 11pt & Row Height 15pt and Orange Column Borders */}
                <div className="mt-4 border-2 border-[#EA580C] relative">
                  <table
                    className="w-full border-collapse"
                    style={{
                      fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
                      fontSize: '11pt',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: '#EA580C',
                          height: '15pt',
                          lineHeight: '15pt',
                          fontFamily: "'Calibri', sans-serif",
                          fontSize: '11pt',
                        }}
                        className="text-white text-center font-extrabold"
                      >
                        <th
                          style={{
                            height: '15pt',
                            lineHeight: '15pt',
                            padding: '0 6px',
                            verticalAlign: 'middle',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '11pt',
                          }}
                          className="border border-[#EA580C] w-[18%]"
                        >
                          Account
                        </th>
                        <th
                          style={{
                            height: '15pt',
                            lineHeight: '15pt',
                            padding: '0 6px',
                            verticalAlign: 'middle',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '11pt',
                          }}
                          className="border border-[#EA580C] w-[22%]"
                        >
                          Customer
                        </th>
                        <th
                          style={{
                            height: '15pt',
                            lineHeight: '15pt',
                            padding: '0 6px',
                            verticalAlign: 'middle',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '11pt',
                          }}
                          className="border border-[#EA580C] w-[40%]"
                        >
                          Description
                        </th>
                        <th
                          style={{
                            height: '15pt',
                            lineHeight: '15pt',
                            padding: '0 6px',
                            verticalAlign: 'middle',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '11pt',
                          }}
                          className="border border-[#EA580C] w-[20%] text-center font-extrabold"
                        >
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody
                      className="font-medium text-slate-900"
                      style={{ fontFamily: "'Calibri', sans-serif", fontSize: '11pt' }}
                    >
                      {/* Render grouped accounts with rowSpan merger and exact 15pt row height */}
                      {accountGroups.map((group, groupIdx) =>
                        group.items.map((item, itemIdx) => (
                          <tr
                            key={`grp-${groupIdx}-item-${itemIdx}`}
                            className="border-b border-[#EA580C]/40 hover:bg-orange-50/20"
                            style={{
                              height: '15pt',
                              minHeight: '15pt',
                              lineHeight: '15pt',
                              fontFamily: "'Calibri', sans-serif",
                              fontSize: '11pt',
                            }}
                          >
                            {/* Merge Account cell on first row of this account group */}
                            {itemIdx === 0 && (
                              <td
                                rowSpan={group.items.length}
                                className="border-r border-[#EA580C] text-center font-bold bg-slate-50/40 text-slate-900"
                                style={{
                                  height: `${group.items.length * 15}pt`,
                                  verticalAlign: 'middle',
                                  padding: '0 6px',
                                  fontFamily: "'Calibri', sans-serif",
                                  fontSize: '11pt',
                                }}
                              >
                                {group.account}
                              </td>
                            )}

                            {/* Customer Column with orange border */}
                            <td
                              className="border-r border-[#EA580C] text-center font-semibold text-slate-900"
                              style={{
                                height: '15pt',
                                lineHeight: '15pt',
                                verticalAlign: 'middle',
                                padding: '0 6px',
                                fontFamily: "'Calibri', sans-serif",
                                fontSize: '11pt',
                              }}
                            >
                              {item.customer || '-'}
                            </td>

                            {/* Description Column with orange border (Tanpa Bullet) */}
                            <td
                              className="border-r border-[#EA580C] text-left text-slate-900 whitespace-pre-line"
                              style={{
                                minHeight: '15pt',
                                verticalAlign: 'middle',
                                padding: '1px 8px',
                                lineHeight: '1.25',
                                fontFamily: "'Calibri', sans-serif",
                                fontSize: '11pt',
                              }}
                            >
                              {item.description}
                            </td>

                            {/* Amount Column - Merger vertically with rowSpan matching Account, Align Right */}
                            {itemIdx === 0 && (
                              <td
                                rowSpan={group.items.length}
                                className="text-right font-bold text-slate-900"
                                style={{
                                  height: `${group.items.length * 15}pt`,
                                  verticalAlign: 'middle',
                                  padding: '0 12px 0 6px',
                                  fontFamily: "'Calibri', sans-serif",
                                  fontSize: '11pt',
                                }}
                              >
                                {group.totalAmount > 0 ? formatNumber(group.totalAmount) : '-'}
                              </td>
                            )}
                          </tr>
                        ))
                      )}

                      {/* Empty filler rows with exact 15pt height and orange borders */}
                      {emptyRows.map((_, idx) => (
                        <tr
                          key={`empty-${idx}`}
                          className="border-b border-[#EA580C]/40"
                          style={{
                            height: '15pt',
                            lineHeight: '15pt',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '11pt',
                          }}
                        >
                          <td
                            className="border-r border-[#EA580C]"
                            style={{ height: '15pt', padding: '0 6px' }}
                          ></td>
                          <td
                            className="border-r border-[#EA580C]"
                            style={{ height: '15pt', padding: '0 6px' }}
                          ></td>
                          <td
                            className="border-r border-[#EA580C]"
                            style={{ height: '15pt', padding: '0 6px' }}
                          ></td>
                          <td
                            className="text-right"
                            style={{ height: '15pt', padding: '0 12px' }}
                          ></td>
                        </tr>
                      ))}

                      {/* Total Amount Row */}
                      <tr
                        className="border-t-2 border-[#EA580C] font-black"
                        style={{
                          height: '18pt',
                          lineHeight: '18pt',
                          fontFamily: "'Calibri', sans-serif",
                          fontSize: '11pt',
                        }}
                      >
                        <td
                          colSpan={3}
                          className="text-center font-bold tracking-wide border-r border-[#EA580C]"
                          style={{
                            height: '18pt',
                            lineHeight: '18pt',
                            verticalAlign: 'middle',
                            padding: '0 8px',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '11pt',
                          }}
                        >
                          Total Amount
                        </td>
                        <td
                          className="text-right font-black"
                          style={{
                            backgroundColor: '#FED7AA',
                            height: '18pt',
                            lineHeight: '18pt',
                            verticalAlign: 'middle',
                            padding: '0 12px 0 8px',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '11pt',
                          }}
                        >
                          {data.totalAmount > 0 ? formatNumber(data.totalAmount) : '-'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures Footer */}
              <div
                className="mt-6 pt-3 flex justify-between items-end relative"
                style={{ fontFamily: "'Calibri', sans-serif", fontSize: '11pt' }}
              >
                {/* Employee Signature */}
                <div className="w-56 text-center">
                  <div className="h-16 flex items-end justify-center mb-1">
                    {(() => {
                      const sigUrl =
                        data.employeeSignature ||
                        (typeof window !== 'undefined' ? localStorage.getItem('ourem_user_signature') : null) ||
                        null;

                      return sigUrl ? (
                        <img
                          src={sigUrl}
                          alt="Signature"
                          crossOrigin="anonymous"
                          className="max-h-14 max-w-full object-contain"
                        />
                      ) : (
                        <div
                          className="italic text-slate-400"
                          style={{ fontSize: '10pt', fontFamily: "'Calibri', sans-serif" }}
                        >
                          ( Ditandatangani digital )
                        </div>
                      );
                    })()}
                  </div>
                  <div
                    className="font-extrabold text-slate-900 border-t border-slate-700 pt-1"
                    style={{ fontSize: '11pt', fontFamily: "'Calibri', sans-serif" }}
                  >
                    {data.requestedBy || 'Miskadi'}
                  </div>
                  <div
                    className="text-slate-500 font-semibold tracking-wider mt-0.5"
                    style={{ fontSize: '9pt', fontFamily: "'Calibri', sans-serif" }}
                  >
                    Employee Signature
                  </div>
                </div>

                {/* Stempel Lunas & Tanggal: Di Bawah Tabel & Transparan */}
                {data.isPaid && (
                  <div
                    className="pointer-events-none select-none flex flex-col items-center justify-center my-auto px-4"
                    style={{
                      transform: 'rotate(-8deg)',
                      opacity: 0.72,
                    }}
                  >
                    <div
                      style={{
                        border: '3.5px double rgba(220, 38, 38, 0.85)',
                        borderRadius: '10px',
                        padding: '6px 22px',
                        backgroundColor: 'transparent',
                        color: '#DC2626',
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '210px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Arial Black', 'Impact', sans-serif",
                          fontSize: '28pt',
                          fontWeight: 900,
                          letterSpacing: '5px',
                          lineHeight: '1',
                          textTransform: 'uppercase',
                          color: '#DC2626',
                        }}
                      >
                        LUNAS
                      </div>
                      <div
                        style={{
                          width: '100%',
                          borderTop: '2px solid rgba(220, 38, 38, 0.85)',
                          margin: '4px 0 2px 0',
                        }}
                      />
                      <div
                        style={{
                          fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
                          fontSize: '11pt',
                          fontWeight: 800,
                          letterSpacing: '1px',
                          color: '#B91C1C',
                          textTransform: 'uppercase',
                          lineHeight: '1.2',
                        }}
                      >
                        TGL : {data.paidDate || data.date}
                      </div>
                      <div
                        style={{
                          fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
                          fontSize: '7.5pt',
                          fontWeight: 700,
                          letterSpacing: '1.5px',
                          color: '#DC2626',
                          textTransform: 'uppercase',
                          marginTop: '2px',
                          opacity: 0.9,
                        }}
                      >
                        FINANCE DEPT &bull; PAID
                      </div>
                    </div>
                  </div>
                )}

                {/* Finance Signature */}
                <div className="w-56 text-center">
                  <div className="h-16 flex items-end justify-center mb-1">
                    {(() => {
                      // Tanda tangan finance HANYA muncul setelah dicairkan (PAID) oleh Finance
                      const finSigUrl = data.isPaid
                        ? data.financeSignature ||
                          (typeof window !== 'undefined'
                            ? localStorage.getItem('ourem_finance_signature')
                            : null) ||
                          null
                        : null;

                      return finSigUrl ? (
                        <img
                          src={finSigUrl}
                          alt="Finance Signature"
                          crossOrigin="anonymous"
                          className="max-h-14 max-w-full object-contain"
                        />
                      ) : null;
                    })()}
                  </div>
                  <div
                    className="font-extrabold text-slate-900 border-t border-slate-700 pt-1 uppercase"
                    style={{ fontSize: '11pt', fontFamily: "'Calibri', sans-serif" }}
                  >
                    {data.isPaid
                      ? data.financeOfficer ||
                        (typeof window !== 'undefined'
                          ? localStorage.getItem('ourem_finance_name')
                          : null) ||
                        'FINANCE DEPT'
                      : 'FINANCE DEPT'}
                  </div>
                  <div
                    className="text-slate-500 font-semibold tracking-wider mt-0.5"
                    style={{ fontSize: '9pt', fontFamily: "'Calibri', sans-serif" }}
                  >
                    Finance Signature
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}