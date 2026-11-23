'use client';

import React, { useState, useTransition, useRef } from 'react';
import { ReimbursementRequest, ReimbursementType, DEPARTMENT_OPTIONS, UserRole } from '@/types/database';
import { updateReimbursement } from '@/actions/requests';
import {
  AccountBlockData,
  formatAccountBlocksToDescription,
  parseAccountBlocksFromDescription,
  extractMetadataFromDescription,
  getCleanDescription,
} from '@/lib/formatters';
import { formatRfNumber } from '@/lib/wordVoucherGenerator';
import {
  X,
  Calendar,
  DollarSign,
  FileText,
  Upload,
  AlertCircle,
  Loader2,
  Building,
  Briefcase,
  List,
  Trash2,
  Plus,
  PlusCircle,
  Layers,
  Image as ImageIcon,
  Camera,
  Crop,
  Lock,
  Save,
} from 'lucide-react';
import ImageCropperModal from './ImageCropperModal';

interface EditRequestModalProps {
  request: ReimbursementRequest;
  currentRole?: UserRole;
  onClose: () => void;
  onSuccess: (updated: ReimbursementRequest) => void;
}

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

export default function EditRequestModal({
  request,
  currentRole,
  onClose,
  onSuccess,
}: EditRequestModalProps) {
  const isFinance = currentRole === 'finance';
  const meta = extractMetadataFromDescription(request.description);

  const [reimbursementType, setReimbursementType] = useState<ReimbursementType>(
    request.reimbursement_type || 'Petty Cash'
  );
  const [department, setDepartment] = useState<string>(
    request.department || request.profiles?.department || 'Staff OPS'
  );
  const [requestDate, setRequestDate] = useState<string>(request.request_date || '');
  const [rfNumber, setRfNumber] = useState<string>(
    request.rf_number || meta.rf_number || formatRfNumber(request.request_date, request.id)
  );
  const [describePurpose, setDescribePurpose] = useState<string>(
    request.describe_purpose ||
      meta.describe_purpose ||
      request.title ||
      getCleanDescription(request.description) ||
      ''
  );

  // Initialize blocks
  const [blocks, setBlocks] = useState<AccountBlockState[]>(() => {
    const defaultAcc = request.account || request.category || 'Bensin';
    const parsedBlocks = parseAccountBlocksFromDescription(
      request.description,
      defaultAcc,
      Number(request.amount) || 0,
      request.customer,
      request.receipt_url
    );

    if (parsedBlocks.length > 0) {
      return parsedBlocks.map((b, idx) => ({
        id: `block-${idx + 1}`,
        account: b.account,
        amount: b.amount > 0 ? String(b.amount) : '',
        receipt_date: b.receipt_date || b.entries[0]?.receipt_date || request.request_date || requestDate,
        receiptFile: null,
        receiptPreview: b.receipt_url || null,
        entries:
          b.entries.length > 0
            ? b.entries.map((e) => ({
                customer: e.customer || '',
                description: e.description || '',
                receipt_date: e.receipt_date || b.receipt_date || request.request_date || requestDate,
              }))
            : [{ customer: '', description: '', receipt_date: request.request_date || requestDate }],
      }));
    }

    return [
      {
        id: 'block-1',
        account: defaultAcc,
        amount: String(request.amount || ''),
        receipt_date: request.request_date || requestDate,
        receiptFile: null,
        receiptPreview: request.receipt_url || null,
        entries: [{ customer: request.customer || '', description: '', receipt_date: request.request_date || requestDate }],
      },
    ];
  });

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

    if (file.type === 'application/pdf') {
      handleBlockFileChange(blockIndex, file);
      return;
    }

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
          receiptPreview: file ? URL.createObjectURL(file) : b.receiptPreview,
        };
      })
    );
  };

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
      setError('Mohon isi nominal amount minimal pada satu account.');
      return;
    }

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const hasContent = b.entries.some(
        (e) => e.customer.trim() || e.description.trim()
      );
      if (!hasContent) {
        setError(`Mohon lengkapi Customer atau Description pada Account #${i + 1} (${b.account}).`);
        return;
      }
    }

    const blocksData: AccountBlockData[] = blocks.map((b) => ({
      account: b.account,
      amount: Number(b.amount) || 0,
      receipt_date: b.receipt_date || requestDate,
      receipt_url: b.receiptPreview || undefined,
      entries: b.entries.map((e) => ({
        customer: e.customer.trim(),
        description: e.description.trim(),
        receipt_date: b.receipt_date || e.receipt_date || requestDate,
      })),
    }));

    const primaryAccount = blocks[0]?.account || (reimbursementType === 'Petty Cash' ? 'Bensin' : 'Material');
    const primaryCustomer = blocks
      .flatMap((b) => b.entries.map((e) => e.customer.trim()))
      .filter(Boolean)
      .join(', ');

    const combinedDescription = formatAccountBlocksToDescription(blocksData, {
      ...meta,
      reimbursement_type: reimbursementType,
      rf_number: rfNumber.trim() || undefined,
      describe_purpose: describePurpose.trim() || undefined,
      department,
      account: primaryAccount,
      customer: primaryCustomer,
      signature_url: request.signature_url || undefined,
    });

    const autoTitle = primaryCustomer ? `${primaryAccount} - ${primaryCustomer}` : primaryAccount;

    const formData = new FormData();
    formData.set('id', request.id);
    formData.set('title', autoTitle);
    formData.set('reimbursement_type', reimbursementType);
    formData.set('rf_number', rfNumber.trim());
    formData.set('describe_purpose', describePurpose.trim());
    formData.set('category', primaryAccount);
    formData.set('account', primaryAccount);
    formData.set('customer', primaryCustomer);
    formData.set('department', department);
    formData.set('request_date', requestDate);
    formData.set('description', combinedDescription);
    formData.set('amount', totalAmount.toString());
    formData.set('signature_url', request.signature_url || '');
    formData.set('block_count', blocks.length.toString());

    blocks.forEach((b, idx) => {
      if (b.receiptFile) {
        formData.set(`receipt_file_${idx}`, b.receiptFile);
      }
    });

    const anyReceiptFile = blocks.some((b) => b.receiptFile);
    const firstReceiptFile = blocks.find((b) => b.receiptFile)?.receiptFile;
    const activeReceiptUrl = blocks.find((b) => b.receiptPreview)?.receiptPreview || '';

    if (firstReceiptFile) {
      formData.set('receipt_file', firstReceiptFile);
    } else {
      formData.set('receipt_url', activeReceiptUrl);
    }

    if (!anyReceiptFile && !activeReceiptUrl) {
      formData.set('delete_receipt', 'true');
    }

    startTransition(async () => {
      try {
        const res = await updateReimbursement(null, formData);
        if (res?.error) {
          setError(res.error);
        } else if (res?.success) {
          const finalReceiptUrl = anyReceiptFile
            ? (request.receipt_url || null)
            : (activeReceiptUrl || null);

          const updated: ReimbursementRequest = {
            ...request,
            title: autoTitle,
            reimbursement_type: reimbursementType,
            rf_number: rfNumber.trim() || undefined,
            describe_purpose: describePurpose.trim() || undefined,
            category: primaryAccount as any,
            account: primaryAccount,
            customer: primaryCustomer,
            department,
            request_date: requestDate,
            description: combinedDescription,
            amount: totalAmount,
            receipt_url: finalReceiptUrl,
          };
          onSuccess(updated);
          onClose();
        }
      } catch (err: any) {
        setError(err.message || 'Gagal memperbarui pengajuan.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/85 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center p-3 sm:p-6 pb-28 sm:pb-8">
        <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl my-4 sm:my-8 mb-24 sm:mb-8">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0 bg-clip-padding overflow-hidden shadow-none">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Edit Pengajuan Reimbursement
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Perbarui akun beban, rincian customer, nominal, dan bukti nota
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Jenis Reimbursement Toggle */}
        <div className="mb-4 sm:mb-5">
          <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-orange-400" />
            <span>Pilih Jenis Reimbursement:</span>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => handleTypeChange('Petty Cash')}
              className={`p-3 sm:p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between cursor-pointer ${
                reimbursementType === 'Petty Cash'
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <span className="text-xs sm:text-sm font-extrabold text-white">PETTY CASH</span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Kas kecil harian (Bensin, Parkir, Tol)
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange('Voucher')}
              className={`p-3 sm:p-4 rounded-2xl border-2 text-left transition flex flex-col justify-between cursor-pointer ${
                reimbursementType === 'Voucher'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <span className="text-xs sm:text-sm font-extrabold text-white">VOUCHER</span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Biaya non-transport (Material, Konsumsi)
              </span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Department, Tanggal & RF Number (RF Number & Describe Purpose khusus Finance) */}
          <div className={`grid grid-cols-2 ${isFinance ? 'sm:grid-cols-3' : ''} gap-2.5 sm:gap-4`}>
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

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate">Tanggal</span>
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
                className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {isFinance && (
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span className="truncate">RF Number</span>
                </label>
                <input
                  type="text"
                  value={rfNumber}
                  onChange={(e) => setRfNumber(e.target.value)}
                  placeholder="RF-DDMMYYYY/XXX"
                  className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}
          </div>

          {/* Describe Purpose (Khusus Akun Finance) */}
          {isFinance && (
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>Describe Purpose</span>
                </span>
                <span className="text-[10px] sm:text-xs text-slate-500 font-normal">
                  (Otomatis terhubung ke Describe Purpose Cetak Word)
                </span>
              </label>
              <input
                type="text"
                name="describe_purpose"
                value={describePurpose}
                onChange={(e) => setDescribePurpose(e.target.value)}
                placeholder="Contoh: Bensin - Jasa Marga"
                className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}

          {/* LIST KOLOM / CARD ACCOUNT */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Building className="w-4 h-4 text-orange-400" />
                <span>Rincian Kolom Account & Customer</span>
              </span>
            </div>

            {blocks.map((block, blockIndex) => (
              <div
                key={block.id}
                className="bg-slate-950/80 border-2 border-slate-800 hover:border-slate-700/80 rounded-2xl p-3.5 sm:p-5 space-y-3.5 shadow-lg transition"
              >
                {/* Header Block */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 bg-clip-padding">
                      Account #{blockIndex + 1}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-300">
                      {block.account}
                    </span>
                  </div>

                  {blocks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAccountBlock(blockIndex)}
                      className="p-1 sm:py-1 sm:px-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                      title="Hapus kolom account ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Hapus</span>
                    </button>
                  )}
                </div>

                {/* 1. MENU PILIH ACCOUNT DI ATAS KOLOM INI */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-orange-400" />
                    <span>
                      {reimbursementType === 'Petty Cash'
                        ? 'Pilih Menu Transport (Beban):'
                        : 'Pilih Menu Account (Beban):'}
                    </span>
                  </label>
                  <select
                    value={block.account}
                    onChange={(e) => updateBlockField(blockIndex, 'account', e.target.value)}
                    className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold cursor-pointer"
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

                {/* 2. CUSTOMER & DESCRIPTION ROWS (2 BARIS KE BAWAH) */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-300">
                      Rincian Customer & Keterangan:
                    </label>
                  </div>

                  {block.entries.map((entry, entryIndex) => (
                    <div
                      key={entryIndex}
                      className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3 space-y-2.5 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-orange-400">
                          #{entryIndex + 1}
                        </span>
                        {block.entries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCustomerFromBlock(blockIndex, entryIndex)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
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
                          <label className="block text-xs sm:text-sm font-semibold text-slate-400 mb-1">
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
                            className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>

                        {/* Description Textarea */}
                        <div>
                          <label className="block text-xs sm:text-sm font-semibold text-slate-400 mb-1 flex items-center gap-1">
                            <List className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <span>Description (Keterangan)</span>
                          </label>
                          <textarea
                            rows={2}
                            required
                            value={entry.description}
                            onChange={(e) =>
                              updateCustomerEntry(blockIndex, entryIndex, 'description', e.target.value)
                            }
                            placeholder="Keterangan transaksi..."
                            className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 leading-relaxed"
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
                      className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 transition flex items-center justify-center cursor-pointer shadow-sm active:scale-95 bg-clip-padding overflow-hidden"
                      title="Tambah Customer"
                      aria-label="Tambah Customer"
                    >
                      <Plus className="w-4 h-4 text-orange-600 dark:text-orange-400 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* 3. NOMINAL & TANGGAL NOTA (1 BARIS, 2 KOLOM) */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 pt-3 border-t border-slate-800/80">
                  {/* Kolom 1: Nominal Input Column */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/40 px-1 py-0.2 rounded bg-orange-50 dark:bg-orange-500/10 font-mono bg-clip-padding">
                        RP
                      </span>
                      <span>Nominal Amount (Rp)</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={block.amount ? Number(block.amount).toLocaleString('id-ID') : ''}
                      onChange={(e) => updateBlockField(blockIndex, 'amount', e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <div className="text-[11px] font-bold text-amber-400 mt-1 flex items-center justify-between font-mono truncate">
                      <span className="text-slate-400 font-normal">Subtotal:</span>
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
                    <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span>Tanggal Nota</span>
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
                      className="w-full px-3 py-2.5 sm:px-3.5 sm:py-3 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer font-medium"
                      style={{ colorScheme: 'dark' }}
                    />
                    <div className="text-[11px] text-slate-500 mt-1 truncate">
                      Tgl Transaksi Nota
                    </div>
                  </div>

                  {/* Kolom Foto Bukti Nota (Tanpa Tombol Galeri) */}
                  <div className="col-span-2 pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span>Foto Nota</span>
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
                      <div className="w-full py-2.5 sm:py-3 px-3 bg-slate-900 border border-slate-700/80 rounded-xl flex items-center justify-between gap-2 shadow-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={block.receiptPreview}
                            alt="Preview Nota"
                            className="h-8 w-8 rounded-lg border border-slate-700 object-cover shrink-0 cursor-pointer hover:opacity-90 transition"
                            onClick={() => handleReCrop(blockIndex)}
                            title="Klik untuk atur posisi & crop ulang"
                          />
                          <span className="text-xs text-emerald-400 font-semibold truncate">
                            ✓ Foto Nota Terlampir
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleReCrop(blockIndex)}
                            className="p-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:hover:bg-orange-500/25 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 rounded-lg text-xs font-semibold transition cursor-pointer bg-clip-padding overflow-hidden shadow-none active:scale-95"
                            title="Atur posisi & crop ulang foto ini"
                          >
                            <Crop className="w-4 h-4" />
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
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg text-xs transition cursor-pointer"
                            title="Hapus foto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => cameraInputRefs.current[blockIndex]?.click()}
                        className="w-full py-2.5 sm:py-3 border-2 border-dashed border-orange-500/40 hover:border-orange-500 bg-slate-900/60 hover:bg-orange-500/5 rounded-xl text-center cursor-pointer transition flex items-center justify-center shadow-sm active:scale-95"
                        title="Buka Kamera"
                        aria-label="Buka Kamera"
                      >
                        <Camera className="w-5 h-5 text-orange-400" />
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
                className="p-2.5 sm:p-3 rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 dark:text-orange-400 border border-dashed border-orange-300 dark:border-orange-500/40 transition flex items-center justify-center cursor-pointer shadow-sm active:scale-95 bg-clip-padding overflow-hidden"
                title="Tambah Akun Beban Baru"
                aria-label="Tambah Akun Beban Baru"
              >
                <PlusCircle className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* TOTAL RINGKASAN */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-inner">
            <span className="text-xs font-semibold text-slate-400">
              Total Pengajuan ({blocks.length} Account):
            </span>
            <span className="text-base sm:text-lg font-black text-amber-400 font-mono">
              {formattedTotalAmount}
            </span>
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
              title="Simpan Perubahan"
              aria-label="Simpan Perubahan"
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