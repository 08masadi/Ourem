'use client';

import React, { useState, useTransition } from 'react';
import { UserProfile, OvertimeVoucherPrintData, DEPARTMENT_OPTIONS } from '@/types/database';
import { createOvertimeRequest } from '@/actions/requests';
import {
  Clock,
  Calendar,
  MapPin,
  Building2,
  Briefcase,
  FileText,
  DollarSign,
  Printer,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Lock,
} from 'lucide-react';
import OvertimeVoucherPdf from './OvertimeVoucherPdf';

interface OvertimeFormProps {
  userProfile?: UserProfile | null;
}

export default function OvertimeForm({ userProfile }: OvertimeFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [tanggalLembur, setTanggalLembur] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [tipeHari, setTipeHari] = useState<'hari kerja' | 'hari libur'>('hari kerja');
  const [lokasiLembur, setLokasiLembur] = useState('');
  const [namaKaryawan, setNamaKaryawan] = useState(
    userProfile?.full_name || 'Staff'
  );
  const [perusahaan, setPerusahaan] = useState('');
  const [namaPekerjaan, setNamaPekerjaan] = useState('');
  const [jamLembur, setJamLembur] = useState('17:00 - 21:00 (4 Jam)');
  const [uraianPekerjaan, setUraianPekerjaan] = useState('');
  const [nominal, setNominal] = useState('0');
  const [department, setDepartment] = useState(
    userProfile?.department || 'Staff OPS'
  );

  // Preview State
  const [showPreviewPdf, setShowPreviewPdf] = useState(false);

  const previewData: OvertimeVoucherPrintData = {
    tanggalLembur: tanggalLembur.split('-').reverse().join('/'),
    tipeHari,
    lokasiLembur,
    namaKaryawan,
    perusahaan,
    namaPekerjaan: namaPekerjaan || '(Nama Pekerjaan)',
    jamLembur,
    uraianPekerjaan: uraianPekerjaan || '(Belum ada uraian pekerjaan)',
    nominal: Number(nominal.replace(/[^0-9]/g, '')) || 0,
    employeeSignature: userProfile?.signature_url || null,
    directorSignature: null,
    directorName: 'Director / Approver',
    financeSignature: null,
    financeName: 'Finance Dept',
  };

  const handleNominalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (!raw) {
      setNominal('0');
      return;
    }
    const num = Number(raw);
    setNominal(new Intl.NumberFormat('id-ID').format(num));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('tanggal_lembur', tanggalLembur);
    formData.set('tipe_hari', tipeHari);
    formData.set('lokasi_lembur', lokasiLembur);
    formData.set('nama_karyawan', namaKaryawan);
    formData.set('perusahaan', perusahaan);
    formData.set('nama_pekerjaan', namaPekerjaan);
    formData.set('jam_lembur', jamLembur);
    formData.set('uraian_pekerjaan', uraianPekerjaan);
    formData.set('nominal', nominal);
    formData.set('department', department);

    startTransition(async () => {
      try {
        const response = await fetch('/api/requests/overtime', {
          method: 'POST',
          body: formData,
        });

        const res = await response.json().catch(() => null);

        if (!response.ok || res?.error) {
          setError(res?.error || 'Gagal membuat pengajuan lembur.');
        } else if (res?.success) {
          window.location.href = '/employee?success=created_overtime';
        } else {
          window.location.href = '/employee?success=created_overtime';
        }
      } catch (err: any) {
        console.error('Overtime submission error:', err);
        setError(err?.message || 'Gagal membuat pengajuan lembur. Periksa koneksi internet Anda.');
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 p-6 sm:p-8 text-white shadow-2xl">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-bold text-amber-200 border border-white/20 mb-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Formulir Resmi Kerja Lembur</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Pengajuan Form Lembur
          </h1>
          <p className="text-xs sm:text-sm text-orange-100 mt-1 max-w-xl">
            Isi formulir lembur di bawah ini. Dokumen resmi PT. Citra Sari Kencana akan dibuat secara otomatis dan dapat langsung diekspor ke PDF.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form Container */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Section 1: Informasi Waktu & Karyawan */}
        <div>
          <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>1. Informasi Umum & Waktu Lembur</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tanggal Lembur */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Tanggal Lembur
              </label>
              <input
                type="date"
                required
                value={tanggalLembur}
                onChange={(e) => setTanggalLembur(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {}
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* Tipe Hari: Hari Kerja vs Hari Libur */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Kategori Hari
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipeHari('hari kerja')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                    tipeHari === 'hari kerja'
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-md'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] ${
                    tipeHari === 'hari kerja' ? 'border-orange-400 bg-orange-400 text-black font-black' : 'border-slate-600'
                  }`}>
                    {tipeHari === 'hari kerja' ? '✓' : ''}
                  </span>
                  <span>Hari Kerja</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipeHari('hari libur')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                    tipeHari === 'hari libur'
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-md'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] ${
                    tipeHari === 'hari libur' ? 'border-orange-400 bg-orange-400 text-black font-black' : 'border-slate-600'
                  }`}>
                    {tipeHari === 'hari libur' ? '✓' : ''}
                  </span>
                  <span>Hari Libur</span>
                </button>
              </div>
            </div>

            {/* Lokasi Lembur */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-orange-400" />
                <span>Lokasi Lembur</span>
              </label>
              <input
                type="text"
                required
                value={lokasiLembur}
                onChange={(e) => setLokasiLembur(e.target.value)}
                placeholder="Masukkan lokasi lembur..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 placeholder:text-slate-600"
              />
            </div>

            {/* Nama Karyawan */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nama Karyawan
              </label>
              <input
                type="text"
                required
                value={namaKaryawan}
                onChange={(e) => setNamaKaryawan(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 uppercase font-semibold"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-orange-400" />
                <span>Department</span>
              </label>
              <div className="relative">
                <select
                  name="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  {DEPARTMENT_OPTIONS.map((dep) => (
                    <option key={dep} value={dep}>
                      {dep}
                    </option>
                  ))}
                </select>
                <Briefcase className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Jam Lembur */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <span>Jam Lembur</span>
              </label>
              <input
                type="text"
                required
                value={jamLembur}
                onChange={(e) => setJamLembur(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Deskripsi Pekerjaan */}
        <div className="pt-4 border-t border-slate-800">
          <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            <span>2. Rincian & Deskripsi Pekerjaan</span>
          </h2>

          <div className="space-y-4">
            {/* Perusahaan */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-orange-400" />
                <span>Perusahaan / Klien</span>
              </label>
              <input
                type="text"
                required
                value={perusahaan}
                onChange={(e) => setPerusahaan(e.target.value)}
                placeholder="Masukkan nama perusahaan atau klien..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 placeholder:text-slate-600"
              />
            </div>

            {/* Nama Pekerjaan */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nama Pekerjaan
              </label>
              <input
                type="text"
                required
                value={namaPekerjaan}
                onChange={(e) => setNamaPekerjaan(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Uraian Pekerjaan */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-orange-400" />
                <span>Uraian Pekerjaan (Detail Aktivitas)</span>
              </label>
              <textarea
                required
                rows={5}
                value={uraianPekerjaan}
                onChange={(e) => setUraianPekerjaan(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-orange-500 leading-relaxed font-mono"
              />
            </div>

            {/* Nominal Uang Lembur (Terkunci untuk Employee) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-orange-400 border border-orange-500/40 px-1 py-0.2 rounded bg-orange-500/10 font-mono">
                    RP
                  </span>
                  <span>Nominal Kompensasi / Uang Lembur (Rp)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Dihitung Direktur / Finance</span>
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-500">
                  Rp
                </span>
                <input
                  type="text"
                  readOnly
                  disabled
                  value="Dihitung oleh Direktur"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs font-bold text-slate-400 font-mono cursor-not-allowed select-none shadow-inner"
                />
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Nominal kompensasi ditentukan dan diisi oleh Direktur / Finance saat proses persetujuan.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 pb-8 sm:pb-0 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowPreviewPdf(true)}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Lihat Preview Form Lembur</span>
          </button>

          <button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-orange-950/40 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan Pengajuan Lembur...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Kirim Pengajuan Lembur</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* PDF Voucher Modal */}
      {showPreviewPdf && (
        <OvertimeVoucherPdf
          data={previewData}
          onClose={() => setShowPreviewPdf(false)}
        />
      )}
    </div>
  );
}
