'use client';

import React, { useState, useTransition } from 'react';
import { ReimbursementRequest, DEPARTMENT_OPTIONS, UserRole } from '@/types/database';
import { updateOvertimeRequest } from '@/actions/requests';
import { extractOvertimeFromDescription, getCleanDescription } from '@/lib/formatters';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Building2,
  Briefcase,
  FileText,
  DollarSign,
  Loader2,
  AlertCircle,
  Save,
  Lock,
} from 'lucide-react';

interface EditOvertimeModalProps {
  request: ReimbursementRequest;
  currentRole?: UserRole;
  onClose: () => void;
  onSuccess: (updated: ReimbursementRequest) => void;
}

export default function EditOvertimeModal({
  request,
  currentRole,
  onClose,
  onSuccess,
}: EditOvertimeModalProps) {
  const canEditNominal = currentRole === 'director' || currentRole === 'finance';
  const ov = extractOvertimeFromDescription(request.description);

  const [tanggalLembur, setTanggalLembur] = useState(
    ov?.tanggal_lembur || request.request_date || new Date().toISOString().split('T')[0]
  );
  const [tipeHari, setTipeHari] = useState<'hari kerja' | 'hari libur'>(
    ov?.tipe_hari || 'hari kerja'
  );
  const [lokasiLembur, setLokasiLembur] = useState(ov?.lokasi_lembur || '');
  const [namaKaryawan, setNamaKaryawan] = useState(
    ov?.nama_karyawan || request.profiles?.full_name || 'Staff'
  );
  const [department, setDepartment] = useState(
    request.department || request.profiles?.department || 'Staff OPS'
  );
  const [perusahaan, setPerusahaan] = useState(
    ov?.perusahaan || request.customer || ''
  );
  const [namaPekerjaan, setNamaPekerjaan] = useState(
    ov?.nama_pekerjaan || request.title.replace(/^Form Lembur - /, '')
  );
  const [jamLembur, setJamLembur] = useState(ov?.jam_lembur || '');
  const [uraianPekerjaan, setUraianPekerjaan] = useState(
    ov?.uraian_pekerjaan || getCleanDescription(request.description)
  );
  const [nominal, setNominal] = useState(() => {
    if (ov?.nominal && ov.nominal > 0) {
      return new Intl.NumberFormat('id-ID').format(ov.nominal);
    }
    const num = Number(request.amount) || 0;
    if (num > 1) {
      return new Intl.NumberFormat('id-ID').format(num);
    }
    return '0';
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

    if (!namaPekerjaan.trim() || !jamLembur.trim() || !uraianPekerjaan.trim()) {
      setError('Nama pekerjaan, jam lembur, dan uraian pekerjaan wajib diisi.');
      return;
    }

    const formData = new FormData();
    formData.set('id', request.id);
    formData.set('tanggal_lembur', tanggalLembur);
    formData.set('tipe_hari', tipeHari);
    formData.set('lokasi_lembur', lokasiLembur);
    formData.set('nama_karyawan', namaKaryawan);
    formData.set('department', department);
    formData.set('perusahaan', perusahaan);
    formData.set('nama_pekerjaan', namaPekerjaan);
    formData.set('jam_lembur', jamLembur);
    formData.set('uraian_pekerjaan', uraianPekerjaan);
    formData.set('nominal', nominal);

    startTransition(async () => {
      const res = await updateOvertimeRequest(null, formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.data) {
        onSuccess(res.data);
      }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/85 backdrop-blur-sm">
      <div className="flex min-h-full items-start sm:items-center justify-center p-3 sm:p-4 pb-28 sm:pb-6">
        <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl my-auto sm:my-6 mb-24 sm:mb-6 flex flex-col max-h-[90vh]">
          {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Edit Pengajuan Form Lembur
              </h2>
              <p className="text-xs text-slate-400">
                Perbarui rincian lembur, jam kerja, dan uraian pekerjaan
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 pr-1 space-y-5">
          {/* Section 1: Informasi Waktu & Karyawan */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>1. Informasi Umum & Waktu</span>
            </h3>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              {/* Tanggal Lembur */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                  style={{ colorScheme: 'dark' }}
                />
              </div>

              {/* Tipe Hari */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5">
                  Kategori Hari
                </label>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setTipeHari('hari kerja')}
                    className={`py-2.5 sm:py-3 px-1 sm:px-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                      tipeHari === 'hari kerja'
                        ? 'bg-orange-500 text-white border-orange-400 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span><span className="hidden sm:inline">Hari </span>Kerja</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipeHari('hari libur')}
                    className={`py-2.5 sm:py-3 px-1 sm:px-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                      tipeHari === 'hari libur'
                        ? 'bg-orange-500 text-white border-orange-400 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span><span className="hidden sm:inline">Hari </span>Libur</span>
                  </button>
                </div>
              </div>

              {/* Lokasi Lembur */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span className="truncate">Lokasi Lembur</span>
                </label>
                <input
                  type="text"
                  required
                  value={lokasiLembur}
                  onChange={(e) => setLokasiLembur(e.target.value)}
                  placeholder="Masukkan lokasi lembur..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm text-white focus:outline-none focus:border-orange-500 placeholder:text-slate-600"
                />
              </div>

              {/* Jam Lembur */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span className="truncate">Jam Lembur</span>
                </label>
                <input
                  type="text"
                  required
                  value={jamLembur}
                  onChange={(e) => setJamLembur(e.target.value)}
                  placeholder="Masukkan jam lembur"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Nama Karyawan */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5">
                  Nama Karyawan
                </label>
                <input
                  type="text"
                  required
                  value={namaKaryawan}
                  onChange={(e) => setNamaKaryawan(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm text-white focus:outline-none focus:border-orange-500 uppercase font-semibold"
                />
              </div>

              {/* Department (Terkunci) */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="truncate">Department</span>
                  <span className="text-[10px] sm:text-xs text-slate-400 font-normal flex items-center gap-0.5 shrink-0">
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
                    className="w-full pl-8 pr-3 py-2.5 sm:pl-9 sm:pr-3.5 sm:py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-slate-200 font-semibold cursor-not-allowed select-none opacity-90 truncate"
                  />
                  <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input type="hidden" name="department" value={department} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Deskripsi Pekerjaan */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              <span>2. Rincian Pekerjaan</span>
            </h3>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              {/* Perusahaan */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span className="truncate">Perusahaan / Klien</span>
                </label>
                <input
                  type="text"
                  required
                  value={perusahaan}
                  onChange={(e) => setPerusahaan(e.target.value)}
                  placeholder="Masukkan nama perusahaan atau klien..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm text-white focus:outline-none focus:border-orange-500 placeholder:text-slate-600"
                />
              </div>

              {/* Nama Pekerjaan */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span className="truncate">Nama Pekerjaan</span>
                </label>
                <input
                  type="text"
                  required
                  value={namaPekerjaan}
                  onChange={(e) => setNamaPekerjaan(e.target.value)}
                  placeholder="Nama pekerjaan..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Uraian Pekerjaan */}
              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>Uraian Pekerjaan (Detail Aktivitas)</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={uraianPekerjaan}
                  onChange={(e) => setUraianPekerjaan(e.target.value)}
                  placeholder="Jelaskan rincian aktivitas pekerjaan lembur..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 sm:p-3.5 text-sm text-white focus:outline-none focus:border-orange-500 leading-relaxed font-mono"
                />
              </div>

              {/* Nominal Kompensasi */}
              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-orange-400 border border-orange-500/40 px-1 py-0.2 rounded bg-orange-500/10 font-mono">
                      RP
                    </span>
                    <span>Nominal Kompensasi / Uang Lembur (Rp)</span>
                  </span>
                  {canEditNominal ? (
                    <span className="text-[10px] sm:text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Dapat Diisi (Mode {currentRole === 'director' ? 'Director' : 'Finance'})
                    </span>
                  ) : (
                    <span className="text-[10px] sm:text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Dihitung Direktur / Finance</span>
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className={`absolute left-3 top-2.5 sm:top-3 text-sm font-bold ${canEditNominal ? 'text-slate-400' : 'text-slate-500'}`}>
                    Rp
                  </span>
                  {canEditNominal ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={nominal}
                      onChange={handleNominalChange}
                      placeholder="0"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 sm:py-3 text-sm font-bold text-orange-400 font-mono focus:outline-none focus:border-orange-500"
                    />
                  ) : (
                    <>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={nominal === '0' || !nominal ? 'Dihitung oleh Direktur' : nominal}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-8 py-2.5 sm:py-3 text-sm font-bold text-slate-400 font-mono cursor-not-allowed select-none shadow-inner"
                      />
                      <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    </>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                  {canEditNominal
                    ? 'Masukkan nominal kompensasi / uang lembur yang disetujui untuk karyawan.'
                    : 'Hanya akun Direktur dan Finance yang dapat mengisi dan menentukan nominal kompensasi lembur.'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons: 2 Kolom dalam 1 Baris, Icon Saja */}
          <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2.5 sm:gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="w-full py-2.5 sm:py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
              title="Batal"
              aria-label="Batal"
            >
              <X className="w-5 h-5" />
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-950/30 transition flex items-center justify-center disabled:opacity-50 cursor-pointer active:scale-95"
              title="Simpan Perubahan Lembur"
              aria-label="Simpan Perubahan Lembur"
            >
              {isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  );
}
