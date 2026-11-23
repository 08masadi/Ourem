'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { createReimbursement } from '@/actions/requests';
import { getCurrentUserProfile } from '@/actions/auth';
import { ReimbursementType, UserProfile, DEPARTMENT_OPTIONS } from '@/types/database';
import {
  AccountBlockData,
  formatAccountBlocksToDescription,
} from '@/lib/formatters';
import {
  Calendar,
  DollarSign,
  FileText,
  Upload,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Building,
  Briefcase,
  Layers,
  List,
  Trash2,
  Plus,
  PlusCircle,
  CheckCircle2,
  Camera,
  Crop,
  Lock,
  X,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import ImageCropperModal from './ImageCropperModal';

interface AccountBlockState {
  id: string;
  account: string;
  amount: string;
  receipt_date: string;
  receiptFile: File | null;
  receiptPreview: string | null;
  entries: Array<{
    customer: string;
    description: string;
    receipt_date?: string;
  }>;
}

async function compressImageFile(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            resolve(new File([blob], cleanName, { type: 'image/jpeg', lastModified: Date.now() }));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export default function RequestForm() {
  const [reimbursementType, setReimbursementType] = useState<ReimbursementType>('Petty Cash');
  const [department, setDepartment] = useState<string>('Staff OPS');
  const [requestDate, setRequestDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Profile data for auto-attaching signature and department
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Dynamic account blocks
  const [blocks, setBlocks] = useState<AccountBlockState[]>([
    {
      id: 'block-1',
      account: 'Bensin',
      amount: '',
      receipt_date: new Date().toISOString().split('T')[0],
      receiptFile: null,
      receiptPreview: null,
      entries: [{ customer: '', description: '', receipt_date: new Date().toISOString().split('T')[0] }],
    },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [submittingStatus, setSubmittingStatus] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  // Input refs for direct camera vs gallery
  const cameraInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const galleryInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // Image Cropper Modal State
  const [cropperState, setCropperState] = useState<{
    isOpen: boolean;
    blockIndex: number;
    imageSrc: string | null;
    fileName: string;
  }>({
    isOpen: false,
    blockIndex: 0,
    imageSrc: null,
    fileName: '',
  });

  const handleInitiateCrop = (blockIndex: number, file: File | null) => {
    if (!file) return;

    // Jika file PDF, langsung simpan tanpa cropping
    if (file.type === 'application/pdf') {
      handleBlockFileChange(blockIndex, file);
      return;
    }

    // Untuk foto (kamera / galeri), buka Cropper Modal untuk atur posisi & crop
    const reader = new FileReader();
    reader.onload = () => {
      setCropperState({
        isOpen: true,
        blockIndex,
        imageSrc: reader.result as string,
        fileName: file.name || `nota-${Date.now()}.jpg`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedFile: File, previewUrl: string) => {
    setBlocks((prev) =>
      prev.map((b, idx) => {
        if (idx !== cropperState.blockIndex) return b;
        return {
          ...b,
          receiptFile: croppedFile,
          receiptPreview: previewUrl,
        };
      })
    );
  };

  const handleReCrop = (blockIndex: number) => {
    const block = blocks[blockIndex];
    if (block?.receiptPreview) {
      setCropperState({
        isOpen: true,
        blockIndex,
        imageSrc: block.receiptPreview,
        fileName: block.receiptFile?.name || 'nota.jpg',
      });
    }
  };

  useEffect(() => {
    async function loadProfile() {
      const p = await getCurrentUserProfile();
      if (p) {
        setUserProfile(p);
        if (p.department) {
          setDepartment(p.department);
        }
      }
    }
    loadProfile();
  }, []);

  const handleTypeChange = (newType: ReimbursementType) => {
    setReimbursementType(newType);
    const defaultAcc = newType === 'Petty Cash' ? 'Bensin' : 'Material';
    setBlocks((prev) =>
      prev.map((b) => ({
        ...b,
        account: defaultAcc,
      }))
    );
  };

  // Block management
  const addAccountBlock = () => {
    const defaultAcc = reimbursementType === 'Petty Cash' ? 'Parkir' : 'Konsumsi Lainnya';
    setBlocks((prev) => [
      ...prev,
      {
        id: `block-${Date.now()}-${prev.length + 1}`,
        account: defaultAcc,
        amount: '',
        receipt_date: requestDate,
        receiptFile: null,
        receiptPreview: null,
        entries: [{ customer: '', description: '', receipt_date: requestDate }],
      },
    ]);
  };

  const removeAccountBlock = (blockIndex: number) => {
    if (blocks.length <= 1) return;
    setBlocks((prev) => prev.filter((_, idx) => idx !== blockIndex));
  };

  const updateBlockField = (
    blockIndex: number,
    field: 'account' | 'amount' | 'receipt_date',
    value: string
  ) => {
    setBlocks((prev) =>
      prev.map((b, idx) => {
        if (idx !== blockIndex) return b;
        if (field === 'amount') {
          const val = value.replace(/[^0-9]/g, '');
          return { ...b, amount: val };
        }
        if (field === 'receipt_date') {
          return {
            ...b,
            receipt_date: value,
            entries: b.entries.map((e) => ({ ...e, receipt_date: value })),
          };
        }
        return { ...b, [field]: value };
      })
    );
  };

  const handleBlockFileChange = (blockIndex: number, file: File | null) => {
    setBlocks((prev) =>
      prev.map((b, idx) => {
        if (idx !== blockIndex) return b;
        return {
          ...b,
          receiptFile: file,
          receiptPreview: file ? URL.createObjectURL(file) : null,
        };
      })
    );
  };

  // Customer & Description entry management per block
  const addCustomerToBlock = (blockIndex: number) => {
    setBlocks((prev) =>
      prev.map((b, idx) => {
        if (idx !== blockIndex) return b;
        return {
          ...b,
          entries: [...b.entries, { customer: '', description: '', receipt_date: b.receipt_date || requestDate }],
        };
      })
    );
  };

  const removeCustomerFromBlock = (blockIndex: number, entryIndex: number) => {
    setBlocks((prev) =>
      prev.map((b, idx) => {
        if (idx !== blockIndex) return b;
        if (b.entries.length <= 1) return b;
        return {
          ...b,
          entries: b.entries.filter((_, eIdx) => eIdx !== entryIndex),
        };
      })
    );
  };

  const updateCustomerEntry = (
    blockIndex: number,
    entryIndex: number,
    field: 'customer' | 'description' | 'receipt_date',
    value: string
  ) => {
    setBlocks((prev) =>
      prev.map((b, bIdx) => {
        if (bIdx !== blockIndex) return b;
        return {
          ...b,
          entries: b.entries.map((e, eIdx) =>
            eIdx === entryIndex ? { ...e, [field]: value } : e
          ),
        };
      })
    );
  };

  // Calculate total amount across all blocks
  const totalAmount = blocks.reduce((acc, curr) => {
    const num = Number(curr.amount) || 0;
    return acc + num;
  }, 0);

  const formattedTotalAmount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(totalAmount);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (totalAmount <= 0) {
      setError('Mohon isi nominal amount minimal pada satu account (harus lebih dari Rp 0).');
      return;
    }

    // Verify each block has at least one valid customer or description
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const hasContent = b.entries.some(
        (e) => e.customer.trim() || e.description.trim()
      );
      if (!hasContent) {
        setError(`Mohon lengkapi minimal satu baris Customer atau Description pada Account #${i + 1} (${b.account}).`);
        return;
      }
    }

    startTransition(async () => {
      try {
        setSubmittingStatus('Mengompres foto nota...');

        // 1. Process and compress receipt files, and attempt direct Supabase storage upload
        const supabase = createBrowserClient();
        const uploadedBlockUrls: Record<number, string> = {};
        const compressedBlockFiles: Record<number, File> = {};

        for (let idx = 0; idx < blocks.length; idx++) {
          const b = blocks[idx];
          if (b.receiptFile) {
            setSubmittingStatus(`Mengompres & mengunggah nota #${idx + 1}...`);
            try {
              const compressed = await compressImageFile(b.receiptFile, 1200, 0.82);
              compressedBlockFiles[idx] = compressed;

              const fileExt = 'jpg';
              const fileName = `${userProfile?.id || 'emp'}-${Date.now()}-${idx}.${fileExt}`;
              const filePath = `receipts/${fileName}`;

              const { data: uploadData, error: uploadErr } = await supabase.storage
                .from('receipts')
                .upload(filePath, compressed, {
                  contentType: 'image/jpeg',
                  cacheControl: '3600',
                  upsert: false,
                });

              if (!uploadErr && uploadData) {
                const { data: publicUrlData } = supabase.storage
                  .from('receipts')
                  .getPublicUrl(filePath);
                if (publicUrlData?.publicUrl) {
                  uploadedBlockUrls[idx] = publicUrlData.publicUrl;
                }
              }
            } catch (storageErr) {
              console.warn(`Direct upload failed for block ${idx}, will send to server:`, storageErr);
            }
          }
        }

        setSubmittingStatus('Menyimpan data pengajuan...');

        // Prepare structured AccountBlockData with receipt_url populated
        const blocksData: AccountBlockData[] = blocks.map((b, idx) => ({
          account: b.account,
          amount: Number(b.amount) || 0,
          receipt_date: b.receipt_date || requestDate,
          receipt_url: uploadedBlockUrls[idx] || undefined,
          entries: b.entries.map((e) => ({
            customer: e.customer.trim(),
            description: e.description.trim(),
            receipt_date: b.receipt_date || e.receipt_date || requestDate,
          })),
        }));

        const sigToSend =
          userProfile?.signature_url ||
          (typeof window !== 'undefined' ? localStorage.getItem('ourem_user_signature') : '') ||
          '';

        const primaryAccount = blocks[0]?.account || (reimbursementType === 'Petty Cash' ? 'Bensin' : 'Material');
        const primaryCustomer = blocks
          .flatMap((b) => b.entries.map((e) => e.customer.trim()))
          .filter(Boolean)
          .join(', ');

        const userPhone =
          userProfile?.phone ||
          (typeof window !== 'undefined' ? localStorage.getItem('ourem_user_phone') : '') ||
          (userProfile?.email?.includes('miskadi') || userProfile?.full_name?.toLowerCase().includes('miskadi') ? '085710002923' : '') ||
          undefined;

        const userEmpId =
          userProfile?.employee_id ||
          (typeof window !== 'undefined' ? localStorage.getItem('ourem_user_employee_id') : '') ||
          (userProfile?.email?.includes('miskadi') || userProfile?.full_name?.toLowerCase().includes('miskadi') ? 'CSK-007' : '') ||
          undefined;

        const combinedDescription = formatAccountBlocksToDescription(blocksData, {
          reimbursement_type: reimbursementType,
          department,
          account: primaryAccount,
          customer: primaryCustomer,
          signature_url: sigToSend,
          full_name: userProfile?.full_name,
          email: userProfile?.email,
          phone: userPhone,
          employee_id: userEmpId,
          bank_name: userProfile?.bank_name || undefined,
          bank_account_number: userProfile?.bank_account_number || undefined,
          bank_account_holder: userProfile?.bank_account_holder || undefined,
        });

        const autoTitle = primaryCustomer ? `${primaryAccount} - ${primaryCustomer}` : primaryAccount;

        const formData = new FormData();
        formData.set('title', autoTitle);
        formData.set('reimbursement_type', reimbursementType);
        formData.set('category', primaryAccount);
        formData.set('account', primaryAccount);
        formData.set('customer', primaryCustomer);
        formData.set('department', department);
        if (userProfile?.full_name) formData.set('nama_karyawan', userProfile.full_name);
        if (userProfile?.phone) formData.set('phone', userProfile.phone);
        if (userProfile?.employee_id) formData.set('employee_id', userProfile.employee_id);
        formData.set('request_date', requestDate);
        formData.set('description', combinedDescription);
        formData.set('amount', totalAmount.toString());
        formData.set('block_count', blocks.length.toString());

        if (sigToSend) {
          formData.set('signature_url', sigToSend);
        }

        // Attach receipt URLs (if uploaded) or compressed file fallback
        blocks.forEach((_, idx) => {
          if (uploadedBlockUrls[idx]) {
            formData.set(`receipt_url_${idx}`, uploadedBlockUrls[idx]);
          } else if (compressedBlockFiles[idx]) {
            formData.set(`receipt_file_${idx}`, compressedBlockFiles[idx]);
          }
        });

        // Set primary receipt_url or file
        const firstUrl = Object.values(uploadedBlockUrls)[0];
        if (firstUrl) {
          formData.set('receipt_url', firstUrl);
        } else {
          const firstCompressedFile = Object.values(compressedBlockFiles)[0];
          if (firstCompressedFile) {
            formData.set('receipt_file', firstCompressedFile);
          }
        }

        const response = await fetch('/api/requests/create', {
          method: 'POST',
          body: formData,
        });

        const res = await response.json().catch(() => null);

        if (!response.ok || res?.error) {
          setError(res?.error || 'Gagal mengirim pengajuan. Silakan coba sesaat lagi.');
        } else {
          const backUrl = userProfile?.role === 'director' ? '/director' : userProfile?.role === 'finance' ? '/finance' : '/employee';
          window.location.href = `${backUrl}?success=created_reimbursement`;
        }
      } catch (err: any) {
        console.error('Submission error:', err);
        setError(err?.message || 'Gagal mengirim pengajuan. Periksa koneksi internet Anda.');
      } finally {
        setSubmittingStatus('');
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm dark:shadow-2xl">
      {/* Header: Clean, Corporate & Professional */}
      <div className="mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Buat Pengajuan Reimbursement
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 mt-0.5">
          Pilih kategori pengajuan (Petty Cash atau Voucher) dan lengkapi rincian transaksi beban operasional.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Jenis Reimbursement Toggle (Petty Cash vs Voucher) */}
      <div className="mb-4 sm:mb-5">
        <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          Jenis Reimbursement
        </label>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => handleTypeChange('Petty Cash')}
            className={`p-3 sm:p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
              reimbursementType === 'Petty Cash'
                ? 'border-orange-500 bg-orange-50/80 dark:bg-orange-500/10 shadow-sm ring-1 ring-orange-500/30'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs sm:text-sm font-bold ${
                reimbursementType === 'Petty Cash'
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-slate-800 dark:text-slate-200'
              }`}>
                PETTY CASH
              </span>
              {reimbursementType === 'Petty Cash' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 border border-orange-200 dark:border-orange-500/30">
                  Dipilih
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              Kas kecil operasional harian (Transport: Bensin, Parkir, Tol)
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange('Voucher')}
            className={`p-3 sm:p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
              reimbursementType === 'Voucher'
                ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-500/10 shadow-sm ring-1 ring-amber-500/30'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs sm:text-sm font-bold ${
                reimbursementType === 'Voucher'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-800 dark:text-slate-200'
              }`}>
                VOUCHER
              </span>
              {reimbursementType === 'Voucher' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                  Dipilih
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              Voucher klaim biaya non-transport (Material, Konsumsi, Kantor)
            </p>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        {/* Department (Terkunci) & Tanggal Pengajuan (1 Baris, 2 Kolom) */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
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

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="truncate">Tanggal Pengajuan</span>
            </label>
            <input
              type="date"
              required
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {}
              }}
              className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
            />
          </div>
        </div>

        {/* LIST KOLOM / CARD ACCOUNT (BEBAN) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Rincian Akun & Beban Transaksi
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Pilih menu account, lengkapi customer & deskripsi, serta nominal dan foto nota bukti pembayaran.
              </p>
            </div>
          </div>

          {blocks.map((block, blockIndex) => (
            <div
              key={block.id}
              className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 space-y-3.5 relative shadow-sm dark:shadow-lg transition"
            >
              {/* Card Top Bar: Nomor Account & Tombol Hapus */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30">
                    Account #{blockIndex + 1}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                    {block.account}
                  </span>
                </div>

                {blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAccountBlock(blockIndex)}
                    className="p-1 sm:py-1 sm:px-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                    title="Hapus Account"
                    aria-label="Hapus Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Hapus</span>
                  </button>
                )}
              </div>

              {/* 1. MENU PILIH ACCOUNT DI ATAS KOLOM INI */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {reimbursementType === 'Petty Cash'
                    ? 'Kategori Transport (Beban):'
                    : 'Kategori Akun (Beban):'}
                </label>
                <select
                  value={block.account}
                  onChange={(e) => updateBlockField(blockIndex, 'account', e.target.value)}
                  className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold cursor-pointer"
                >
                  {reimbursementType === 'Petty Cash' ? (
                    <optgroup label="─── TRANSPORT (PETTY CASH) ───" className="font-bold">
                      <option value="Bensin">Bensin</option>
                      <option value="Parkir">Parkir</option>
                      <option value="Tol">Tol</option>
                      <option value="Transport Lainnya">Transport Lainnya</option>
                    </optgroup>
                  ) : (
                    <>
                      <optgroup label="─── MATERIAL & PERLENGKAPAN ───" className="font-bold">
                        <option value="Material">Material</option>
                        <option value="Alat Tulis Kantor (ATK)">Alat Tulis Kantor (ATK)</option>
                        <option value="Sparepart & Perlengkapan">Sparepart & Perlengkapan</option>
                      </optgroup>

                      <optgroup label="─── KONSUMSI ───" className="font-bold">
                        <option value="Makan">Makan</option>
                        <option value="Kopi">Kopi</option>
                        <option value="Rokok">Rokok</option>
                        <option value="Konsumsi Lainnya">Konsumsi Lainnya</option>
                      </optgroup>

                      <optgroup label="─── OPERASIONAL LAINNYA ───" className="font-bold">
                        <option value="Entertain Partner">Entertain Partner</option>
                        <option value="Hotel & Penginapan">Hotel & Penginapan</option>
                        <option value="Medis & Kesehatan">Medis & Kesehatan</option>
                        <option value="Operasional Kantor">Operasional Kantor</option>
                      </optgroup>
                    </>
                  )}
                </select>
              </div>

              {/* 2. CUSTOMER & DESCRIPTION ROWS DALAM KOLOM INI (2 BARIS KE BAWAH) */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Rincian Customer & Keterangan:
                  </label>
                </div>

                {block.entries.map((entry, entryIndex) => (
                  <div
                    key={entryIndex}
                    className="bg-slate-50/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 space-y-2.5 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-orange-400">
                        #{entryIndex + 1}
                      </span>
                      {block.entries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCustomerFromBlock(blockIndex, entryIndex)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer"
                          title="Hapus baris customer ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* 2 Baris ke bawah: Baris 1 Customer, Baris 2 Keterangan */}
                    <div className="space-y-2">
                      {/* Customer Input */}
                      <div>
                        <label className="block text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Customer / Project
                        </label>
                        <input
                          type="text"
                          required
                          value={entry.customer}
                          onChange={(e) =>
                            updateCustomerEntry(blockIndex, entryIndex, 'customer', e.target.value)
                          }
                          placeholder="Contoh: KPU RI"
                          className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>

                      {/* Description Input */}
                      <div>
                        <label className="block text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Keterangan
                        </label>
                        <input
                          type="text"
                          required
                          value={entry.description}
                          onChange={(e) =>
                            updateCustomerEntry(blockIndex, entryIndex, 'description', e.target.value)
                          }
                          placeholder="Keterangan transaksi..."
                          className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Tombol Tambah Customer di bawah kolom keterangan di luar kolom rincian sebelah kanan */}
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => addCustomerToBlock(blockIndex)}
                    className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 transition flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                    title="Tambah Customer"
                    aria-label="Tambah Customer"
                  >
                    <Plus className="w-4 h-4 text-orange-600 dark:text-orange-400 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* 3. NOMINAL & TANGGAL NOTA (1 BARIS, 2 KOLOM) */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 pt-3 border-t border-slate-200 dark:border-slate-800/80">
                {/* Kolom 1: Nominal Amount */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nominal (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    value={block.amount ? Number(block.amount).toLocaleString('id-ID') : ''}
                    onChange={(e) => updateBlockField(blockIndex, 'amount', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <div className="text-[11px] text-orange-600 dark:text-amber-400 mt-1 flex items-center justify-between font-mono font-semibold truncate">
                    <span className="text-slate-500 dark:text-slate-400 font-normal">Subtotal:</span>
                    <span>
                      {block.amount
                        ? new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: 'IDR',
                            maximumFractionDigits: 0,
                          }).format(Number(block.amount))
                        : 'Rp 0'}
                    </span>
                  </div>
                </div>

                {/* Kolom 2: Tanggal Nota */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tanggal Nota
                  </label>
                  <input
                    type="date"
                    required
                    value={block.receipt_date || requestDate}
                    onChange={(e) => updateBlockField(blockIndex, 'receipt_date', e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {}
                    }}
                    className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer font-medium"
                  />
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                    Tgl Transaksi Nota
                  </div>
                </div>

                {/* Kolom Foto Bukti Nota (Tanpa Tombol Galeri) */}
                <div className="col-span-2 pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Foto Nota
                    </label>
                  </div>

                  {/* Hidden Camera Input */}
                  <input
                    ref={(el) => {
                      cameraInputRefs.current[blockIndex] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleInitiateCrop(blockIndex, e.target.files[0]);
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                  />

                  {block.receiptPreview ? (
                    <div className="w-full py-2.5 sm:py-3 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={block.receiptPreview}
                          alt="Preview Nota"
                          className="h-8 w-8 rounded-lg border border-slate-300 dark:border-slate-700 object-cover shrink-0 cursor-pointer hover:opacity-90 transition"
                          onClick={() => handleReCrop(blockIndex)}
                          title="Klik untuk crop ulang"
                        />
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                          ✓ Foto Nota Terlampir
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReCrop(blockIndex)}
                          className="p-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:hover:bg-orange-500/25 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 rounded-lg text-xs font-semibold transition cursor-pointer bg-clip-padding overflow-hidden shadow-none active:scale-95"
                          title="Crop foto"
                        >
                          <Crop className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBlocks((prev) =>
                              prev.map((b, idx) =>
                                idx === blockIndex ? { ...b, receiptFile: null, receiptPreview: null } : b
                              )
                            );
                          }}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 rounded-lg text-xs transition cursor-pointer"
                          title="Hapus foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => cameraInputRefs.current[blockIndex]?.click()}
                      className="w-full py-2.5 sm:py-3 border border-slate-300 dark:border-slate-700/80 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 rounded-xl text-center cursor-pointer transition flex items-center justify-center shadow-sm active:scale-95"
                      title="Buka Kamera"
                      aria-label="Buka Kamera"
                    >
                      <Camera className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                    </button>
                  )}

                  {/* Text di bawah tombol kamera: hilangkan text kamera! */}
                  <div className="text-[10px] sm:text-xs text-slate-400 mt-1 flex items-center justify-between">
                    <span>{block.receiptPreview ? '✓ Terlampir' : ''}</span>
                    <span>Maks 10MB</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 4. FITUR TAMBAH PILIH ACCOUNT DI BAWAH KOLOM INI (ICON SAJA) */}
          <div className="pt-1 flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={addAccountBlock}
              className="p-2.5 sm:p-3 rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-700 dark:bg-orange-600/10 dark:hover:bg-orange-600/20 dark:text-orange-400 border border-dashed border-orange-300 dark:border-orange-500/40 transition flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
              title="Tambah Akun Beban Baru"
              aria-label="Tambah Akun Beban Baru"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOTAL RINGKASAN PENGAJUAN */}
        <div className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-2 shadow-inner">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Pengajuan ({blocks.length} Account)
            </div>
            <div className="text-base sm:text-lg font-black text-orange-600 dark:text-amber-400 font-mono">
              {formattedTotalAmount}
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 text-right truncate max-w-[150px]">
            <span className="text-slate-800 dark:text-white font-semibold">
              {blocks.map((b) => b.account).join(', ')}
            </span>
          </div>
        </div>

        {/* Action Buttons: 2 Kolom dalam 1 baris, Icon Saja */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2.5 sm:gap-4">
          <Link
            href={userProfile?.role === 'director' ? '/director' : userProfile?.role === 'finance' ? '/finance' : '/employee'}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
            title="Batal"
            aria-label="Batal"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-950/30 transition flex items-center justify-center disabled:opacity-50 cursor-pointer active:scale-95"
            title="Kirim Pengajuan Reimbursement"
            aria-label="Kirim Pengajuan Reimbursement"
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>

      {/* Interactive Image Cropper Modal */}
      <ImageCropperModal
        isOpen={cropperState.isOpen}
        imageSrc={cropperState.imageSrc}
        fileName={cropperState.fileName}
        onCropComplete={handleCropComplete}
        onClose={() => setCropperState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}