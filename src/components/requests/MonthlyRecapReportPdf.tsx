'use client';

import React, { useRef, useState } from 'react';
import { MonthlyRecapReportData } from '@/types/database';
import { Download, Printer, X, Loader2 } from 'lucide-react';
import { printVoucherDocument, downloadVoucherPdf } from '@/lib/printUtils';

interface MonthlyRecapReportPdfProps {
  data: MonthlyRecapReportData;
  onClose: () => void;
}

export default function MonthlyRecapReportPdf({
  data,
  onClose,
}: MonthlyRecapReportPdfProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const safePeriod = data.periodLabel.replace(/\s+/g, '-');
  const safeType = data.type.replace(/\s+/g, '-');
  const docFileName = `Laporan-Rekap-${safeType}-${safePeriod}.pdf`;
  const docTitle = `Laporan Rekapitulasi ${data.type} - ${data.periodLabel}`;

  const handlePrint = () => {
    printVoucherDocument(printRef.current, docTitle);
  };

  const handleDownloadPdf = async () => {
    await downloadVoucherPdf(printRef.current, docFileName, setIsExporting);
  };

  // Subtitle nama pembayaran
  const paymentSubTitle =
    data.type === 'Lembur'
      ? 'PEMBAYARAN LEMBUR'
      : data.type === 'Voucher'
      ? 'PEMBAYARAN VOUCHER'
      : 'PEMBAYARAN PETTY CASH';

  // In A5 Landscape, 5 filler rows
  const minRows = 5;
  const emptyRowsCount = Math.max(0, minRows - data.items.length);
  const emptyRows = Array.from({ length: emptyRowsCount });

  return (
    <div className="print-modal-portal fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="print-modal-container relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl my-4 flex flex-col max-h-[95vh]">
        {/* Top Control Bar (Hidden on print) */}
        <div className="print-control-bar no-print flex items-center justify-between pb-3 border-b border-slate-800 mb-3 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              Preview Laporan Rekapitulasi {paymentSubTitle} (A5 Landscape)
            </h2>
            <p className="text-xs text-slate-400">
              Periode {data.periodLabel} &bull; Ukuran A5 Landscape
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
            {/* Document Body */}
            <div
              className="relative z-10 flex flex-col justify-between h-full"
              style={{ fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif" }}
            >
              <div>
                {/* Header: Kop Surat dengan Logo, Judul di Tengah, dan Periode di Kanan */}
                <div className="pb-1.5 border-b-2 border-[#EA580C]">
                  <div className="grid grid-cols-12 items-center gap-2">
                    {/* Left: Logo Ouffice */}
                    <div className="col-span-3 flex items-center justify-start">
                      <img
                        src="/ouffice-logo.png"
                        alt="Ouffice.co.id"
                        className="h-9 sm:h-10 w-auto object-contain"
                      />
                    </div>

                    {/* Center: Judul */}
                    <div className="col-span-6 text-center leading-tight">
                      <div
                        className="text-base sm:text-lg font-black tracking-wide uppercase"
                        style={{ color: '#EA580C', fontFamily: "'Calibri', sans-serif", fontWeight: 900 }}
                      >
                        LAPORAN REKAPITULASI
                      </div>
                      <div
                        className="text-sm sm:text-base font-black tracking-wide uppercase mt-0.5"
                        style={{ color: '#EA580C', fontFamily: "'Calibri', sans-serif", fontWeight: 900 }}
                      >
                        {paymentSubTitle}
                      </div>
                    </div>

                    {/* Right: Logo Citra Sari Kencana */}
                    <div className="col-span-3 flex items-center justify-end">
                      <img
                        src="/csk-logo.png"
                        alt="Citra Sari Kencana"
                        className="h-9 sm:h-10 w-auto object-contain"
                      />
                    </div>
                  </div>

                  {/* Periode Posisi Kanan */}
                  <div className="flex justify-end mt-1 px-1">
                    <div
                      className="font-extrabold uppercase tracking-wide text-[9pt]"
                      style={{ fontFamily: "'Calibri', sans-serif" }}
                    >
                      <span className="text-[#EA580C] font-black mr-1.5">PERIODE :</span>
                      <span className="font-black" style={{ color: '#000000' }}>{data.periodLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Table Pengeluaran Bulanan */}
                <div className="mt-2.5 border-2 border-[#EA580C] bg-white">
                  <table
                    className="w-full border-collapse"
                    style={{
                      fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
                      fontSize: '9pt',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: '#EA580C',
                          height: '16pt',
                          lineHeight: '16pt',
                          fontFamily: "'Calibri', sans-serif",
                          fontSize: '9pt',
                        }}
                        className="text-white text-center font-extrabold"
                      >
                        <th className="border border-[#EA580C] w-[6%] py-0.5">NO</th>
                        <th className="border border-[#EA580C] w-[26%] py-0.5">NAMA KARYAWAN</th>
                        <th className="border border-[#EA580C] w-[17%] py-0.5">TANGGAL PENGAJUAN</th>
                        <th className="border border-[#EA580C] w-[17%] py-0.5">DEPARTMENT</th>
                        <th className="border border-[#EA580C] w-[17%] py-0.5">TANGGAL PEMBAYARAN</th>
                        <th className="border border-[#EA580C] w-[17%] py-0.5">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item, idx) => (
                        <tr
                          key={item.id || idx}
                          className="border-b border-[#EA580C]"
                          style={{
                            height: '15pt',
                            lineHeight: '1.2',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '9pt',
                            backgroundColor: idx % 2 === 1 ? '#FFF7ED' : '#FFFFFF',
                          }}
                        >
                          {/* No */}
                          <td
                            className="text-center font-bold border-r border-[#EA580C] px-2 py-0.5"
                            style={{ verticalAlign: 'middle', color: '#000000' }}
                          >
                            {item.no}
                          </td>

                          {/* Nama Karyawan */}
                          <td
                            className="font-extrabold border-r border-[#EA580C] px-2.5 py-0.5 uppercase"
                            style={{ verticalAlign: 'middle', color: '#000000' }}
                          >
                            {item.employeeName}
                          </td>

                          {/* Tanggal Pengajuan */}
                          <td
                            className="text-center font-bold border-r border-[#EA580C] px-2 py-0.5"
                            style={{ verticalAlign: 'middle', color: '#000000' }}
                          >
                            {item.submissionDate || item.date}
                          </td>

                          {/* Department */}
                          <td
                            className="text-center font-bold border-r border-[#EA580C] px-2 py-0.5 uppercase"
                            style={{ verticalAlign: 'middle', color: '#000000' }}
                          >
                            {item.department || 'STAFF OPS'}
                          </td>

                          {/* Tanggal Pembayaran */}
                          <td
                            className="text-center font-bold border-r border-[#EA580C] px-2 py-0.5"
                            style={{ verticalAlign: 'middle', color: '#000000' }}
                          >
                            {item.paymentDate || item.date}
                          </td>

                          {/* Amount */}
                          <td
                            className="text-right font-black border-r border-[#EA580C] px-2.5 py-0.5"
                            style={{ verticalAlign: 'middle', color: '#000000' }}
                          >
                            {formatNumber(item.amount)}
                          </td>
                        </tr>
                      ))}

                      {/* Empty filler rows */}
                      {emptyRows.map((_, idx) => (
                        <tr
                          key={`empty-${idx}`}
                          className="border-b border-[#EA580C]"
                          style={{
                            height: '15pt',
                            lineHeight: '15pt',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '9pt',
                          }}
                        >
                          <td className="border-r border-[#EA580C] px-2 py-0.5"></td>
                          <td className="border-r border-[#EA580C] px-2.5 py-0.5"></td>
                          <td className="border-r border-[#EA580C] px-2 py-0.5"></td>
                          <td className="border-r border-[#EA580C] px-2 py-0.5"></td>
                          <td className="border-r border-[#EA580C] px-2 py-0.5"></td>
                          <td className="text-right border-r border-[#EA580C] px-2.5 py-0.5"></td>
                        </tr>
                      ))}

                      {/* Total Amount Row */}
                      <tr
                        className="border-t-2 border-[#EA580C] font-black"
                        style={{
                          height: '17pt',
                          lineHeight: '17pt',
                          fontFamily: "'Calibri', sans-serif",
                          fontSize: '9.5pt',
                        }}
                      >
                        <td
                          colSpan={5}
                          className="text-center font-black tracking-wider border-r border-[#EA580C] uppercase"
                          style={{
                            height: '17pt',
                            verticalAlign: 'middle',
                            padding: '0 6px',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '9.5pt',
                            backgroundColor: '#FFEDD5',
                            color: '#000000',
                          }}
                        >
                          TOTAL PENGELUARAN BULAN {data.periodLabel.toUpperCase()}
                        </td>
                        <td
                          className="text-right font-black"
                          style={{
                            backgroundColor: '#FED7AA',
                            height: '17pt',
                            verticalAlign: 'middle',
                            padding: '0 10px 0 6px',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '10pt',
                            color: '#000000',
                          }}
                        >
                          Rp {formatNumber(data.totalAmount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures Footer */}
              <div
                className="mt-3 pt-1 flex justify-between items-end px-4"
                style={{ fontFamily: "'Calibri', sans-serif" }}
              >
                {/* Finance Signature */}
                <div className="w-48 text-center">
                  <div className="font-bold mb-0.5" style={{ fontSize: '8.5pt', color: '#000000' }}>
                    Dibuat Oleh :
                  </div>
                  <div className="h-11 flex items-end justify-center mb-0.5">
                    {data.financeSignature ? (
                      <img
                        src={data.financeSignature}
                        alt="Finance Signature"
                        className="max-h-10 max-w-full object-contain"
                      />
                    ) : (
                      <div
                        className="italic text-slate-400"
                        style={{ fontSize: '8pt', fontFamily: "'Calibri', sans-serif" }}
                      >
                        ( Ditandatangani digital )
                      </div>
                    )}
                  </div>
                  <div
                    className="font-extrabold border-t border-slate-700 pt-0.5 uppercase"
                    style={{ fontSize: '9.5pt', color: '#000000', fontFamily: "'Calibri', sans-serif" }}
                  >
                    {data.financeName || 'FINANCE DEPT'}
                  </div>
                  <div
                    className="font-semibold tracking-wider mt-0.5"
                    style={{ fontSize: '8pt', color: '#475569', fontFamily: "'Calibri', sans-serif" }}
                  >
                    Finance Department
                  </div>
                </div>

                {/* Director Signature */}
                <div className="w-48 text-center">
                  <div className="font-bold mb-0.5" style={{ fontSize: '8.5pt', color: '#000000' }}>
                    Mengetahui &amp; Menyetujui :
                  </div>
                  <div className="h-11 flex items-end justify-center mb-0.5">
                    {data.directorSignature ? (
                      <img
                        src={data.directorSignature}
                        alt="Director Signature"
                        className="max-h-10 max-w-full object-contain"
                      />
                    ) : (
                      <div
                        className="italic text-slate-400"
                        style={{ fontSize: '8pt', fontFamily: "'Calibri', sans-serif" }}
                      >
                        ( Ditandatangani digital )
                      </div>
                    )}
                  </div>
                  <div
                    className="font-extrabold border-t border-slate-700 pt-0.5 uppercase"
                    style={{ fontSize: '9.5pt', color: '#000000', fontFamily: "'Calibri', sans-serif" }}
                  >
                    {data.directorName || 'DIREKTUR UTAMA'}
                  </div>
                  <div
                    className="font-semibold tracking-wider mt-0.5"
                    style={{ fontSize: '8pt', color: '#475569', fontFamily: "'Calibri', sans-serif" }}
                  >
                    Director
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
