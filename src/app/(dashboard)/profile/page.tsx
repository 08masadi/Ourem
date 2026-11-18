'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { getCurrentUserProfile, updateProfileBank, signOutAction } from '@/actions/auth';
import { UserProfile } from '@/types/database';
import {
  User,
  Mail,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Shield,
  Camera,
  Upload,
  Trash2,
  Briefcase,
  PenTool,
  FileCheck,
} from 'lucide-react';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Avatar upload states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Signature upload states
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const data = await getCurrentUserProfile();
      setProfile(data);
      if (data?.avatar_url) {
        setPreviewAvatar(data.avatar_url);
      }
      if (data?.signature_url) {
        setPreviewSignature(data.signature_url);
        try {
          localStorage.setItem('ourem_user_signature', data.signature_url);
          if (data.role === 'finance') {
            localStorage.setItem('ourem_finance_signature', data.signature_url);
            localStorage.setItem('ourem_finance_name', data.full_name || 'Finance Dept');
          }
        } catch {}
      } else {
        try {
          const cachedSig = localStorage.getItem('ourem_user_signature');
          if (cachedSig) {
            setPreviewSignature(cachedSig);
          }
        } catch {}
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('File foto profil harus berupa gambar (JPG, PNG, WebP).');
        return;
      }
      if (file.size > 3 * 1024 * 1024) {
        setError('Ukuran foto profil maksimal 3MB.');
        return;
      }

      setError(null);
      setAvatarFile(file);

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPreviewAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setPreviewAvatar(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.includes('png') && !file.name.toLowerCase().endsWith('.png')) {
        setError('Tanda tangan karyawan harus berupa file gambar format .PNG!');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setError('Ukuran file tanda tangan maksimal 2MB.');
        return;
      }

      setError(null);
      setSignatureFile(file);

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const sigData = event.target.result as string;
          setPreviewSignature(sigData);
          try {
            localStorage.setItem('ourem_user_signature', sigData);
            if (profile?.role === 'finance') {
              localStorage.setItem('ourem_finance_signature', sigData);
              localStorage.setItem('ourem_finance_name', profile.full_name || 'Finance Dept');
            }
          } catch {}
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveSignature = () => {
    setSignatureFile(null);
    setPreviewSignature(null);
    try {
      localStorage.removeItem('ourem_user_signature');
    } catch {}
    if (signatureInputRef.current) {
      signatureInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Save signature to localStorage immediately
    if (previewSignature) {
      try {
        localStorage.setItem('ourem_user_signature', previewSignature);
      } catch {}
    }

    const formData = new FormData(e.currentTarget);
    if (avatarFile) {
      formData.set('avatar_file', avatarFile);
    }
    formData.set('avatar_url', previewAvatar || '');

    if (signatureFile) {
      formData.set('signature_file', signatureFile);
    }
    formData.set('signature_url', previewSignature || '');

    startTransition(async () => {
      const res = await updateProfileBank(formData);
      if (res?.error) {
        setError(res.error);
      } else if (res?.success) {
        setSuccess(res.success);
        if (res.avatar_url) {
          setPreviewAvatar(res.avatar_url);
        }
        if (res.signature_url) {
          setPreviewSignature(res.signature_url);
          try {
            localStorage.setItem('ourem_user_signature', res.signature_url);
            if (profile?.role === 'finance') {
              localStorage.setItem('ourem_finance_signature', res.signature_url);
              localStorage.setItem('ourem_finance_name', profile.full_name || 'Finance Dept');
            }
          } catch {}
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  const roleBadge =
    profile?.role === 'director'
      ? { text: 'Director / Approver', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
      : profile?.role === 'finance'
      ? { text: 'Finance / Payer', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
      : { text: 'Employee / Staff', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white">Profil & Pengaturan Akun</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Kelola foto profil, tanda tangan resmi, data diri, dan rekening bank
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Hidden File Input for Avatar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* Hidden File Input for Signature Upload */}
      <input
        ref={signatureInputRef}
        type="file"
        accept=".png,image/png"
        onChange={handleSignatureChange}
        className="hidden"
      />

      {/* Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* User Identity info dengan FRAME BULAT UPLOAD FOTO */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 border-b border-slate-800 pb-6">
          {/* Frame Bulat Avatar */}
          <div className="relative group shrink-0">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-orange-500/60 hover:border-orange-400 shadow-xl shadow-orange-950/40 overflow-hidden relative cursor-pointer bg-slate-950 transition-all flex items-center justify-center group-hover:scale-105"
              title="Klik untuk ganti foto profil"
            >
              {previewAvatar ? (
                <img
                  src={previewAvatar}
                  alt={profile?.full_name || 'Avatar'}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center text-white text-3xl font-black rounded-full">
                  {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                <Camera className="w-6 h-6 mb-1 text-orange-400" />
                <span className="text-[10px] font-bold">Ubah Foto</span>
              </div>
            </div>

            {/* Floating Camera Button on bottom-right of circle */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-orange-600 hover:bg-orange-500 text-white flex items-center justify-center shadow-lg border-2 border-slate-900 transition cursor-pointer"
              title="Upload Foto Profil"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* User Info & Upload Controls */}
          <div className="flex-1 text-center sm:text-left space-y-1.5">
            <h2 className="text-lg font-bold text-white">{profile?.full_name || 'Pengguna'}</h2>
            <p className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>{profile?.email}</span>
            </p>

            <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${roleBadge.color}`}
              >
                <Shield className="w-3 h-3" />
                <span>{roleBadge.text}</span>
              </span>

              {profile?.department && profile.role !== 'director' && profile.role !== 'finance' && (
                <span className="text-[11px] font-semibold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                  {profile.department}
                </span>
              )}
            </div>

            {/* Tombol aksi foto */}
            <div className="pt-2 flex items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{previewAvatar ? 'Ganti Foto' : 'Pilih Foto'}</span>
              </button>

              {previewAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                  title="Hapus foto profil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 pt-0.5">
              Frame Bulat • Format JPG, PNG, atau WebP (Maks 3MB)
            </p>
          </div>
        </div>

        {/* Bank & Profile Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className={`grid grid-cols-1 ${!(profile?.role === 'director' || profile?.role === 'finance') ? 'sm:grid-cols-2' : ''} gap-4`}>
            <div className={profile?.role === 'director' || profile?.role === 'finance' ? 'max-w-md' : ''}>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-orange-400" />
                <span>Nama Lengkap</span>
              </label>
              <input
                name="full_name"
                type="text"
                defaultValue={profile?.full_name || ''}
                required
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {!(profile?.role === 'director' || profile?.role === 'finance') ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-orange-400" />
                  <span>Department</span>
                </label>
                <select
                  name="department"
                  defaultValue={profile?.department || 'Staff OPS'}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold cursor-pointer"
                >
                  <option value="Staff OPS">Staff OPS</option>
                  <option value="Staff Administration">Staff Administration</option>
                  <option value="Staff Purchasing">Staff Purchasing</option>
                  <option value="Sales Marketing">Sales Marketing</option>
                  <option value="Finance">Finance</option>
                  <option value="Director">Director</option>
                  <option value="Manager">Manager</option>
                </select>
              </div>
            ) : (
              <input
                type="hidden"
                name="department"
                value={profile?.role === 'director' ? 'Director' : 'Finance'}
              />
            )}
          </div>

          {/* INFORMASI REKENING BANK */}
          <div className="pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Informasi Rekening Bank Pembayaran</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Nama Bank</span>
                </label>
                <input
                  name="bank_name"
                  type="text"
                  defaultValue={profile?.bank_name || ''}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nomor Rekening
                </label>
                <input
                  name="bank_account_number"
                  type="text"
                  defaultValue={profile?.bank_account_number || ''}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nama Pemilik Rekening (Sesuai Buku Tabungan)
                </label>
                <input
                  name="bank_account_holder"
                  type="text"
                  defaultValue={profile?.bank_account_holder || ''}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* TANDA TANGAN KARYAWAN (FORMAT .PNG) - PINDAH DARI FORM PENGAJUAN */}
          <div className="pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-orange-400" />
              <span>Foto Tanda Tangan Karyawan (Format .PNG)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">
              Upload foto tanda tangan Anda sekali di sini. Tanda tangan ini akan otomatis terpasang pada setiap voucher PDF reimbursement resmi yang Anda ajukan.
            </p>

            {previewSignature ? (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-700 shadow-inner flex items-center justify-center">
                    <img
                      src={previewSignature}
                      alt="Tanda Tangan Karyawan"
                      className="max-h-16 max-w-[150px] object-contain"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tanda Tangan Resmi Terpasang</span>
                    </div>
                    <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                      Format .PNG • Otomatis masuk ke voucher PDF
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => signatureInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                  >
                    Ganti File
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition cursor-pointer"
                    title="Hapus tanda tangan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => signatureInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-orange-500/60 bg-slate-950/60 rounded-2xl p-5 text-center cursor-pointer transition"
              >
                <PenTool className="w-7 h-7 text-slate-500 mx-auto mb-1.5" />
                <p className="text-xs text-slate-400">
                  <span className="text-orange-400 font-bold">Pilih foto tanda tangan</span> dalam format{' '}
                  <strong className="text-white">.PNG</strong>
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Disarankan menggunakan file .PNG transparan (Maks 2MB)
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              type="submit"
              disabled={isPending}
              className="py-2.5 px-6 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>

        {/* Logout Button */}
        <div className="pt-6 border-t border-slate-800">
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar dari Akun</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
