'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import Link from 'next/link';
import ImageCropperModal from './ImageCropperModal';

interface AccountBlockState {
  id: string;
  account: string;
  amount: string;
  receiptFile: File | null;
  receiptPreview: string | null;
  entries: Array<{
    customer: string;
    description: string;
    receipt_date?: string;
  }>;
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
      receiptFile: null,
      receiptPreview: null,
      entries: [{ customer: '', description: '', receipt_date: new Date().toISOString().split('T')[0] }],
    },
  ]);

  const [error, setError] = useState<string | null>(null);
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
    field: 'account' | 'amount',
    value: string
  ) => {
    setBlocks((prev) =>
      prev.map((b, idx) => {
        if (idx !== blockIndex) return b;
        if (field === 'amount') {
          const val = value.replace(/[^0-9]/g, '');
          return { ...b, amount: val };
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
          entries: [...b.entries, { customer: '', description: '', receipt_date: requestDate }],
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

    // Prepare structured AccountBlockData
    const blocksData: AccountBlockData[] = blocks.map((b) => ({
      account: b.account,
      amount: Number(b.amount) || 0,
      entries: b.entries.map((e) => ({
        customer: e.customer.trim(),
        description: e.description.trim(),
        receipt_date: e.receipt_date || requestDate,
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

    // Attach receipt files per block
    blocks.forEach((b, idx) => {
      if (b.receiptFile) {
        formData.set(`receipt_file_${idx}`, b.receiptFile);
      }
    });

    // Fallback single receipt file
    const firstReceipt = blocks.find((b) => b.receiptFile)?.receiptFile;
    if (firstReceipt) {
      formData.set('receipt_file', firstReceipt);
    }

    startTransition(async () => {
      try {
        const res = await createReimbursement(formData);
        if (res?.error) {
          setError(res.error);
        } else if (res?.success) {
          window.location.href = '/employee?success=created_reimbursement';
        }
      } catch (err: any) {
        console.error('Submission error:', err);
        const msg = err?.message || '';
        if (msg.includes('441') || msg.includes('Minified React error')) {
          setError('Gagal memproses pengajuan. Mohon periksa kembali form atau coba sesaat lagi.');
        } else if (!msg.includes('NEXT_REDIRECT')) {
          setError(msg || 'Gagal mengirim pengajuan.');
        }
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
            Formulir Resmi
          </span>
          <span className="text-xs text-slate-400">Ouffice Reimbursement</span>
        </div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>Buat Pengajuan Reimbursement</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Pilih jenis pengajuan (Petty Cash / Voucher) dan lengkapi rincian account transaksi
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Jenis Reimbursement Toggle (Petty Cash vs Voucher) */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-orange-400" />
          <span>Pilih Jenis Reimbursement:</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleTypeChange('Petty Cash')}
            className={`p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between cursor-pointer ${
              reimbursementType === 'Petty Cash'
                ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-950/40'
                : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-white">PETTY CASH</span>
              {reimbursementType === 'Petty Cash' && (
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Kas kecil operasional harian (Khusus kategori Transport: Bensin, Parkir, Tol)
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange('Voucher')}
            className={`p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between cursor-pointer ${
              reimbursementType === 'Voucher'
                ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-950/40'
                : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-white">VOUCHER</span>
              {reimbursementType === 'Voucher' && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Voucher klaim biaya selain transport (Material, Konsumsi, Operasional)
            </p>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Department & Tanggal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-orange-400" />
              <span>Department</span>
            </label>
            <div className="relative">
              <select
                name="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-orange-400" />
              <span>Tanggal</span>
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
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* LIST KOLOM / CARD ACCOUNT (BEBAN) */}
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Building className="w-4 h-4 text-orange-400" />
                <span>Rincian Kolom Account & Customer</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pilih menu account di atas kolom, lengkapi customer & deskripsi, serta nominal dan foto nota.
              </p>
            </div>
          </div>

          {blocks.map((block, blockIndex) => (
            <div
              key={block.id}
              className="bg-slate-950/80 border-2 border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-4 relative shadow-lg transition"
            >
              {/* Card Top Bar: Nomor Account & Tombol Hapus */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    Account #{blockIndex + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    {block.account}
                  </span>
                </div>

                {blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAccountBlock(blockIndex)}
                    className="py-1 px-2.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                    title="Hapus kolom account ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Account</span>
                  </button>
                )}
              </div>

              {/* 1. MENU PILIH ACCOUNT DI ATAS KOLOM INI */}
              <div>
                <label className="block text-xs font-bold text-orange-400 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    {reimbursementType === 'Petty Cash'
                      ? 'Pilih Menu Transport (Beban):'
                      : 'Pilih Menu Account (Beban):'}
                  </span>
                </label>
                <select
                  value={block.account}
                  onChange={(e) => updateBlockField(blockIndex, 'account', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold cursor-pointer"
                >
                  {reimbursementType === 'Petty Cash' ? (
                    <optgroup label="─── TRANSPORT (PETTY CASH) ───" className="bg-slate-900 text-orange-400 font-bold">
                      <option value="Bensin" className="text-white">Bensin</option>
                      <option value="Parkir" className="text-white">Parkir</option>
                      <option value="Tol" className="text-white">Tol</option>
                      <option value="Transport Lainnya" className="text-white">Transport Lainnya</option>
                    </optgroup>
                  ) : (
                    <>
                      <optgroup label="─── MATERIAL & PERLENGKAPAN ───" className="bg-slate-900 text-emerald-400 font-bold">
                        <option value="Material" className="text-white">Material</option>
                        <option value="Alat Tulis Kantor (ATK)" className="text-white">Alat Tulis Kantor (ATK)</option>
                        <option value="Sparepart & Perlengkapan" className="text-white">Sparepart & Perlengkapan</option>
                      </optgroup>

                      <optgroup label="─── KONSUMSI ───" className="bg-slate-900 text-amber-400 font-bold">
                        <option value="Makan" className="text-white">Makan</option>
                        <option value="Kopi" className="text-white">Kopi</option>
                        <option value="Rokok" className="text-white">Rokok</option>
                        <option value="Konsumsi Lainnya" className="text-white">Konsumsi Lainnya</option>
                      </optgroup>

                      <optgroup label="─── OPERASIONAL LAINNYA ───" className="bg-slate-900 text-teal-400 font-bold">
                        <option value="Entertain Partner" className="text-white">Entertain Partner</option>
                        <option value="Hotel & Penginapan" className="text-white">Hotel & Penginapan</option>
                        <option value="Medis & Kesehatan" className="text-white">Medis & Kesehatan</option>
                        <option value="Operasional Kantor" className="text-white">Operasional Kantor</option>
                      </optgroup>
                    </>
                  )}
                </select>
              </div>

              {/* 2. CUSTOMER & DESCRIPTION ROWS DALAM KOLOM INI */}
              <div className="space-y-3 pt-1">
                <label className="block text-[11px] font-semibold text-slate-400">
                  Rincian Customer & Description untuk {block.account}:
                </label>

                {block.entries.map((entry, entryIndex) => (
                  <div
                    key={entryIndex}
                    className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 flex flex-col sm:flex-row items-start gap-3 relative"
                  >
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-orange-400 shrink-0 mt-2 sm:mt-1">
                      #{entryIndex + 1}
                    </span>

                    {/* Customer & Tanggal Nota Input */}
                    <div className="w-full sm:w-5/12 space-y-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                          Customer / Klien / Project
                        </label>
                        <input
                          type="text"
                          required
                          value={entry.customer}
                          onChange={(e) =>
                            updateCustomerEntry(blockIndex, entryIndex, 'customer', e.target.value)
                          }
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-orange-400" />
                          <span>Tanggal Nota</span>
                        </label>
                        <input
                          type="date"
                          value={entry.receipt_date || requestDate}
                          onChange={(e) =>
                            updateCustomerEntry(blockIndex, entryIndex, 'receipt_date', e.target.value)
                          }
                          onClick={(e) => {
                            try {
                              e.currentTarget.showPicker?.();
                            } catch {}
                          }}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>
                    </div>

                    {/* Description Textarea (Tanpa Bullet) */}
                    <div className="w-full sm:flex-1 flex flex-col">
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                        <List className="w-3 h-3 text-orange-400" />
                        <span>Description (Keterangan)</span>
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={entry.description}
                        onChange={(e) =>
                          updateCustomerEntry(blockIndex, entryIndex, 'description', e.target.value)
                        }
                        className="w-full flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500 leading-relaxed min-h-[88px]"
                      />
                    </div>

                    {/* Tombol Hapus Baris Customer */}
                    {block.entries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCustomerFromBlock(blockIndex, entryIndex)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition sm:mt-6 shrink-0 cursor-pointer"
                        title="Hapus baris customer ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {/* TOMBOL TAMBAH CUSTOMER DI POJOK KANAN BAGIAN PALING BAWAH CUSTOMER */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => addCustomerToBlock(blockIndex)}
                    className="py-1.5 px-3 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Tambah customer di bawah kolom ini"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Customer</span>
                  </button>
                </div>
              </div>

              {/* 3. NOMINAL & FOTO NOTA DI DALAM KOLOM INI (SIMETRIS) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                {/* Nominal Input Column */}
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 h-5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-orange-400 border border-orange-500/40 px-1 py-0.2 rounded bg-orange-500/10 font-mono">
                          RP
                        </span>
                        <span>Nominal Amount (Rp)</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      required
                      value={block.amount ? Number(block.amount).toLocaleString('id-ID') : ''}
                      onChange={(e) => updateBlockField(blockIndex, 'amount', e.target.value)}
                      className="w-full h-11 px-3.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="text-[11px] font-bold text-amber-400 mt-1.5 flex items-center justify-between h-5">
                    <span>Subtotal {block.account}:</span>
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

                {/* Upload Foto Nota / Kwitansi (Simetris dengan Kolom Nominal) */}
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 h-5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-orange-400" />
                        <span>Foto Bukti Nota / Kwitansi</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => galleryInputRefs.current[blockIndex]?.click()}
                        className="text-[11px] text-slate-400 hover:text-orange-400 flex items-center gap-1 transition cursor-pointer"
                        title="Pilih gambar dari galeri HP atau dokumen PDF"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span>Pilih dari Galeri</span>
                      </button>
                    </div>

                    {/* Hidden Camera Input (Membuka Kamera Android Belakang Langsung) */}
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

                    {/* Hidden Gallery Input (Buka Galeri / File Manager) */}
                    <input
                      ref={(el) => {
                        galleryInputRefs.current[blockIndex] = el;
                      }}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleInitiateCrop(blockIndex, e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                    />

                    {block.receiptPreview ? (
                      <div className="w-full h-11 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 flex items-center justify-between gap-2 shadow-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={block.receiptPreview}
                            alt="Preview Nota"
                            className="h-7 w-7 rounded-lg border border-slate-700 object-cover shrink-0 cursor-pointer hover:opacity-90 transition"
                            onClick={() => handleReCrop(blockIndex)}
                            title="Klik untuk atur posisi & crop ulang"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate max-w-[100px] sm:max-w-[140px] md:max-w-[180px]">
                              {block.receiptFile?.name || 'Foto Nota'}
                            </div>
                            <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                              <span>✓ Siap Dikirim</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleReCrop(blockIndex)}
                            className="px-2 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Atur posisi & crop ulang foto ini"
                          >
                            <Crop className="w-3 h-3" />
                            <span className="hidden sm:inline">Crop</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => cameraInputRefs.current[blockIndex]?.click()}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition cursor-pointer"
                            title="Buka kamera untuk foto ulang"
                          >
                            <Camera className="w-3.5 h-3.5" />
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
                            className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg text-xs transition cursor-pointer"
                            title="Hapus foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => cameraInputRefs.current[blockIndex]?.click()}
                        className="w-full h-11 border-2 border-dashed border-orange-500/40 hover:border-orange-500 bg-slate-900/60 hover:bg-orange-500/5 rounded-xl px-4 text-center cursor-pointer transition flex items-center justify-center group shadow-sm"
                        title="Buka Kamera Foto Nota"
                      >
                        <div className="w-7 h-7 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 group-hover:scale-110 group-hover:bg-orange-500/20 transition shrink-0">
                          <Camera className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between h-5">
                    <span>{block.receiptPreview ? '✓ Foto Nota Terlampir' : 'Kamera / Galeri'}</span>
                    <span>{block.receiptPreview ? 'Siap Dikirim' : 'Maks. 10MB'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 4. FITUR TAMBAH PILIH ACCOUNT DI BAWAH KOLOM INI */}
          <div className="pt-1">
            <button
              type="button"
              onClick={addAccountBlock}
              className="w-full py-3.5 px-4 rounded-2xl bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 border-2 border-dashed border-orange-500/40 hover:border-orange-500 text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-orange-400" />
              <span>+ Tambah Pilih Account (Beban Baru)</span>
            </button>
            <p className="text-[10px] text-slate-500 mt-1 text-center">
              💡 Tambahkan kategori akun lain (misal: Bensin + Parkir + Tol) dalam 1 pengajuan reimbursement
            </p>
          </div>
        </div>

        {/* TOTAL RINGKASAN PENGAJUAN */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
          <div>
            <div className="text-xs font-semibold text-slate-400">
              Total Pengajuan ({blocks.length} Account)
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-400 font-mono mt-0.5">
              {formattedTotalAmount}
            </div>
          </div>

          <div className="text-xs text-slate-400 sm:text-right">
            <span className="text-slate-500 text-[11px]">Akun yang diajukan: </span>
            <span className="text-white font-semibold">
              {blocks.map((b) => b.account).join(', ')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 pb-8 sm:pb-0 border-t border-slate-800">
          <Link
            href="/employee"
            className="px-5 py-2.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-extrabold shadow-lg shadow-orange-950/50 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan Pengajuan...</span>
              </>
            ) : (
              <span>Kirim Pengajuan Reimbursement</span>
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