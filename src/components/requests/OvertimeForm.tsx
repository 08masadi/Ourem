'use client';

import React, { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
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

const OvertimeVoucherPdf = dynamic(() => import('./OvertimeVoucherPdf'), { ssr: false });

interface OvertimeFormProps {
  userProfile?: UserProfile | null;
}

export default function OvertimeForm({ userProfile }: OvertimeFormProps) {
  const router = useRouter();
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
  const [jamLembur, setJamLembur] = useState('');
  const [uraianPekerjaan, setUraianPekerjaan] = useState('');
  const [nominal, setNominal] = useState('0');
  const [department, setDepartment] = useState(
    userProfile?.department === 'Staff OPS' || !userProfile?.department
      ? 'Staff Operasional'
      : userProfile.department
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
        } else {
          router.push('/employee?success=created_overtime');
          router.refresh();
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Pengajuan Form Lembur
          </h1>
          <p className="text-xs sm:text-sm text-orange-100 mt-1 max-w-xl">
            Isi formulir lembur di bawah ini. Dokumen resmi PT. Citra Sari Kencana akan dibuat secara otomatis dan dapat langsung diekspor ke PDF.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form Container */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm dark:shadow-2xl space-y-4 sm:space-y-5">
        {/* Section 1: Informasi Waktu & Karyawan */}
        <div>
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 border-b border-slate-200 dark:border-slate-800 pb-1.5">
            1. Informasi Umum & Waktu Lembur
          </h2>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            {/* Tanggal Lembur */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate">Tanggal Lembur</span>
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
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              />
            </div>

            {/* Tipe Hari: Hari Kerja vs Hari Libur */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Kategori Hari
              </label>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setTipeHari('hari kerja')}
                  className={`py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-xl text-xs sm:text-sm font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    tipeHari === 'hari kerja'
                      ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/50 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] ${
                    tipeHari === 'hari kerja' ? 'border-orange-500 bg-orange-500 text-white font-black' : 'border-slate-400'
                  }`}>
                    {tipeHari === 'hari kerja' ? '✓' : ''}
                  </span>
                  <span><span className="hidden sm:inline">Hari </span>Kerja</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipeHari('hari libur')}
                  className={`py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-xl text-xs sm:text-sm font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    tipeHari === 'hari libur'
                      ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/50 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] ${
                    tipeHari === 'hari libur' ? 'border-orange-500 bg-orange-500 text-white font-black' : 'border-slate-400'
                  }`}>
                    {tipeHari === 'hari libur' ? '✓' : ''}
                  </span>
                  <span><span className="hidden sm:inline">Hari </span>Libur</span>
                </button>
              </div>
            </div>

            {/* Lokasi Lembur */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate">Lokasi Lembur</span>
              </label>
              <input
                type="text"
                required
                value={lokasiLembur}
                onChange={(e) => setLokasiLembur(e.target.value)}
                placeholder="Masukkan lokasi lembur..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-slate-400"
              />
            </div>

            {/* Jam Lembur */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate">Jam Lembur</span>
              </label>
              <input
                type="text"
                required
                value={jamLembur}
                onChange={(e) => setJamLembur(e.target.value)}
                placeholder="Masukkan jam lembur"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-slate-400 font-mono"
              />
            </div>

            {/* Nama Karyawan */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Karyawan
              </label>
              <input
                type="text"
                required
                value={namaKaryawan}
                onChange={(e) => setNamaKaryawan(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase font-semibold"
              />
            </div>

            {/* Department (Terkunci) */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="truncate">Department</span>
                <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-normal flex items-center gap-0.5 shrink-0">
                  <Lock className="w-3 h-3" />
                  Terkunci
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  readOnly
                  value={department}
                  className="w-full pl-8 pr-3 py-2.5 sm:pl-9 sm:pr-3.5 sm:py-3 bg-slate-100 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 font-semibold cursor-not-allowed select-none opacity-90 truncate"
                />
                <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input type="hidden" name="department" value={department} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Deskripsi Pekerjaan */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 border-b border-slate-200 dark:border-slate-800 pb-1.5">
            2. Rincian & Deskripsi Pekerjaan
          </h2>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            {/* Perusahaan */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">Perusahaan / Klien</span>
              </label>
              <input
                type="text"
                required
                value={perusahaan}
                onChange={(e) => setPerusahaan(e.target.value)}
                placeholder="Masukkan nama perusahaan..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-slate-400"
              />
            </div>

            {/* Nama Pekerjaan */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">Nama Pekerjaan</span>
              </label>
              <input
                type="text"
                required
                value={namaPekerjaan}
                onChange={(e) => setNamaPekerjaan(e.target.value)}
                placeholder="Nama pekerjaan..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-slate-400"
              />
            </div>

            {/* Uraian Pekerjaan */}
            <div className="col-span-2">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Uraian Pekerjaan (Detail Aktivitas)
              </label>
              <textarea
                required
                rows={3}
                value={uraianPekerjaan}
                onChange={(e) => setUraianPekerjaan(e.target.value)}
                placeholder="Jelaskan rincian aktivitas pekerjaan lembur..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 leading-relaxed font-mono placeholder:text-slate-400"
              />
            </div>

            {/* Nominal Uang Lembur (Terkunci untuk Employee) */}
            <div className="col-span-2">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Nominal Kompensasi / Uang Lembur (Rp)</span>
                <span className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Dihitung Direktur / Finance</span>
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 sm:top-3 text-sm font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  readOnly
                  disabled
                  value="Dihitung oleh Direktur"
                  className="w-full bg-slate-100 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-8 py-2.5 sm:py-3 text-sm font-bold text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed select-none shadow-inner"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                Nominal kompensasi ditentukan dan diisi oleh Direktur / Finance saat proses persetujuan.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: 2 Kolom dalam 1 baris, Icon Saja */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2.5 sm:gap-4">
          <button
            type="button"
            onClick={() => setShowPreviewPdf(true)}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
            title="Lihat Preview Form Lembur"
            aria-label="Lihat Preview Form Lembur"
          >
            <Printer className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-950/30 transition flex items-center justify-center disabled:opacity-50 cursor-pointer active:scale-95"
            title="Kirim Pengajuan Lembur"
            aria-label="Kirim Pengajuan Lembur"
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
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
