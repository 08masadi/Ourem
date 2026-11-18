'use client';

import React, { useRef, useState } from 'react';
import { OvertimeVoucherPrintData } from '@/types/database';
import { Download, Printer, X, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface OvertimeVoucherPdfProps {
  data: OvertimeVoucherPrintData;
  onClose: () => void;
}

export default function OvertimeVoucherPdf({ data, onClose }: OvertimeVoucherPdfProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const isHariKerja = data.tipeHari === 'hari kerja';
  const isHariLibur = data.tipeHari === 'hari libur';

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
      const safeDate = (data.tanggalLembur || '').replace(/\//g, '-');
      const safeName = (data.namaKaryawan || 'Karyawan').replace(/\s+/g, '-');
      const fileName = `Form-Lembur-${safeName}-${safeDate}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Gagal export PDF Form Lembur:', err);
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
              Preview Cetak Form Lembur
            </h2>
            <p className="text-xs text-slate-400">
              Format resmi PT. Citra Sari Kencana & Ouffice.co.id (Calibri 11pt &bull; Row Height 15pt)
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
          {/* Printable Sheet formatted exactly to user's Excel template in Landscape */}
          <div
            ref={printRef}
            className="w-[1000px] min-h-[580px] bg-white text-slate-900 p-8 shadow-2xl relative flex flex-col justify-between print:shadow-none print:w-full print:m-0 print:p-6"
            style={{
              fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
              fontSize: '11pt',
            }}
          >
            {/* Main Content */}
            <div>
              {/* Header: Logo and Company Info */}
              <div className="flex items-center gap-6 pb-3.5">
                <div className="shrink-0">
                  <img
                    src="/ouffice-logo.png"
                    alt="Ouffice.co.id"
                    className="h-20 w-auto object-contain"
                    crossOrigin="anonymous"
                  />
                </div>
                <div className="text-black leading-tight" style={{ fontFamily: "'Calibri', sans-serif" }}>
                  <div className="text-xl sm:text-2xl font-black tracking-normal uppercase">
                    PT. CITRA SARI KENCANA
                  </div>
                  <div className="text-[12pt] text-black mt-1 font-semibold leading-snug">
                    Jl. Rambutan No.4, Manggarai Selatan, Tebet, Jakarta Selatan 12860
                  </div>
                  <div className="text-[12pt] text-black font-semibold leading-snug">
                    Phone. [021] 835 1388
                  </div>
                </div>
              </div>

              {/* Main Outer Table Box (surrounds Form Lembur down to signatures) */}
              <div className="border-2 border-black text-black relative">
                {/* Top Section inside outer border: Form Lembur, Tanggal Lembur, Lokasi Lembur */}
                <div className="border-b border-black">
                  {/* Title Form Lembur */}
                  <div className="text-center pt-2 pb-2">
                    <h1
                      className="font-bold text-3xl text-black tracking-wide"
                      style={{ fontFamily: "'Calibri', sans-serif" }}
                    >
                      Form Lembur
                    </h1>
                  </div>

                  {/* Tanggal Lembur Row (Height: 15pt) */}
                  <div
                    className="flex items-center px-3"
                    style={{ height: '15pt', minHeight: '15pt', lineHeight: '15pt' }}
                  >
                    <div className="w-[140px] shrink-0 font-normal">Tanggal Lembur</div>
                    <div className="w-[20px] shrink-0 text-center font-normal">:</div>
                    <div className="flex-1 font-medium truncate">{data.tanggalLembur}</div>
                    <div className="w-[140px] shrink-0 flex items-center gap-2 pl-2">
                      <span className="w-3.5 h-3.5 border border-slate-700 rounded-[1px] inline-flex items-center justify-center text-[10px] font-bold">
                        {isHariKerja ? '✓' : ''}
                      </span>
                      <span className="text-[10.5pt] font-normal">Hari Kerja</span>
                    </div>
                  </div>

                  {/* Lokasi Lembur Row (Height: 15pt) */}
                  <div
                    className="flex items-center px-3 pb-1"
                    style={{ height: '15pt', minHeight: '15pt', lineHeight: '15pt' }}
                  >
                    <div className="w-[140px] shrink-0 font-normal">Lokasi Lembur</div>
                    <div className="w-[20px] shrink-0 text-center font-normal">:</div>
                    <div className="flex-1 font-medium truncate">{data.lokasiLembur}</div>
                    <div className="w-[140px] shrink-0 flex items-center gap-2 pl-2">
                      <span className="w-3.5 h-3.5 border border-slate-700 rounded-[1px] inline-flex items-center justify-center text-[10px] font-bold">
                        {isHariLibur ? '✓' : ''}
                      </span>
                      <span className="text-[10.5pt] font-normal">Hari Libur</span>
                    </div>
                  </div>
                </div>

                {/* Nama Karyawan Row (Height: 15pt) */}
                <div
                  className="flex items-center px-3 border-b border-black"
                  style={{ height: '15pt', minHeight: '15pt', lineHeight: '15pt' }}
                >
                  <div className="w-[140px] shrink-0 font-normal">Nama Karyawan</div>
                  <div className="w-[20px] shrink-0 text-center font-normal">:</div>
                  <div className="flex-1 font-bold">{data.namaKaryawan}</div>
                </div>

                {/* Section Header: Deskripsi Pekerjaan (Height: 15pt, Peach Background) */}
                <div
                  className="border-b border-black text-center font-bold text-[11pt] flex items-center justify-center"
                  style={{
                    backgroundColor: '#FCE4D6',
                    height: '15pt',
                    minHeight: '15pt',
                    lineHeight: '15pt',
                  }}
                >
                  Deskripsi Pekerjaan
                </div>

                {/* Perusahaan Row (Height: 15pt) */}
                <div
                  className="flex items-center px-3 border-b border-black"
                  style={{ height: '15pt', minHeight: '15pt', lineHeight: '15pt' }}
                >
                  <div className="w-[140px] shrink-0 font-normal">Perusahaan</div>
                  <div className="w-[20px] shrink-0 text-center font-normal">:</div>
                  <div className="flex-1 font-bold">{data.perusahaan}</div>
                </div>

                {/* Nama Pekerjaan Row (Height: 15pt) */}
                <div
                  className="flex items-center px-3 border-b border-black"
                  style={{ height: '15pt', minHeight: '15pt', lineHeight: '15pt' }}
                >
                  <div className="w-[140px] shrink-0 font-normal">Nama Pekerjaan</div>
                  <div className="w-[20px] shrink-0 text-center font-normal">:</div>
                  <div className="flex-1 font-bold">{data.namaPekerjaan}</div>
                </div>

                {/* Jam Lembur Row (Height: 15pt) */}
                <div
                  className="flex items-center px-3 border-b border-black"
                  style={{ height: '15pt', minHeight: '15pt', lineHeight: '15pt' }}
                >
                  <div className="w-[140px] shrink-0 font-normal">Jam Lembur</div>
                  <div className="w-[20px] shrink-0 text-center font-normal">:</div>
                  <div className="flex-1 font-bold">{data.jamLembur}</div>
                </div>

                {/* Uraian Pekerjaan Row (Taller Area) */}
                <div
                  className="flex px-3 pt-1.5 pb-2 border-b border-black min-h-[75pt]"
                  style={{ lineHeight: '15pt' }}
                >
                  <div className="w-[140px] shrink-0 font-normal">Uraian Pekerjaan</div>
                  <div className="w-[20px] shrink-0 text-center font-normal">:</div>
                  <div className="flex-1 font-normal whitespace-pre-line leading-relaxed">
                    {data.uraianPekerjaan || '(Belum ada uraian pekerjaan)'}
                  </div>
                </div>

                {/* Signatures Table Section (3 Equal Columns) */}
                <div className="flex min-h-[85pt] text-[11pt]">
                  {/* Column 1: Prepared By (Employee) */}
                  <div className="w-1/3 border-r border-black flex flex-col justify-between p-2.5">
                    <div className="font-normal text-xs text-black">
                      Prepared By :
                    </div>
                    <div className="h-14 flex items-center justify-center my-1">
                      {data.employeeSignature ? (
                        <img
                          src={data.employeeSignature}
                          alt="Prepared By Signature"
                          className="max-h-12 max-w-[160px] object-contain"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <span className="text-[9pt] italic text-slate-400">
                          ( Ditandatangani digital )
                        </span>
                      )}
                    </div>
                    <div className="text-center font-bold text-xs text-black uppercase truncate">
                      {`(${data.namaKaryawan || 'MISKADI'})`}
                    </div>
                  </div>

                  {/* Column 2: Approved By (Director / Approver) */}
                  <div className="w-1/3 border-r border-black flex flex-col justify-between p-2.5">
                    <div className="font-normal text-xs text-black">
                      Approved By :
                    </div>
                    <div className="h-14 flex items-center justify-center my-1">
                      {data.directorSignature ? (
                        <img
                          src={data.directorSignature}
                          alt="Approved By Signature"
                          className="max-h-12 max-w-[160px] object-contain"
                          crossOrigin="anonymous"
                        />
                      ) : null}
                    </div>
                    <div className="text-center font-bold text-xs text-black uppercase truncate">
                      {data.directorSignature || data.directorName ? `(${data.directorName || 'DIREKTUR UTAMA'})` : ''}
                    </div>
                  </div>

                  {/* Column 3: Paid By (Finance) */}
                  <div className="w-1/3 flex flex-col justify-between p-2.5">
                    <div className="font-normal text-xs text-black">
                      Paid By :
                    </div>
                    <div className="h-14 flex items-center justify-center my-1">
                      {data.financeSignature ? (
                        <img
                          src={data.financeSignature}
                          alt="Paid By Signature"
                          className="max-h-12 max-w-[160px] object-contain"
                          crossOrigin="anonymous"
                        />
                      ) : null}
                    </div>
                    <div className="text-center font-bold text-xs text-black uppercase truncate">
                      {data.financeSignature || data.financeName ? `(${data.financeName || 'FINANCE DEPT'})` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stempel Lunas & Tanggal: Di Bawah Tabel & Transparan */}
            {data.isPaid && (
              <div
                className="pointer-events-none select-none flex justify-center mt-3"
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
                    TGL : {data.paidDate || data.tanggalLembur}
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

            {/* Footer timestamp */}
            <div className="text-[9pt] text-slate-400 text-right mt-3 pt-2 border-t border-slate-200">
              Dicetak otomatis via Ouffice Enterprise Portal &bull; PT. Citra Sari Kencana
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
