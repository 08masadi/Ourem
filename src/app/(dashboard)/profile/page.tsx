'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { getCurrentUserProfile, updateProfileBank, uploadAvatarAction, signOutAction } from '@/actions/auth';
import { compressImageFile } from '@/lib/imageCompressor';
import { UserProfile, DEPARTMENT_OPTIONS } from '@/types/database';
import AvatarCropperModal from '@/components/profile/AvatarCropperModal';
import { triggerSuccessNotification } from '@/components/ui/DynamicIslandSuccess';
import ModernLoader from '@/components/ui/ModernLoader';
import NeonVortexLoader from '@/components/ui/NeonVortexLoader';
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
  X,
  ZoomIn,
  Phone,
  Hash,
  Lock,
} from 'lucide-react';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showLargeAvatar, setShowLargeAvatar] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Controlled form states
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('Staff Operasional');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');

  // Avatar upload states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [cropperRawSrc, setCropperRawSrc] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Signature upload states
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const data = await getCurrentUserProfile();
      setProfile(data);
      if (data) {
        const storedPhone = typeof window !== 'undefined' ? localStorage.getItem('ourem_user_phone') : null;
        const storedId = typeof window !== 'undefined' ? localStorage.getItem('ourem_user_employee_id') : null;
        const defaultPhone = data.phone || storedPhone || (data.email?.includes('miskadi') ? '085710002923' : '');
        const defaultId = data.employee_id || storedId || (data.email?.includes('miskadi') ? 'CSK-007' : '');

        setFullName(data.full_name || '');
        const currentDept = data.department === 'Staff OPS' || !data.department ? 'Staff Operasional' : data.department;
        setDepartment(currentDept);
        setPhone(defaultPhone);
        setEmployeeId(defaultId);
        setBankName(data.bank_name || '');
        setBankAccountNumber(data.bank_account_number || '');
        setBankAccountHolder(data.bank_account_holder || '');

        try {
          if (defaultPhone) localStorage.setItem('ourem_user_phone', defaultPhone);
          if (defaultId) localStorage.setItem('ourem_user_employee_id', defaultId);
        } catch {}
      }
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
          if (data.role === 'director') {
            localStorage.setItem('ourem_director_signature', data.signature_url);
            localStorage.setItem('ourem_director_name', data.full_name || 'DIREKTUR UTAMA');
          }
        } catch {}
      } else {
        // Jangan gunakan signature akun lain yang tersimpan di localStorage!
        setPreviewSignature(null);
        try {
          localStorage.removeItem('ourem_user_signature');
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
      if (file.size > 10 * 1024 * 1024) {
        setError('Ukuran foto profil maksimal 10MB.');
        return;
      }

      setError(null);
      setAvatarFile(file);

      // Buka modal cropper dengan fitur geser & zoom
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCropperRawSrc(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);

      // Reset value agar bisa memilih file yang sama jika diinginkan
      e.target.value = '';
    }
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    setIsUploadingAvatar(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('avatar_data', croppedDataUrl);

      const res = await uploadAvatarAction(formData);
      if (res.error) {
        setError(res.error);
      } else if (res.avatar_url) {
        setPreviewAvatar(res.avatar_url);
        setProfile((prev) => (prev ? { ...prev, avatar_url: res.avatar_url || null } : prev));
        setSuccess('Foto profil berhasil diatur dan disimpan!');
        setCropperRawSrc(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan foto profil.');
    } finally {
      setIsUploadingAvatar(false);
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

    // Save signature, phone, and employee ID to localStorage immediately
    if (previewSignature) {
      try {
        localStorage.setItem('ourem_user_signature', previewSignature);
      } catch {}
    }
    try {
      if (phone) {
        localStorage.setItem('ourem_user_phone', phone);
        if (profile?.id) localStorage.setItem(`ourem_phone_${profile.id}`, phone);
      }
      if (employeeId) {
        localStorage.setItem('ourem_user_employee_id', employeeId);
        if (profile?.id) localStorage.setItem(`ourem_employee_id_${profile.id}`, employeeId);
      }
    } catch {}

    const formData = new FormData(e.currentTarget);
    formData.set('avatar_url', previewAvatar || '');
    formData.set('signature_url', previewSignature || '');

    if (signatureFile) {
      formData.set('signature_file', signatureFile);
    }

    startTransition(async () => {
      if (avatarFile) {
        try {
          const compressed = await compressImageFile(avatarFile, 600, 0.85);
          formData.set('avatar_file', compressed);
        } catch {
          formData.set('avatar_file', avatarFile);
        }
      }

      const res = await updateProfileBank(formData);
      if (res?.error) {
        setError(res.error);
      } else if (res?.success) {
        setSuccess(res.success);
        triggerSuccessNotification(
          'Perubahan Berhasil Disimpan',
          'Data profil dan informasi rekening bank pembayaran Anda telah disimpan.'
        );
        if (res.avatar_url) {
          setPreviewAvatar(res.avatar_url);
        }
        if (res.signature_url) {
          setPreviewSignature(res.signature_url);
          try {
            localStorage.setItem('ourem_user_signature', res.signature_url);
            if (profile?.role === 'finance') {
              localStorage.setItem('ourem_finance_signature', res.signature_url);
              localStorage.setItem('ourem_finance_name', fullName || profile.full_name || 'Finance Dept');
            }
            if (profile?.role === 'director') {
              localStorage.setItem('ourem_director_signature', res.signature_url);
              localStorage.setItem('ourem_director_name', fullName || profile.full_name || 'DIREKTUR UTAMA');
            }
          } catch {}
        }
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                full_name: fullName,
                department: department,
                phone: phone,
                employee_id: employeeId,
                bank_name: bankName,
                bank_account_number: bankAccountNumber,
                bank_account_holder: bankAccountHolder,
                avatar_url: res.avatar_url || prev.avatar_url,
                signature_url: res.signature_url || prev.signature_url,
              }
            : null
        );
      }
    });
  };

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center py-10 px-4">
        <NeonVortexLoader
          size="md"
          label="Memuat Profil & Rekening..."
        />
      </div>
    );
  }

  const roleBadge =
    profile?.role === 'director'
      ? { text: 'Director / Approver', color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30' }
      : profile?.role === 'finance'
      ? { text: 'Finance / Payer', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30' }
      : { text: 'Employee / Staff', color: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700' };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Profil & Pengaturan Akun</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
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
      <div className="bg-slate-900 border-0 shadow-md shadow-slate-200/50 dark:shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6">
        {/* User Identity info dengan FRAME BULAT UPLOAD FOTO */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 border-b border-slate-100 dark:border-slate-800/60 pb-6">
          {/* Frame Bulat Avatar (Klik untuk melihat tampilan besar) */}
          <div className="relative group shrink-0">
            <div
              onClick={() => setShowLargeAvatar(true)}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-orange-500 hover:border-orange-400 shadow-xl shadow-orange-500/30 ring-2 ring-orange-500/20 overflow-hidden relative cursor-pointer bg-slate-950 transition-all flex items-center justify-center group-hover:scale-105 active:scale-95"
              title="Klik untuk perbesar foto profil"
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

              {/* Hover / Tap Overlay untuk perbesar */}
              <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity preserve-white">
                <ZoomIn className="w-6 h-6 mb-1 text-orange-400" />
                <span className="text-[10px] font-bold text-white preserve-white" style={{ color: '#ffffff' }}>Lihat Foto</span>
              </div>
            </div>
          </div>

          {/* User Info & Upload Controls */}
          <div className="flex-1 text-center sm:text-left space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Pengguna'}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>{profile?.email}</span>
            </p>

            <div className="pt-1 flex items-center justify-center sm:justify-start gap-2">
              {profile?.role && profile.role !== 'employee' && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${roleBadge.color}`}
                >
                  <Shield className="w-3 h-3" />
                  <span>{roleBadge.text}</span>
                </span>
              )}

              {profile?.department && (
                <span className="text-[11px] font-bold text-slate-900 bg-slate-100 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 px-3 py-0.5 rounded-full shadow-sm">
                  {profile.department}
                </span>
              )}
            </div>

            {/* Tombol aksi foto */}
            <div className="pt-2 flex items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm text-xs font-bold"
                title={previewAvatar ? 'Ganti Foto Profil' : 'Pilih Foto Profil'}
                aria-label={previewAvatar ? 'Ganti Foto Profil' : 'Pilih Foto Profil'}
              >
                <Upload className="w-4 h-4 text-orange-500" />
                <span>{previewAvatar ? 'Ganti Foto' : 'Upload Foto'}</span>
              </button>

              {previewAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-500/10 dark:text-slate-300 dark:hover:text-rose-400 border border-slate-200/80 dark:border-slate-700 hover:border-rose-300 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 flex items-center justify-center cursor-pointer shadow-sm"
                  title="Hapus foto profil"
                  aria-label="Hapus foto profil"
                >
                  <Trash2 className="w-4 h-4 text-slate-500 hover:text-rose-600" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 pt-0.5">
              Format JPG, PNG, atau WebP (Maks 3MB)
            </p>
          </div>
        </div>

        {/* Bank & Profile Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={`grid grid-cols-2 gap-2.5 sm:gap-4`}>
            <div className={profile?.role === 'director' || profile?.role === 'finance' ? 'col-span-2 sm:max-w-md' : ''}>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-orange-400 shrink-0" />
                <span className="truncate">Nama Lengkap</span>
              </label>
              <input
                name="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
              />
            </div>

            {!(profile?.role === 'director' || profile?.role === 'finance') ? (
              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center justify-between">
                  <span className="truncate">Department</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-normal flex items-center gap-0.5 shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                    Terkunci
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={department}
                    className="w-full pl-7 pr-2.5 py-1.5 sm:pl-8 sm:pr-3 sm:py-2 bg-slate-100 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 font-bold cursor-not-allowed select-none opacity-90 truncate"
                  />
                  <Briefcase className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input type="hidden" name="department" value={department} />
                </div>
              </div>
            ) : (
              <input
                type="hidden"
                name="department"
                value={profile?.role === 'director' ? 'Director' : 'Finance'}
              />
            )}
          </div>

          {/* Kolom ID Karyawan dan Nomor Telepon (Phone) - 2 Kolom per baris di mobile */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                <Hash className="w-3 h-3 text-orange-400 shrink-0" />
                <span className="truncate">ID Karyawan</span>
              </label>
              <input
                name="employee_id"
                type="text"
                placeholder="Contoh: CSK-003"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-orange-400 shrink-0" />
                <span className="truncate">No. HP / WA</span>
              </label>
              <input
                name="phone"
                type="text"
                placeholder="Contoh: 0882 3991 9129"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* INFORMASI REKENING BANK - 2 Kolom per baris di mobile */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Informasi Rekening Bank Pembayaran</span>
            </h3>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">Nama Bank</span>
                </label>
                <input
                  name="bank_name"
                  type="text"
                  placeholder="Contoh: BCA"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 truncate">
                  Nomor Rekening
                </label>
                <input
                  name="bank_account_number"
                  type="text"
                  placeholder="Contoh: 1234567890"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-200 mb-1 truncate">
                  Nama Pemilik Rekening (Sesuai Buku Tabungan)
                </label>
                <input
                  name="bank_account_holder"
                  type="text"
                  placeholder="Nama lengkap pemilik rekening"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* TANDA TANGAN KARYAWAN (FORMAT .PNG) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-orange-400" />
              <span>Foto Tanda Tangan Karyawan (Format .PNG)</span>
            </h3>

            {previewSignature ? (
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-3 shadow-sm">
                <div className="bg-white p-2 rounded-lg border border-slate-200/70 dark:border-slate-700 flex items-center justify-center shrink-0">
                  <img
                    src={previewSignature}
                    alt="Tanda Tangan Karyawan"
                    className="max-h-11 max-w-[130px] sm:max-h-14 sm:max-w-[160px] object-contain"
                  />
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => signatureInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 text-orange-500" />
                    <span>Ganti File</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer shadow-sm"
                    title="Hapus tanda tangan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => signatureInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200/80 dark:border-slate-800 hover:border-orange-500/60 bg-slate-50/50 dark:bg-slate-950/60 rounded-xl p-4 text-center cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-98"
              >
                <PenTool className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                <p className="text-xs text-slate-400">
                  <span className="text-orange-400 font-bold">Pilih foto tanda tangan</span> (.PNG)
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Disarankan file transparan (Maks 2MB)
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              type="submit"
              disabled={isPending}
              className="py-2.5 px-6 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white text-xs font-bold rounded-xl shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>

        {/* Logout Button */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60">
          <form
            action={signOutAction}
            onSubmit={() => {
              try {
                localStorage.removeItem('ourem_user_signature');
                localStorage.removeItem('ourem_finance_signature');
                localStorage.removeItem('ourem_director_signature');
                localStorage.removeItem('ourem_finance_name');
                localStorage.removeItem('ourem_director_name');
              } catch {}
            }}
          >
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar dari Akun</span>
            </button>
          </form>
        </div>
      </div>

      {/* Modal Cropper Foto Profil (Geser & Zoom) */}
      {cropperRawSrc && (
        <AvatarCropperModal
          imageSrc={cropperRawSrc}
          isUploading={isUploadingAvatar}
          onClose={() => setCropperRawSrc(null)}
          onCropComplete={handleCropComplete}
        />
      )}

      {/* Modal Tampilan Foto Profil Besar */}
      {showLargeAvatar && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowLargeAvatar(false)}
        >
          <div
            className="relative max-w-sm sm:max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowLargeAvatar(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5">
              Foto Profil Akun
            </h3>

            <div className="w-52 h-52 sm:w-64 sm:h-64 rounded-full border-4 border-orange-500 shadow-2xl shadow-orange-950/60 overflow-hidden bg-slate-950 flex items-center justify-center mb-4">
              {previewAvatar ? (
                <img
                  src={previewAvatar}
                  alt={profile?.full_name || 'Foto Profil'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center text-white text-6xl font-black">
                  {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>

            <p className="text-base font-bold text-white">{profile?.full_name || 'Pengguna'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{profile?.email}</p>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              {profile?.department === 'Staff OPS' || profile?.department === 'STAFF OPS'
                ? 'Staff Operasional'
                : profile?.department ||
                  (profile?.role === 'director'
                    ? 'Director'
                    : profile?.role === 'finance'
                    ? 'Finance'
                    : 'Staff Operasional')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
