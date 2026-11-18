'use client';

import React, { useRef, useState } from 'react';
import { OvertimeVoucherPrintData } from '@/types/database';
import { Download, Printer, X, Loader2 } from 'lucide-react';
import { printVoucherDocument, downloadVoucherPdf } from '@/lib/printUtils';

interface OvertimeVoucherPdfProps {
  data: OvertimeVoucherPrintData;
  onClose: () => void;
}

export default function OvertimeVoucherPdf({ data, onClose }: OvertimeVoucherPdfProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const isHariKerja = data.tipeHari === 'hari kerja';
  const isHariLibur = data.tipeHari === 'hari libur';

  const safeDate = (data.tanggalLembur || '').replace(/\//g, '-');
  const safeName = (data.namaKaryawan || 'Karyawan').replace(/\s+/g, '-');
  const docFileName = `Form-Lembur-${safeName}-${safeDate}.pdf`;
  const docTitle = `Form Lembur - ${data.namaKaryawan || 'Karyawan'} (${data.tanggalLembur || ''})`;

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
              Preview Cetak Form Lembur (A5 Landscape)
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
            className="printable-sheet bg-white text-black p-5 sm:p-6 shadow-2xl relative flex flex-col justify-between"
            style={{
              width: '100%',
              maxWidth: '820px',
              minHeight: '520px',
              aspectRatio: '210 / 148',
              border: '2px solid #000000',
              fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
              backgroundColor: '#ffffff',
              color: '#000000',
            }}
          >
            {/* Main Content */}
            <div>
              {/* Header: Logo and Company Info */}
              <div className="flex items-center gap-4 pb-2.5">
                <div className="shrink-0">
                  <img
                    src="/ouffice-logo.png"
                    alt="Ouffice.co.id"
                    className="h-12 sm:h-14 w-auto object-contain"
                  />
                </div>
                <div className="leading-tight" style={{ fontFamily: "'Calibri', sans-serif" }}>
                  <div className="text-base sm:text-lg font-black tracking-normal uppercase" style={{ color: '#000000' }}>
                    PT. CITRA SARI KENCANA
                  </div>
                  <div className="text-[10pt] font-semibold leading-snug" style={{ color: '#000000' }}>
                    Jl. Rambutan No.4, Manggarai Selatan, Tebet, Jakarta Selatan 12860
                  </div>
                  <div className="text-[10pt] font-semibold leading-snug" style={{ color: '#000000' }}>
                    Phone. [021] 835 1388
                  </div>
                </div>
              </div>

              {/* Main Outer Table Box */}
              <div className="border border-black bg-white" style={{ color: '#000000' }}>
                {/* Top Section inside outer border: Form Lembur, Tanggal Lembur, Lokasi Lembur */}
                <div className="border-b border-black">
                  {/* Title Form Lembur */}
                  <div className="text-center py-1 bg-white">
                    <h1
                      className="font-bold text-xl sm:text-2xl tracking-wide uppercase"
                      style={{ fontFamily: "'Calibri', sans-serif", color: '#000000' }}
                    >
                      Form Lembur
                    </h1>
                  </div>

                  {/* Tanggal Lembur Row */}
                  <div
                    className="flex items-center px-3 border-t border-black"
                    style={{ height: '16pt', minHeight: '16pt', lineHeight: '16pt', fontSize: '9.5pt' }}
                  >
                    <div className="w-[120px] shrink-0 font-semibold" style={{ color: '#000000' }}>Tanggal Lembur</div>
                    <div className="w-[16px] shrink-0 text-center font-bold" style={{ color: '#000000' }}>:</div>
                    <div className="flex-1 font-bold truncate" style={{ color: '#000000' }}>{data.tanggalLembur}</div>
                    <div className="w-[130px] shrink-0 flex items-center gap-2 pl-2">
                      <span className="w-3 h-3 border border-black inline-flex items-center justify-center text-[9px] font-bold" style={{ color: '#000000' }}>
                        {isHariKerja ? '✓' : ''}
                      </span>
                      <span className="font-semibold" style={{ color: '#000000' }}>Hari Kerja</span>
                    </div>
                  </div>

                  {/* Lokasi Lembur Row */}
                  <div
                    className="flex items-center px-3 border-t border-black/30"
                    style={{ height: '16pt', minHeight: '16pt', lineHeight: '16pt', fontSize: '9.5pt' }}
                  >
                    <div className="w-[120px] shrink-0 font-semibold" style={{ color: '#000000' }}>Lokasi Lembur</div>
                    <div className="w-[16px] shrink-0 text-center font-bold" style={{ color: '#000000' }}>:</div>
                    <div className="flex-1 font-bold truncate" style={{ color: '#000000' }}>{data.lokasiLembur}</div>
                    <div className="w-[130px] shrink-0 flex items-center gap-2 pl-2">
                      <span className="w-3 h-3 border border-black inline-flex items-center justify-center text-[9px] font-bold" style={{ color: '#000000' }}>
                        {isHariLibur ? '✓' : ''}
                      </span>
                      <span className="font-semibold" style={{ color: '#000000' }}>Hari Libur</span>
                    </div>
                  </div>
                </div>

                {/* Nama Karyawan Row */}
                <div
                  className="flex items-center px-3 border-b border-black"
                  style={{ height: '16pt', minHeight: '16pt', lineHeight: '16pt', fontSize: '9.5pt' }}
                >
                  <div className="w-[120px] shrink-0 font-semibold" style={{ color: '#000000' }}>Nama Karyawan</div>
                  <div className="w-[16px] shrink-0 text-center font-bold" style={{ color: '#000000' }}>:</div>
                  <div className="flex-1 font-bold uppercase" style={{ color: '#000000' }}>{data.namaKaryawan}</div>
                </div>

                {/* Section Header: Deskripsi Pekerjaan (Peach Background) */}
                <div
                  className="border-b border-black text-center font-bold flex items-center justify-center"
                  style={{
                    backgroundColor: '#FCE4D6',
                    height: '16pt',
                    minHeight: '16pt',
                    lineHeight: '16pt',
                    fontSize: '10pt',
                    color: '#000000',
                  }}
                >
                  Deskripsi Pekerjaan
                </div>

                {/* Perusahaan Row */}
                <div
                  className="flex items-center px-3 border-b border-black"
                  style={{ height: '16pt', minHeight: '16pt', lineHeight: '16pt', fontSize: '9.5pt' }}
                >
                  <div className="w-[120px] shrink-0 font-semibold" style={{ color: '#000000' }}>Perusahaan</div>
                  <div className="w-[16px] shrink-0 text-center font-bold" style={{ color: '#000000' }}>:</div>
                  <div className="flex-1 font-bold" style={{ color: '#000000' }}>{data.perusahaan}</div>
                </div>

                {/* Nama Pekerjaan Row */}
                <div
                  className="flex items-center px-3 border-b border-black"
                  style={{ height: '16pt', minHeight: '16pt', lineHeight: '16pt', fontSize: '9.5pt' }}
                >
                  <div className="w-[120px] shrink-0 font-semibold" style={{ color: '#000000' }}>Nama Pekerjaan</div>
                  <div className="w-[16px] shrink-0 text-center font-bold" style={{ color: '#000000' }}>:</div>
                  <div className="flex-1 font-bold" style={{ color: '#000000' }}>{data.namaPekerjaan}</div>
                </div>

                {/* Jam Lembur Row */}
                <div
                  className="flex items-center px-3 border-b border-black"
                  style={{ height: '16pt', minHeight: '16pt', lineHeight: '16pt', fontSize: '9.5pt' }}
                >
                  <div className="w-[120px] shrink-0 font-semibold" style={{ color: '#000000' }}>Jam Lembur</div>
                  <div className="w-[16px] shrink-0 text-center font-bold" style={{ color: '#000000' }}>:</div>
                  <div className="flex-1 font-bold" style={{ color: '#000000' }}>{data.jamLembur}</div>
                </div>

                {/* Uraian Pekerjaan Row */}
                <div
                  className="flex px-3 py-1.5 border-b border-black min-h-[50pt]"
                  style={{ lineHeight: '1.3', fontSize: '9.5pt' }}
                >
                  <div className="w-[120px] shrink-0 font-semibold" style={{ color: '#000000' }}>Uraian Pekerjaan</div>
                  <div className="w-[16px] shrink-0 text-center font-bold" style={{ color: '#000000' }}>:</div>
                  <div className="flex-1 font-medium whitespace-pre-line leading-relaxed" style={{ color: '#000000' }}>
                    {data.uraianPekerjaan || '(Belum ada uraian pekerjaan)'}
                  </div>
                </div>

                {/* Signatures Table Section (3 Equal Columns) */}
                <div className="flex min-h-[70pt] text-[9.5pt] bg-white">
                  {/* Column 1: Prepared By (Employee) */}
                  <div className="w-1/3 border-r border-black flex flex-col justify-between p-2">
                    <div className="font-semibold text-xs" style={{ color: '#000000' }}>
                      Prepared By :
                    </div>
                    <div className="h-12 flex items-center justify-center my-0.5">
                      {data.employeeSignature ? (
                        <img
                          src={data.employeeSignature}
                          alt="Prepared By Signature"
                          className="max-h-11 max-w-[140px] object-contain"
                        />
                      ) : (
                        <span className="text-[8.5pt] italic text-slate-400">
                          ( Ditandatangani digital )
                        </span>
                      )}
                    </div>
                    <div className="text-center font-bold text-xs uppercase truncate" style={{ color: '#000000' }}>
                      {`(${data.namaKaryawan || 'MISKADI'})`}
                    </div>
                  </div>

                  {/* Column 2: Approved By (Director) */}
                  <div className="w-1/3 border-r border-black flex flex-col justify-between p-2">
                    <div className="font-semibold text-xs" style={{ color: '#000000' }}>
                      Approved By :
                    </div>
                    <div className="h-12 flex items-center justify-center my-0.5">
                      {data.directorSignature ? (
                        <img
                          src={data.directorSignature}
                          alt="Approved By Signature"
                          className="max-h-11 max-w-[140px] object-contain"
                        />
                      ) : null}
                    </div>
                    <div className="text-center font-bold text-xs uppercase truncate" style={{ color: '#000000' }}>
                      {data.directorSignature || data.directorName ? `(${data.directorName || 'DIREKTUR UTAMA'})` : ''}
                    </div>
                  </div>

                  {/* Column 3: Paid By (Finance) */}
                  <div className="w-1/3 flex flex-col justify-between p-2">
                    <div className="font-semibold text-xs" style={{ color: '#000000' }}>
                      Paid By :
                    </div>
                    <div className="h-12 flex items-center justify-center my-0.5">
                      {data.financeSignature ? (
                        <img
                          src={data.financeSignature}
                          alt="Paid By Signature"
                          className="max-h-11 max-w-[140px] object-contain"
                        />
                      ) : null}
                    </div>
                    <div className="text-center font-bold text-xs uppercase truncate" style={{ color: '#000000' }}>
                      {data.financeSignature || data.financeName ? `(${data.financeName || 'FINANCE DEPT'})` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stempel Lunas & Tanggal: Di Bawah Tabel & Transparan */}
            {data.isPaid && (
              <div
                className="pointer-events-none select-none flex justify-center mt-2"
                style={{
                  transform: 'rotate(-8deg)',
                  opacity: 0.72,
                }}
              >
                <div
                  style={{
                    border: '3px double rgba(220, 38, 38, 0.85)',
                    borderRadius: '8px',
                    padding: '4px 18px',
                    backgroundColor: 'transparent',
                    color: '#DC2626',
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '180px',
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Arial Black', 'Impact', sans-serif",
                      fontSize: '22pt',
                      fontWeight: 900,
                      letterSpacing: '4px',
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
                      borderTop: '1.5px solid rgba(220, 38, 38, 0.85)',
                      margin: '3px 0 2px 0',
                    }}
                  />
                  <div
                    style={{
                      fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif",
                      fontSize: '9.5pt',
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
                      fontSize: '7pt',
                      fontWeight: 700,
                      letterSpacing: '1.2px',
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

            {/* Footer timestamp */}
            <div className="text-[8pt] text-slate-400 text-right mt-2 pt-1 border-t border-slate-200">
              Dicetak otomatis via Ouffice Enterprise Portal &bull; PT. Citra Sari Kencana
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
