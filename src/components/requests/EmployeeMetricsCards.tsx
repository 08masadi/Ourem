'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ReimbursementRequest } from '@/types/database';
import { extractOvertimeFromDescription, getCleanDescription } from '@/lib/formatters';
import {
  Wallet,
  Clock,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronDown,
  Calendar,
  AlertCircle,
  FileText,
  Building2,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';

interface EmployeeMetricsCardsProps {
  requests: ReimbursementRequest[];
}

type MetricCategory = 'petty_cash' | 'voucher' | 'lembur' | 'approved' | null;

export default function EmployeeMetricsCards({ requests }: EmployeeMetricsCardsProps) {
  const [selectedCategory, setSelectedCategory] = useState<MetricCategory>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  // Helper untuk mengenali kategori pengajuan
  const isOvertimeReq = (r: ReimbursementRequest) =>
    r.reimbursement_type === 'Lembur' ||
    r.account === 'Lembur' ||
    r.title?.startsWith('Form Lembur');

  const isVoucherReq = (r: ReimbursementRequest) =>
    !isOvertimeReq(r) && r.reimbursement_type === 'Voucher';

  const isPettyCashReq = (r: ReimbursementRequest) =>
    !isOvertimeReq(r) && !isVoucherReq(r);

  // Helper untuk mengambil nominal akurat
  const getRequestNominal = (r: ReimbursementRequest) => {
    if (isOvertimeReq(r)) {
      const ov = extractOvertimeFromDescription(r.description);
      if (ov && typeof ov.nominal === 'number') {
        return ov.nominal;
      }
      return Number(r.amount) <= 1 ? 0 : Number(r.amount) || 0;
    }
    return Number(r.amount) || 0;
  };

  const formatDateIndo = (dateStr?: string) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('T')[0].split('-');
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Pengajuan aktif yang belum dicairkan (bukan ditolak, bukan terhapus, dan payment_status !== 'Paid')
  const unpaidRequests = requests.filter(
    (r) =>
      r.title !== '[DELETED]' &&
      r.status !== 'Ditolak' &&
      r.payment_status !== 'Paid'
  );

  const unpaidPettyCashRequests = unpaidRequests.filter(isPettyCashReq);
  const unpaidVoucherRequests = unpaidRequests.filter(isVoucherReq);
  const unpaidOvertimeRequests = unpaidRequests.filter(isOvertimeReq);

  const unpaidPettyCashNominal = unpaidPettyCashRequests.reduce(
    (acc, curr) => acc + getRequestNominal(curr),
    0
  );
  const unpaidVoucherNominal = unpaidVoucherRequests.reduce(
    (acc, curr) => acc + getRequestNominal(curr),
    0
  );
  const unpaidOvertimeNominal = unpaidOvertimeRequests.reduce(
    (acc, curr) => acc + getRequestNominal(curr),
    0
  );

  // Pengajuan telah disetujui (siap dicairkan / sudah transfer)
  const approvedRequests = requests.filter(
    (r) => r.title !== '[DELETED]' && r.status === 'Disetujui'
  );
  const approvedUnpaidRequests = approvedRequests.filter((r) => r.payment_status !== 'Paid');
  const approvedCount = approvedRequests.length;

  const toggleCategory = (cat: MetricCategory) => {
    if (selectedCategory === cat) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(cat);
      // Smooth scroll slightly on mobile so the details are visible
      setTimeout(() => {
        detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  // Data detail sesuai kategori terpilih
  const getCategoryData = () => {
    switch (selectedCategory) {
      case 'petty_cash':
        return {
          key: 'petty_cash' as const,
          title: 'Petty Cash',
          subtitle: 'Rincian pengajuan petty cash operasional yang belum cair & siap dicairkan',
          icon: Wallet,
          iconColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
          badgeColor: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
          accentBorder: 'border-orange-500/60 ring-orange-500/20',
          items: unpaidPettyCashRequests,
          totalNominal: unpaidPettyCashNominal,
        };
      case 'voucher':
        return {
          key: 'voucher' as const,
          title: 'Voucher Reimbursement',
          subtitle: 'Rincian pengajuan voucher biaya klaim yang belum cair & siap dicairkan',
          icon: FileText,
          iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          badgeColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
          accentBorder: 'border-amber-500/60 ring-amber-500/20',
          items: unpaidVoucherRequests,
          totalNominal: unpaidVoucherNominal,
        };
      case 'lembur':
        return {
          key: 'lembur' as const,
          title: 'Form Lembur',
          subtitle: 'Rincian pengajuan lembur yang belum cair & siap dicairkan',
          icon: Clock,
          iconColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
          badgeColor: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
          accentBorder: 'border-orange-500/60 ring-orange-500/20',
          items: unpaidOvertimeRequests,
          totalNominal: unpaidOvertimeNominal,
        };
      case 'approved':
        return {
          key: 'approved' as const,
          title: 'Pengajuan Telah Disetujui',
          subtitle: 'Semua pengajuan yang telah disetujui resmi & siap diproses transfer oleh Finance',
          icon: CheckCircle2,
          iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
          accentBorder: 'border-emerald-500/60 ring-emerald-500/20',
          items: approvedRequests,
          totalNominal: approvedRequests.reduce((acc, curr) => acc + getRequestNominal(curr), 0),
        };
      default:
        return null;
    }
  };

  const activeData = getCategoryData();

  // Render list of item cards
  const renderItemCard = (item: ReimbursementRequest, idx: number) => {
    const isOvertime = isOvertimeReq(item);
    const ov = isOvertime ? extractOvertimeFromDescription(item.description) : null;
    const itemNominal = getRequestNominal(item);
    const itemDate = isOvertime && ov?.tanggal_lembur
      ? formatDateIndo(ov.tanggal_lembur)
      : formatDateIndo(item.request_date);

    const isApproved = item.status === 'Disetujui';
    const isPaid = item.payment_status === 'Paid';
    const isPending = item.status === 'Menunggu Approval';

    const cleanDesc = getCleanDescription(item.description);
    const displayTitle = isOvertime
      ? (ov?.nama_pekerjaan || item.title)
      : (item.customer ? `${item.account || item.category || 'Biaya'} - ${item.customer}` : (item.account || item.title));

    return (
      <div
        key={item.id || idx}
        className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 sm:p-4 space-y-2.5 transition shadow-sm"
      >
        {/* Top Row: Title, Date & Amount */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20">
                {item.reimbursement_type || (isOvertime ? 'Lembur' : 'Petty Cash')}
              </span>
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                {itemDate}
              </span>
            </div>
            <h4 className="text-sm font-bold text-white truncate pt-0.5">
              {displayTitle}
            </h4>
          </div>

          <div className="text-right shrink-0">
            <div className="text-sm sm:text-base font-black text-orange-400 font-mono">
              {formatRupiah(itemNominal)}
            </div>
          </div>
        </div>

        {/* Middle Details: Overtime specifics or general description */}
        {isOvertime && ov ? (
          <div className="text-xs bg-slate-950/70 rounded-xl p-2.5 border border-slate-800/80 space-y-1 text-slate-300">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Jam Lembur :</span>
              <span className="font-semibold text-white">{ov.jam_lembur || '-'}</span>
            </div>
            {ov.perusahaan && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Perusahaan :</span>
                <span className="font-medium text-slate-200">{ov.perusahaan}</span>
              </div>
            )}
            {ov.uraian_pekerjaan && (
              <div className="pt-1 border-t border-slate-800/60 text-slate-400 text-[11px] leading-relaxed line-clamp-2">
                {ov.uraian_pekerjaan}
              </div>
            )}
          </div>
        ) : (
          cleanDesc && (
            <div className="text-xs text-slate-400 line-clamp-2 bg-slate-950/50 p-2 rounded-xl border border-slate-800/50">
              {cleanDesc}
            </div>
          )
        )}

        {/* Bottom Row: Status Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Approval Status */}
            {isPending && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/25">
                <Clock className="w-3 h-3" />
                <span>Belum Disetujui (Menunggu Approval)</span>
              </span>
            )}
            {isApproved && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
                <CheckCircle2 className="w-3 h-3" />
                <span>Telah Disetujui</span>
              </span>
            )}

            {/* Payment Status (Belum Cair vs Siap Dicairkan) */}
            {isApproved && !isPaid && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-300 bg-teal-500/10 border border-teal-500/30 px-2.5 py-0.5 rounded-full animate-pulse">
                <Sparkles className="w-3 h-3 text-teal-400" />
                <span>Siap Dicairkan Finance (UNPAID)</span>
              </span>
            )}

            {isPaid && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                <span>Sudah Ditransfer (PAID)</span>
              </span>
            )}
          </div>

          {/* Customer indicator if exists */}
          {item.customer && !isOvertime && (
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 truncate max-w-[180px]">
              <Building2 className="w-3 h-3 text-slate-500" />
              {item.customer}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 4 Metrics Cards: Native HTML buttons for guaranteed touch responsiveness on Web & Android */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Kolom 1: Petty Cash */}
        <button
          type="button"
          onClick={() => toggleCategory('petty_cash')}
          className={`group relative text-left w-full rounded-2xl p-4 transition-all duration-200 transform active:scale-95 cursor-pointer touch-manipulation flex flex-col justify-between ${
            selectedCategory === 'petty_cash'
              ? 'bg-slate-900 border-2 border-orange-500 ring-2 ring-orange-500/40 shadow-xl shadow-orange-950/40 -translate-y-0.5'
              : 'bg-slate-900 border border-slate-800 hover:border-orange-500/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-950/20'
          }`}
        >
          <div className="w-full">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className={`text-xs font-semibold transition ${selectedCategory === 'petty_cash' ? 'text-orange-400 font-bold' : 'group-hover:text-slate-200'}`}>
                Petty Cash
              </span>
              <div className={`p-1.5 rounded-xl border transition ${selectedCategory === 'petty_cash' ? 'bg-orange-500/20 border-orange-500/40' : 'bg-orange-500/10 border-orange-500/20 group-hover:bg-orange-500/20'}`}>
                <Wallet className="w-4 h-4 text-orange-400" />
              </div>
            </div>
            <div className="text-base sm:text-lg font-bold text-white font-mono tracking-tight">
              {formatRupiah(unpaidPettyCashNominal)}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 w-full">
            <span className="text-[11px] font-semibold text-orange-400/90">
              {unpaidPettyCashRequests.length} pengajuan belum cair
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                selectedCategory === 'petty_cash' ? 'rotate-180 text-orange-400' : 'group-hover:text-orange-400'
              }`}
            />
          </div>
        </button>

        {/* Kolom 2: Voucher Reimbursement */}
        <button
          type="button"
          onClick={() => toggleCategory('voucher')}
          className={`group relative text-left w-full rounded-2xl p-4 transition-all duration-200 transform active:scale-95 cursor-pointer touch-manipulation flex flex-col justify-between ${
            selectedCategory === 'voucher'
              ? 'bg-slate-900 border-2 border-amber-500 ring-2 ring-amber-500/40 shadow-xl shadow-amber-950/40 -translate-y-0.5'
              : 'bg-slate-900 border border-slate-800 hover:border-amber-500/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-950/20'
          }`}
        >
          <div className="w-full">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className={`text-xs font-semibold transition ${selectedCategory === 'voucher' ? 'text-amber-400 font-bold' : 'group-hover:text-slate-200'}`}>
                Voucher Reimbursement
              </span>
              <span className={`text-[11px] font-black tracking-tight border px-1.5 py-0.5 rounded font-mono transition ${
                selectedCategory === 'voucher'
                  ? 'text-amber-300 border-amber-500/60 bg-amber-500/20'
                  : 'text-amber-400 border-amber-500/40 bg-amber-500/10 group-hover:bg-amber-500/20'
              }`}>
                RP
              </span>
            </div>
            <div className="text-base sm:text-lg font-bold text-white font-mono tracking-tight">
              {formatRupiah(unpaidVoucherNominal)}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 w-full">
            <span className="text-[11px] font-semibold text-amber-400/90">
              {unpaidVoucherRequests.length} pengajuan belum cair
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                selectedCategory === 'voucher' ? 'rotate-180 text-amber-400' : 'group-hover:text-amber-400'
              }`}
            />
          </div>
        </button>

        {/* Kolom 3: Lembur */}
        <button
          type="button"
          onClick={() => toggleCategory('lembur')}
          className={`group relative text-left w-full rounded-2xl p-4 transition-all duration-200 transform active:scale-95 cursor-pointer touch-manipulation flex flex-col justify-between ${
            selectedCategory === 'lembur'
              ? 'bg-slate-900 border-2 border-orange-500 ring-2 ring-orange-500/40 shadow-xl shadow-orange-950/40 -translate-y-0.5'
              : 'bg-slate-900 border border-slate-800 hover:border-orange-500/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-950/20'
          }`}
        >
          <div className="w-full">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className={`text-xs font-semibold transition ${selectedCategory === 'lembur' ? 'text-orange-400 font-bold' : 'group-hover:text-slate-200'}`}>
                Lembur
              </span>
              <div className={`p-1.5 rounded-xl border transition ${selectedCategory === 'lembur' ? 'bg-orange-500/20 border-orange-500/40' : 'bg-orange-500/10 border-orange-500/20 group-hover:bg-orange-500/20'}`}>
                <Clock className="w-4 h-4 text-orange-400" />
              </div>
            </div>
            <div className="text-base sm:text-lg font-bold text-white font-mono tracking-tight">
              {formatRupiah(unpaidOvertimeNominal)}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 w-full">
            <span className="text-[11px] font-semibold text-orange-400/90">
              {unpaidOvertimeRequests.length} pengajuan belum cair
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                selectedCategory === 'lembur' ? 'rotate-180 text-orange-400' : 'group-hover:text-orange-400'
              }`}
            />
          </div>
        </button>

        {/* Kolom 4: Telah Disetujui */}
        <button
          type="button"
          onClick={() => toggleCategory('approved')}
          className={`group relative text-left w-full rounded-2xl p-4 transition-all duration-200 transform active:scale-95 cursor-pointer touch-manipulation flex flex-col justify-between ${
            selectedCategory === 'approved'
              ? 'bg-slate-900 border-2 border-emerald-500 ring-2 ring-emerald-500/40 shadow-xl shadow-emerald-950/40 -translate-y-0.5'
              : 'bg-slate-900 border border-slate-800 hover:border-emerald-500/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-950/20'
          }`}
        >
          <div className="w-full">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className={`text-xs font-semibold transition ${selectedCategory === 'approved' ? 'text-emerald-400 font-bold' : 'group-hover:text-slate-200'}`}>
                Telah Disetujui
              </span>
              <div className={`p-1.5 rounded-xl border transition ${selectedCategory === 'approved' ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20'}`}>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="text-base sm:text-lg font-bold text-emerald-400 tracking-tight">
              {approvedCount} transaksi
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 w-full">
            <span className="text-[11px] font-semibold text-emerald-400/90">
              {approvedUnpaidRequests.length > 0
                ? `${approvedUnpaidRequests.length} siap dicairkan finance`
                : 'Semua telah dicairkan'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                selectedCategory === 'approved' ? 'rotate-180 text-emerald-400' : 'group-hover:text-emerald-400'
              }`}
            />
          </div>
        </button>
      </div>

      {/* INLINE EXPANDED DETAILS: Direct visibility beneath cards on Web & Android */}
      {activeData && (
        <div
          ref={detailPanelRef}
          className="bg-slate-900/95 border-2 border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-2xl shadow-black/60 animate-in fade-in slide-in-from-top-3 duration-200 space-y-4"
        >
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl border ${activeData.iconColor}`}>
                <activeData.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-white">{activeData.title}</h3>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${activeData.badgeColor}`}>
                    {activeData.items.length} Data
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{activeData.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                title="Buka Layar Penuh"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition border border-slate-700 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Layar Penuh</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                title="Tutup Detail"
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Category Tabs Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('petty_cash')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer whitespace-nowrap ${
                selectedCategory === 'petty_cash'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-950/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Petty Cash ({unpaidPettyCashRequests.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('voucher')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer whitespace-nowrap ${
                selectedCategory === 'voucher'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-950/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Voucher ({unpaidVoucherRequests.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('lembur')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer whitespace-nowrap ${
                selectedCategory === 'lembur'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-950/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Lembur ({unpaidOvertimeRequests.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('approved')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer whitespace-nowrap ${
                selectedCategory === 'approved'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-950/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Disetujui ({approvedRequests.length})
            </button>
          </div>

          {/* Total Nominal Summary Banner */}
          <div className="px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Total Nominal Kategori Ini:</span>
            <span className="text-sm sm:text-base font-black text-white font-mono">
              {formatRupiah(activeData.totalNominal)}
            </span>
          </div>

          {/* List of Item Cards */}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {activeData.items.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-2 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                <p className="text-sm font-semibold">Tidak ada pengajuan dalam kategori ini</p>
                <p className="text-xs text-slate-500">Semua pengajuan telah dicairkan atau belum dibuat.</p>
              </div>
            ) : (
              activeData.items.map((item, idx) => renderItemCard(item, idx))
            )}
          </div>
        </div>
      )}

      {/* POPUP FULLSCREEN MODAL (If user wants modal view) */}
      {isModalOpen && activeData && (
        <div
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-black overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border ${activeData.iconColor}`}>
                  <activeData.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{activeData.title}</h3>
                  <p className="text-xs text-slate-400">{activeData.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {activeData.items.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <AlertCircle className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                  <p className="text-sm font-semibold">Tidak ada pengajuan dalam kategori ini</p>
                </div>
              ) : (
                activeData.items.map((item, idx) => renderItemCard(item, idx))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                Total: <strong className="text-white">{formatRupiah(activeData.totalNominal)}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
