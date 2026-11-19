'use client';

import React, { useState, useTransition } from 'react';
import { ReimbursementRequest, DEPARTMENT_OPTIONS } from '@/types/database';
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
  onClose: () => void;
  onSuccess: (updated: ReimbursementRequest) => void;
}

export default function EditOvertimeModal({
  request,
  onClose,
  onSuccess,
}: EditOvertimeModalProps) {
  const ov = extractOvertimeFromDescription(request.description);

  const [tanggalLembur, setTanggalLembur] = useState(
    ov?.tanggal_lembur || request.request_date || new Date().toISOString().split('T')[0]
  );
  const [tipeHari, setTipeHari] = useState<'hari kerja' | 'hari libur'>(
    ov?.tipe_hari || 'hari kerja'
  );
  const [lokasiLembur, setLokasiLembur] = useState(ov?.lokasi_lembur || 'Kantor');
  const [namaKaryawan, setNamaKaryawan] = useState(
    ov?.nama_karyawan || request.profiles?.full_name || 'Staff'
  );
  const [department, setDepartment] = useState(
    request.department || request.profiles?.department || 'Staff OPS'
  );
  const [perusahaan, setPerusahaan] = useState(
    ov?.perusahaan || request.customer || 'PT. CITRA SARI KENCANA'
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
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>1. Informasi Umum & Waktu</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tanggal Lembur */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                  style={{ colorScheme: 'dark' }}
                />
              </div>

              {/* Tipe Hari */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tipe Hari
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipeHari('hari kerja')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                      tipeHari === 'hari kerja'
                        ? 'bg-orange-500 text-white border-orange-400 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>Hari Kerja</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipeHari('hari libur')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                      tipeHari === 'hari libur'
                        ? 'bg-orange-500 text-white border-orange-400 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>Hari Libur</span>
                  </button>
                </div>
              </div>

              {/* Lokasi Lembur */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-orange-400" />
                  <span>Lokasi Lembur</span>
                </label>
                <input
                  type="text"
                  required
                  value={lokasiLembur}
                  onChange={(e) => setLokasiLembur(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Jam Lembur */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-orange-400" />
                  <span>Jam Lembur</span>
                </label>
                <input
                  type="text"
                  required
                  value={jamLembur}
                  onChange={(e) => setJamLembur(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Nama Karyawan */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nama Karyawan
                </label>
                <input
                  type="text"
                  required
                  value={namaKaryawan}
                  onChange={(e) => setNamaKaryawan(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 uppercase font-semibold"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-orange-400" />
                    <span>Department</span>
                  </span>
                  <span className="text-[10px] text-amber-400/90 font-medium flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Terkunci Otomatis</span>
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={department}
                    className="w-full pl-8 pr-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold cursor-not-allowed select-none shadow-inner"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Deskripsi Pekerjaan */}
          <div className="space-y-3.5 pt-3 border-t border-slate-800">
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              <span>2. Rincian Pekerjaan</span>
            </h3>

            {/* Perusahaan */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-orange-400" />
                <span>Perusahaan / Klien</span>
              </label>
              <input
                type="text"
                required
                value={perusahaan}
                onChange={(e) => setPerusahaan(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Nama Pekerjaan */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nama Pekerjaan
              </label>
              <input
                type="text"
                required
                value={namaPekerjaan}
                onChange={(e) => setNamaPekerjaan(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Uraian Pekerjaan */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3 text-orange-400" />
                <span>Uraian Pekerjaan (Detail Aktivitas)</span>
              </label>
              <textarea
                required
                rows={4}
                value={uraianPekerjaan}
                onChange={(e) => setUraianPekerjaan(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-orange-500 leading-relaxed font-mono"
              />
            </div>

            {/* Nominal Kompensasi */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <span className="text-[10px] font-black text-orange-400 border border-orange-500/40 px-1 py-0.2 rounded bg-orange-500/10 font-mono">
                  RP
                </span>
                <span>Nominal Kompensasi / Uang Lembur (Rp)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  value={nominal}
                  onChange={handleNominalChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-orange-400 font-mono focus:outline-none focus:border-orange-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Isi jika ada perkiraan uang lembur/transport, atau biarkan 0 jika dihitung oleh Direktur.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 pb-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan Lembur</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  );
}
