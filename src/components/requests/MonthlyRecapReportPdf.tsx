'use client';

import React, { useRef, useState } from 'react';
import { MonthlyRecapReportData } from '@/types/database';
import { Download, Printer, X, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
      const safePeriod = data.periodLabel.replace(/\s+/g, '-');
      const safeType = data.type.replace(/\s+/g, '-');
      const fileName = `Laporan-Rekap-${safeType}-${safePeriod}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Gagal export PDF Rekap:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Subtitle nama pembayaran
  const paymentSubTitle =
    data.type === 'Lembur'
      ? 'PEMBAYARAN LEMBUR'
      : data.type === 'Voucher'
      ? 'PEMBAYARAN VOUCHER'
      : 'PEMBAYARAN PETTY CASH';

  // Filler rows to maintain elegant standard height if items are few
  const minRows = 8;
  const emptyRowsCount = Math.max(0, minRows - data.items.length);
  const emptyRows = Array.from({ length: emptyRowsCount });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl my-4 flex flex-col max-h-[95vh]">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              Preview Laporan Rekapitulasi {paymentSubTitle}
            </h2>
            <p className="text-xs text-slate-400">
              Periode {data.periodLabel}
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
              <div>
                {/* Header: Kop Surat dengan Logo Diperkecil, Judul di Tengah, dan Periode di Atas Garis Posisi Kanan */}
                <div className="pb-2 border-b-2 border-[#EA580C]">
                  <div className="grid grid-cols-12 items-center gap-2">
                    {/* Left: Logo Ouffice Diperkecil */}
                    <div className="col-span-3 flex items-center justify-start">
                      <img
                        src="/ouffice-logo.png"
                        alt="Ouffice.co.id"
                        className="h-10 sm:h-12 w-auto object-contain"
                        crossOrigin="anonymous"
                      />
                    </div>

                    {/* Center: Laporan Rekapitulasi di bawahnya Pembayaran Petty Cash / Voucher / Lembur */}
                    <div className="col-span-6 text-center leading-tight">
                      <div
                        className="text-xl sm:text-2xl font-black tracking-wide uppercase"
                        style={{ color: '#EA580C', fontFamily: "'Calibri', sans-serif", fontWeight: 900 }}
                      >
                        LAPORAN REKAPITULASI
                      </div>
                      <div
                        className="text-lg sm:text-xl font-black tracking-wide uppercase mt-1"
                        style={{ color: '#EA580C', fontFamily: "'Calibri', sans-serif", fontWeight: 900 }}
                      >
                        {paymentSubTitle}
                      </div>
                    </div>

                    {/* Right: Logo Citra Sari Kencana Diperkecil */}
                    <div className="col-span-3 flex items-center justify-end">
                      <img
                        src="/csk-logo.png"
                        alt="Citra Sari Kencana"
                        className="h-10 sm:h-12 w-auto object-contain"
                        crossOrigin="anonymous"
                      />
                    </div>
                  </div>

                  {/* Periode Pindah ke Atas Garis Pemisah Kop Surat di Posisi Kanan */}
                  <div className="flex justify-end mt-2 px-1">
                    <div
                      className="font-extrabold uppercase tracking-wide text-[11pt]"
                      style={{ fontFamily: "'Calibri', sans-serif" }}
                    >
                      <span className="text-[#EA580C] font-black mr-1.5">PERIODE :</span>
                      <span className="font-black text-slate-900">{data.periodLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Table Pengeluaran Bulanan (Tanpa Kolom Keterangan / Rincian) */}
                <div className="mt-4 border-2 border-[#EA580C]">
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
                          height: '20pt',
                          lineHeight: '20pt',
                          fontFamily: "'Calibri', sans-serif",
                          fontSize: '11pt',
                        }}
                        className="text-white text-center font-extrabold"
                      >
                        <th className="border border-[#EA580C] w-[7%] py-1">NO</th>
                        <th className="border border-[#EA580C] w-[35%] py-1">NAMA KARYAWAN</th>
                        <th className="border border-[#EA580C] w-[20%] py-1">DEPARTMENT</th>
                        <th className="border border-[#EA580C] w-[18%] py-1">TANGGAL</th>
                        <th className="border border-[#EA580C] w-[20%] py-1">AMOUNT (RP)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item, idx) => (
                        <tr
                          key={item.id || idx}
                          className="border-b border-[#EA580C]/40 text-slate-900"
                          style={{
                            height: '20pt',
                            lineHeight: '1.25',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '11pt',
                            backgroundColor: idx % 2 === 1 ? '#FFF7ED' : '#FFFFFF',
                          }}
                        >
                          {/* No */}
                          <td
                            className="text-center font-bold border-r border-[#EA580C] px-2 py-1.5"
                            style={{ verticalAlign: 'middle' }}
                          >
                            {item.no}
                          </td>

                          {/* Nama Karyawan */}
                          <td
                            className="font-extrabold border-r border-[#EA580C] px-4 py-1.5 uppercase"
                            style={{ verticalAlign: 'middle' }}
                          >
                            {item.employeeName}
                          </td>

                          {/* Department */}
                          <td
                            className="text-center font-semibold border-r border-[#EA580C] px-2 py-1.5 uppercase text-slate-700"
                            style={{ verticalAlign: 'middle' }}
                          >
                            {item.department || 'STAFF OPS'}
                          </td>

                          {/* Tanggal */}
                          <td
                            className="text-center font-bold border-r border-[#EA580C] px-2 py-1.5"
                            style={{ verticalAlign: 'middle' }}
                          >
                            {item.date}
                          </td>

                          {/* Amount */}
                          <td
                            className="text-right font-black border-r border-[#EA580C] px-4 py-1.5 text-slate-900"
                            style={{ verticalAlign: 'middle' }}
                          >
                            {formatNumber(item.amount)}
                          </td>
                        </tr>
                      ))}

                      {/* Empty filler rows */}
                      {emptyRows.map((_, idx) => (
                        <tr
                          key={`empty-${idx}`}
                          className="border-b border-[#EA580C]/40"
                          style={{
                            height: '20pt',
                            lineHeight: '20pt',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '11pt',
                          }}
                        >
                          <td className="border-r border-[#EA580C] px-2 py-1"></td>
                          <td className="border-r border-[#EA580C] px-4 py-1"></td>
                          <td className="border-r border-[#EA580C] px-2 py-1"></td>
                          <td className="border-r border-[#EA580C] px-2 py-1"></td>
                          <td className="text-right border-r border-[#EA580C] px-4 py-1"></td>
                        </tr>
                      ))}

                      {/* Total Amount Row */}
                      <tr
                        className="border-t-2 border-[#EA580C] font-black"
                        style={{
                          height: '24pt',
                          lineHeight: '24pt',
                          fontFamily: "'Calibri', sans-serif",
                          fontSize: '11pt',
                        }}
                      >
                        <td
                          colSpan={4}
                          className="text-center font-black tracking-wider border-r border-[#EA580C] uppercase"
                          style={{
                            height: '24pt',
                            verticalAlign: 'middle',
                            padding: '0 8px',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '11pt',
                            backgroundColor: '#FFEDD5',
                          }}
                        >
                          TOTAL PENGELUARAN BULAN {data.periodLabel.toUpperCase()}
                        </td>
                        <td
                          className="text-right font-black text-slate-900"
                          style={{
                            backgroundColor: '#FED7AA',
                            height: '24pt',
                            verticalAlign: 'middle',
                            padding: '0 16px 0 8px',
                            fontFamily: "'Calibri', sans-serif",
                            fontSize: '12pt',
                          }}
                        >
                          Rp {formatNumber(data.totalAmount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures Footer: Dibuat Oleh (Finance) & Mengetahui / Disetujui (Director) */}
              <div
                className="mt-8 pt-2 flex justify-between items-end px-8"
                style={{ fontFamily: "'Calibri', sans-serif", fontSize: '11pt' }}
              >
                {/* Finance Signature */}
                <div className="w-60 text-center">
                  <div className="text-slate-600 font-bold mb-1" style={{ fontSize: '10pt' }}>
                    Dibuat Oleh :
                  </div>
                  <div className="h-16 flex items-end justify-center mb-1">
                    {data.financeSignature ? (
                      <img
                        src={data.financeSignature}
                        alt="Finance Signature"
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
                    )}
                  </div>
                  <div
                    className="font-extrabold text-slate-900 border-t border-slate-700 pt-1 uppercase"
                    style={{ fontSize: '11pt', fontFamily: "'Calibri', sans-serif" }}
                  >
                    {data.financeName || 'FINANCE DEPT'}
                  </div>
                  <div
                    className="text-slate-500 font-semibold tracking-wider mt-0.5"
                    style={{ fontSize: '9pt', fontFamily: "'Calibri', sans-serif" }}
                  >
                    Finance Department
                  </div>
                </div>

                {/* Director Signature */}
                <div className="w-60 text-center">
                  <div className="text-slate-600 font-bold mb-1" style={{ fontSize: '10pt' }}>
                    Mengetahui &amp; Menyetujui :
                  </div>
                  <div className="h-16 flex items-end justify-center mb-1">
                    {data.directorSignature ? (
                      <img
                        src={data.directorSignature}
                        alt="Director Signature"
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
                    )}
                  </div>
                  <div
                    className="font-extrabold text-slate-900 border-t border-slate-700 pt-1 uppercase"
                    style={{ fontSize: '11pt', fontFamily: "'Calibri', sans-serif" }}
                  >
                    {data.directorName || 'DIREKTUR UTAMA'}
                  </div>
                  <div
                    className="text-slate-500 font-semibold tracking-wider mt-0.5"
                    style={{ fontSize: '9pt', fontFamily: "'Calibri', sans-serif" }}
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
