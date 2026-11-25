'use client';

import React, { useRef, useState } from 'react';
import { ReimbursementVoucherPrintData } from '@/types/database';
import { Download, Printer, X, Loader2 } from 'lucide-react';
import { normalizeAccount, formatDateSlash } from '@/lib/formatters';
import { printVoucherDocument, downloadVoucherPdf } from '@/lib/printUtils';

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
    receipt_date?: string | null;
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

  // Group items by distinct block so identical accounts in different cards remain separate
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
      receipt_date: item.receipt_date,
    });
  });

  // In A5 Landscape, 6 rows fit perfectly without overflowing to page 2
  const totalItemRows = data.items.length;
  const minRows = 6;
  const emptyRowsCount = Math.max(0, minRows - totalItemRows);
  const emptyRows = Array.from({ length: emptyRowsCount });

  const safeDate = data.date.replace(/\//g, '-');
  const safeName = (data.requestedBy || 'Karyawan').replace(/\s+/g, '-');
  const docFileName = `${data.type.replace(/\s+/g, '-')}-${safeName}-${safeDate}.pdf`;
  const docTitle = `${data.type} - ${data.requestedBy} (${data.date})`;

  const handlePrint = () => {
    printVoucherDocument(printRef.current, docTitle);
  };

  const handleDownloadPdf = async () => {
    await downloadVoucherPdf(printRef.current, docFileName, setIsExporting);
  };

  return (
    <div className="print-modal-portal fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="print-modal-container relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl my-4 flex flex-col max-h-[95vh]">
        {/* Top Control Bar (Hidden on print) */}
        <div className="print-control-bar no-print flex items-center justify-between pb-3 border-b border-slate-800 mb-3 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              Preview Cetak Voucher Reimbursement (A5 Landscape)
            </h2>
            <p className="text-xs text-slate-400">
              Format resmi PT. Citra Sari Kencana & Ouffice.co.id &bull; Ukuran A5 Landscape
            </p>
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
        <div className="print-sheet-wrapper overflow-auto flex-1 flex justify-center p-2 sm:p-4 bg-slate-950/70 rounded-2xl border border-slate-800">
          {/* Printable Sheet formatted specifically for A5 Landscape (210mm x 148mm ratio) */}
          <div
            ref={printRef}
            className="printable-sheet bg-white text-black p-4 shadow-2xl relative flex flex-col justify-between"
            style={{
              width: '100%',
              maxWidth: '780px',
              height: '500px',
              maxHeight: '500px',
              aspectRatio: '210 / 148',
              border: '2px solid #1E3A8A',
              fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
              backgroundColor: '#ffffff',
              color: '#000000',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {/* Inner Content */}
            <div className="relative z-10 flex flex-col justify-between h-full">
              {/* Header: Left (Ouffice), Center (Title), Right (CSK Logo) */}
              <div>
                <div className="grid grid-cols-12 items-center pb-2 border-b-2 border-[#EA580C] gap-2">
                  {/* Left: Brand Logo */}
                  <div className="col-span-3 flex items-center justify-start">
                    <img
                      src="/ouffice-logo.png"
                      alt="Ouffice.co.id"
                      className="h-10 sm:h-11 w-auto object-contain"
                    />
                  </div>

                  {/* Center: Title */}
                  <div className="col-span-6 text-center">
                    <h1
                      className="text-lg sm:text-xl font-black tracking-wider uppercase leading-tight"
                      style={{
                        color: '#EA580C',
                        fontFamily: "'Calibri', sans-serif",
                        fontWeight: 900,
                      }}
                    >
                      {isPettyCash ? (
                        <>
                          PETTY CASH
                          <br />
                          REIMBURSEMENT
                        </>
                      ) : (
                        <>
                          VOUCHER
                          <br />
                          REIMBURSEMENT
                        </>
                      )}
                    </h1>
                  </div>

                  {/* Right: Brand Logo */}
                  <div className="col-span-3 flex items-center justify-end">
                    <img
                      src="/csk-logo.png"
                      alt="Citra Sari Kencana"
                      className="h-10 sm:h-11 w-auto object-contain"
                    />
                  </div>
                </div>

                {/* Info Boxes: REQUESTED BY, DEPARTMENT, DATE */}
                <div className="grid grid-cols-12 gap-2 mt-2 font-bold">
                  {/* REQUESTED BY */}
                  <div className="col-span-4 border border-[#EA580C] px-2.5 py-1 rounded-sm bg-white">
                    <div
                      className="text-[#EA580C] font-bold tracking-wider mb-0.5"
                      style={{ fontSize: '7.5pt', fontFamily: "'Calibri', sans-serif" }}
                    >
                      REQUESTED BY :
                    </div>
                    <div
                      className="font-extrabold uppercase truncate"
                      style={{
                        fontSize: '10.5pt',
                        color: '#000000',
                        fontFamily: "'Calibri', sans-serif",
                      }}
                    >
                      {data.requestedBy || 'MISKADI'}
                    </div>
                  </div>

                  {/* DEPARTMENT */}
                  <div className="col-span-4 border border-[#EA580C] px-2.5 py-1 rounded-sm bg-white">
                    <div
                      className="text-[#EA580C] font-bold tracking-wider mb-0.5"
                      style={{ fontSize: '7.5pt', fontFamily: "'Calibri', sans-serif" }}
                    >
                      DEPARTMENT :
                    </div>
                    <div
                      className="font-extrabold uppercase truncate"
                      style={{
                        fontSize: '10.5pt',
                        color: '#000000',
                        fontFamily: "'Calibri', sans-serif",
                      }}
                    >
                      {data.department === 'Staff OPS' || data.department === 'STAFF OPS' || !data.department
                        ? 'STAFF OPERASIONAL'
                        : data.department}
                    </div>
                  </div>

                  {/* DATE */}
                  <div className="col-span-4 border border-[#EA580C] px-2.5 py-1 rounded-sm bg-white">
                    <div
                      className="text-[#EA580C] font-bold tracking-wider mb-0.5 text-center"
                      style={{ fontSize: '7.5pt', fontFamily: "'Calibri', sans-serif" }}
                    >
                      DATE :
                    </div>
                    <div
                      className="font-extrabold text-center truncate"
                      style={{
                        fontSize: '10.5pt',
                        color: '#000000',
                        fontFamily: "'Calibri', sans-serif",
                      }}
                    >
                      {data.date}
                    </div>
                  </div>
                </div>

                {/* Main Table: Account, Customer, Description, Amount */}
                <div className="mt-2.5 border-2 border-[#EA580C] bg-white">
                  <table
                    className="w-full border-collapse"
                    style={{
                      fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
                      fontSize: '9.5pt',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: '#EA580C',
                          height: '16pt',
                          lineHeight: '16pt',
                          fontFamily: "'Calibri', sans-serif",
                          fontSize: '9.5pt',
                        }}
                        className="text-white text-center font-extrabold"
                      >
                        <th
                          style={{
                            height: '16pt',
                            padding: '0 4px',
                            verticalAlign: 'middle',
                            color: '#ffffff',
                          }}
                          className="border border-[#EA580C] w-[15%]"
                        >
                          Tanggal Nota
                        </th>
                        <th
                          style={{
                            height: '16pt',
                            padding: '0 4px',
                            verticalAlign: 'middle',
                            color: '#ffffff',
                          }}
                          className="border border-[#EA580C] w-[17%]"
                        >
                          Account
                        </th>
                        <th
                          style={{
                            height: '16pt',
                            padding: '0 4px',
                            verticalAlign: 'middle',
                            color: '#ffffff',
                          }}
                          className="border border-[#EA580C] w-[18%]"
                        >
                          Customer
                        </th>
                        <th
                          style={{
                            height: '16pt',
                            padding: '0 4px',
                            verticalAlign: 'middle',
                            color: '#ffffff',
                          }}
                          className="border border-[#EA580C] w-[35%]"
                        >
                          Description
                        </th>
                        <th
                          style={{
                            height: '16pt',
                            padding: '0 4px',
                            verticalAlign: 'middle',
                            color: '#ffffff',
                          }}
                          className="border border-[#EA580C] w-[15%] text-center font-extrabold"
                        >
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody
                      style={{
                        fontFamily: "'Calibri', sans-serif",
                        fontSize: '9.5pt',
                        color: '#000000',
                      }}
                    >
                      {/* Render grouped accounts with solid black font */}
                      {accountGroups.map((group, groupIdx) =>
                        group.items.map((item, itemIdx) => (
                          <tr
                            key={`grp-${groupIdx}-item-${itemIdx}`}
                            className="border-b border-[#EA580C]"
                            style={{
                              height: '14.5pt',
                              minHeight: '14.5pt',
                              lineHeight: '14.5pt',
                            }}
                          >
                            {/* Tanggal Nota Column (Merged per Account Group) */}
                            {itemIdx === 0 && (
                              <td
                                rowSpan={group.items.length}
                                className="border-r border-[#EA580C] text-center font-bold"
                                style={{
                                  height: `${group.items.length * 14.5}pt`,
                                  verticalAlign: 'middle',
                                  padding: '0 4px',
                                  color: '#000000',
                                  backgroundColor: '#ffffff',
                                }}
                              >
                                {item.receipt_date ? formatDateSlash(item.receipt_date) : data.date}
                              </td>
                            )}

                            {/* Merge Account cell on first row of this account group */}
                            {itemIdx === 0 && (
                              <td
                                rowSpan={group.items.length}
                                className="border-r border-[#EA580C] text-center font-bold"
                                style={{
                                  height: `${group.items.length * 14.5}pt`,
                                  verticalAlign: 'middle',
                                  padding: '0 4px',
                                  color: '#000000',
                                  backgroundColor: '#ffffff',
                                }}
                              >
                                {group.account}
                              </td>
                            )}

                            {/* Customer Column */}
                            <td
                              className="border-r border-[#EA580C] text-center font-bold"
                              style={{
                                height: '14.5pt',
                                lineHeight: '14.5pt',
                                verticalAlign: 'middle',
                                padding: '0 4px',
                                color: '#000000',
                              }}
                            >
                              {item.customer || '-'}
                            </td>

                            {/* Description Column */}
                            <td
                              className="border-r border-[#EA580C] text-left whitespace-pre-line"
                              style={{
                                minHeight: '14.5pt',
                                verticalAlign: 'middle',
                                padding: '1px 6px',
                                lineHeight: '1.2',
                                color: '#000000',
                                fontWeight: 500,
                              }}
                            >
                              {item.description}
                            </td>

                            {/* Amount Column */}
                            {itemIdx === 0 && (
                              <td
                                rowSpan={group.items.length}
                                className="text-right font-bold"
                                style={{
                                  height: `${group.items.length * 14.5}pt`,
                                  verticalAlign: 'middle',
                                  padding: '0 8px 0 4px',
                                  color: '#000000',
                                }}
                              >
                                {group.totalAmount > 0 ? formatNumber(group.totalAmount) : '-'}
                              </td>
                            )}
                          </tr>
                        ))
                      )}

                      {/* Empty filler rows with exact height and orange borders */}
                      {emptyRows.map((_, idx) => (
                        <tr
                          key={`empty-${idx}`}
                          className="border-b border-[#EA580C]"
                          style={{
                            height: '14.5pt',
                            lineHeight: '14.5pt',
                          }}
                        >
                          <td
                            className="border-r border-[#EA580C]"
                            style={{ height: '14.5pt', padding: '0 4px' }}
                          ></td>
                          <td
                            className="border-r border-[#EA580C]"
                            style={{ height: '14.5pt', padding: '0 4px' }}
                          ></td>
                          <td
                            className="border-r border-[#EA580C]"
                            style={{ height: '14.5pt', padding: '0 4px' }}
                          ></td>
                          <td
                            className="border-r border-[#EA580C]"
                            style={{ height: '14.5pt', padding: '0 4px' }}
                          ></td>
                          <td
                            className="text-right"
                            style={{ height: '14.5pt', padding: '0 8px' }}
                          ></td>
                        </tr>
                      ))}

                      {/* Total Amount Row */}
                      <tr
                        className="border-t-2 border-[#EA580C]"
                        style={{
                          height: '16pt',
                          lineHeight: '16pt',
                          fontWeight: 900,
                        }}
                      >
                        <td
                          colSpan={4}
                          className="text-center font-bold tracking-wide border-r border-[#EA580C]"
                          style={{
                            height: '16pt',
                            verticalAlign: 'middle',
                            padding: '0 6px',
                            color: '#000000',
                          }}
                        >
                          Total Amount
                        </td>
                        <td
                          className="text-right font-black"
                          style={{
                            backgroundColor: '#FED7AA',
                            height: '16pt',
                            verticalAlign: 'middle',
                            padding: '0 8px 0 6px',
                            color: '#000000',
                          }}
                        >
                          {data.totalAmount > 0 ? formatNumber(data.totalAmount) : '-'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures & Stempel Footer */}
              <div
                className="mt-3 pt-1 flex justify-between items-end relative"
                style={{ fontFamily: "'Calibri', sans-serif" }}
              >
                {/* Employee Signature */}
                <div className="w-48 text-center">
                  <div className="h-11 flex items-end justify-center mb-0.5">
                    {(() => {
                      const sigUrl =
                        data.employeeSignature ||
                        (typeof window !== 'undefined' ? localStorage.getItem('ourem_user_signature') : null) ||
                        null;

                      return sigUrl ? (
                        <img
                          src={sigUrl}
                          alt="Signature"
                          className="max-h-10 max-w-full object-contain"
                        />
                      ) : (
                        <div
                          className="italic text-slate-400"
                          style={{ fontSize: '8.5pt', fontFamily: "'Calibri', sans-serif" }}
                        >
                          ( Ditandatangani digital )
                        </div>
                      );
                    })()}
                  </div>
                  <div
                    className="font-extrabold border-t border-slate-700 pt-0.5"
                    style={{ fontSize: '10pt', color: '#000000', fontFamily: "'Calibri', sans-serif" }}
                  >
                    {data.requestedBy || 'Miskadi'}
                  </div>
                  <div
                    className="font-semibold tracking-wider mt-0.5"
                    style={{ fontSize: '8pt', color: '#475569', fontFamily: "'Calibri', sans-serif" }}
                  >
                    Employee Signature
                  </div>
                </div>

                {/* Stempel Lunas: Di Bawah Tabel & Transparan */}
                {data.isPaid && (
                  <div
                    className="pointer-events-none select-none flex flex-col items-center justify-center my-auto px-2"
                    style={{
                      transform: 'rotate(-8deg)',
                      opacity: 0.72,
                    }}
                  >
                    <div
                      style={{
                        border: '2.5px double rgba(220, 38, 38, 0.85)',
                        borderRadius: '6px',
                        padding: '3px 14px',
                        backgroundColor: 'transparent',
                        color: '#DC2626',
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '150px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Arial Black', 'Impact', sans-serif",
                          fontSize: '18pt',
                          fontWeight: 900,
                          letterSpacing: '3px',
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
                          borderTop: '1px solid rgba(220, 38, 38, 0.85)',
                          margin: '2px 0 1px 0',
                        }}
                      />
                      <div
                        style={{
                          fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
                          fontSize: '8.5pt',
                          fontWeight: 800,
                          letterSpacing: '0.8px',
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
                          fontSize: '6.5pt',
                          fontWeight: 700,
                          letterSpacing: '1px',
                          color: '#DC2626',
                          textTransform: 'uppercase',
                          marginTop: '1px',
                          opacity: 0.9,
                        }}
                      >
                        FINANCE DEPT &bull; PAID
                      </div>
                    </div>
                  </div>
                )}

                {/* Finance Signature */}
                <div className="w-48 text-center">
                  <div className="h-11 flex items-end justify-center mb-0.5">
                    {(() => {
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
                          className="max-h-10 max-w-full object-contain"
                        />
                      ) : null;
                    })()}
                  </div>
                  <div
                    className="font-extrabold border-t border-slate-700 pt-0.5 uppercase"
                    style={{ fontSize: '10pt', color: '#000000', fontFamily: "'Calibri', sans-serif" }}
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
                    className="font-semibold tracking-wider mt-0.5"
                    style={{ fontSize: '8pt', color: '#475569', fontFamily: "'Calibri', sans-serif" }}
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
