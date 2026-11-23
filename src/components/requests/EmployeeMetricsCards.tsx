'use client';

import React, { useState, useRef } from 'react';
import { ReimbursementRequest } from '@/types/database';
import {
  extractOvertimeFromDescription,
  parseAccountBlocksFromDescription,
} from '@/lib/formatters';
import {
  Wallet,
  Clock,
  CheckCircle2,
  X,
  ChevronDown,
} from 'lucide-react';

interface EmployeeMetricsCardsProps {
  requests: ReimbursementRequest[];
}

type MetricCategory = 'petty_cash' | 'voucher' | 'lembur' | 'approved' | null;

interface RekapanRow {
  id: string;
  tanggal: string;
  jenis: string;
  account: string;
  nominal: number;
  statusText: string;
  statusType: 'pending' | 'unpaid' | 'paid' | 'rejected';
}

export default function EmployeeMetricsCards({ requests }: EmployeeMetricsCardsProps) {
  const [selectedCategory, setSelectedCategory] = useState<MetricCategory>(null);
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
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
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
      setTimeout(() => {
        detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  // Generate daftar baris rekapan dengan 5 kolom: Tanggal, Jenis, Account, Nominal, Status
  const getRekapanRows = (): RekapanRow[] => {
    if (!selectedCategory) return [];

    let targetRequests: ReimbursementRequest[] = [];
    if (selectedCategory === 'petty_cash') targetRequests = unpaidPettyCashRequests;
    else if (selectedCategory === 'voucher') targetRequests = unpaidVoucherRequests;
    else if (selectedCategory === 'lembur') targetRequests = unpaidOvertimeRequests;
    else if (selectedCategory === 'approved') targetRequests = approvedRequests;

    const rows: RekapanRow[] = [];

    targetRequests.forEach((req) => {
      const isOvertime = isOvertimeReq(req);
      const isApproved = req.status === 'Disetujui';
      const isPaid = req.payment_status === 'Paid';
      const isRejected = req.status === 'Ditolak';

      let statusText = 'Menunggu Approval';
      let statusType: RekapanRow['statusType'] = 'pending';
      if (isRejected) {
        statusText = 'Ditolak';
        statusType = 'rejected';
      } else if (isApproved && isPaid) {
        statusText = 'Sudah Ditransfer (PAID)';
        statusType = 'paid';
      } else if (isApproved && !isPaid) {
        statusText = 'Siap Dicairkan (UNPAID)';
        statusType = 'unpaid';
      }

      if (isOvertime) {
        const ov = extractOvertimeFromDescription(req.description);
        const tgl = ov?.tanggal_lembur || req.request_date || req.created_at;
        const acc = ov?.nama_pekerjaan || req.account || 'Lembur';
        const nom = getRequestNominal(req);
        rows.push({
          id: `${req.id}-ov`,
          tanggal: formatDateIndo(tgl),
          jenis: 'Lembur',
          account: acc,
          nominal: nom,
          statusText,
          statusType,
        });
      } else {
        const determinedType = req.reimbursement_type || 'Petty Cash';
        const blocks = parseAccountBlocksFromDescription(
          req.description,
          req.account || req.category,
          Number(req.amount) || 0,
          req.customer,
          req.receipt_url
        );

        // Jika request memiliki banyak sub-rincian account blocks dengan nominal valid
        const hasValidBlocks =
          blocks.length > 1 && blocks.some((b) => (Number(b.amount) || 0) > 0);

        if (hasValidBlocks) {
          blocks.forEach((b, bIdx) => {
            const tgl =
              b.receipt_date ||
              b.entries?.[0]?.receipt_date ||
              req.request_date ||
              req.created_at;
            const acc = b.account || req.account || req.category || 'Biaya';
            const nom = Number(b.amount) || 0;
            rows.push({
              id: `${req.id}-b-${bIdx}`,
              tanggal: formatDateIndo(tgl),
              jenis: determinedType,
              account: acc,
              nominal: nom,
              statusText,
              statusType,
            });
          });
        } else {
          // 1 Baris tunggal per pengajuan
          const tgl =
            blocks[0]?.receipt_date ||
            blocks[0]?.entries?.[0]?.receipt_date ||
            req.request_date ||
            req.created_at;
          const acc =
            blocks[0]?.account || req.account || req.category || 'Biaya';
          const nom = getRequestNominal(req);
          rows.push({
            id: `${req.id}`,
            tanggal: formatDateIndo(tgl),
            jenis: determinedType,
            account: acc,
            nominal: nom,
            statusText,
            statusType,
          });
        }
      }
    });

    return rows;
  };

  const rekapanRows = getRekapanRows();
  const totalNominalRekapan = rekapanRows.reduce((acc, curr) => acc + curr.nominal, 0);

  return (
    <div className="space-y-4">
      {/* 4 Kartu Ringkasan Interaktif: Native button untuk respon instan Web & Android */}
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
              <span
                className={`text-xs font-semibold transition ${
                  selectedCategory === 'petty_cash' ? 'text-orange-400 font-bold' : 'group-hover:text-slate-200'
                }`}
              >
                Petty Cash
              </span>
              <div
                className={`p-1.5 rounded-xl border transition ${
                  selectedCategory === 'petty_cash'
                    ? 'bg-orange-500/20 border-orange-500/40'
                    : 'bg-orange-500/10 border-orange-500/20 group-hover:bg-orange-500/20'
                }`}
              >
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
              <span
                className={`text-xs font-semibold transition ${
                  selectedCategory === 'voucher' ? 'text-amber-400 font-bold' : 'group-hover:text-slate-200'
                }`}
              >
                Voucher Reimbursement
              </span>
              <span
                className={`text-[11px] font-black tracking-tight border px-1.5 py-0.5 rounded font-mono transition ${
                  selectedCategory === 'voucher'
                    ? 'text-amber-300 border-amber-500/60 bg-amber-500/20'
                    : 'text-amber-400 border-amber-500/40 bg-amber-500/10 group-hover:bg-amber-500/20'
                }`}
              >
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
              <span
                className={`text-xs font-semibold transition ${
                  selectedCategory === 'lembur' ? 'text-orange-400 font-bold' : 'group-hover:text-slate-200'
                }`}
              >
                Lembur
              </span>
              <div
                className={`p-1.5 rounded-xl border transition ${
                  selectedCategory === 'lembur'
                    ? 'bg-orange-500/20 border-orange-500/40'
                    : 'bg-orange-500/10 border-orange-500/20 group-hover:bg-orange-500/20'
                }`}
              >
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
              <span
                className={`text-xs font-semibold transition ${
                  selectedCategory === 'approved' ? 'text-emerald-400 font-bold' : 'group-hover:text-slate-200'
                }`}
              >
                Telah Disetujui
              </span>
              <div
                className={`p-1.5 rounded-xl border transition ${
                  selectedCategory === 'approved'
                    ? 'bg-emerald-500/20 border-emerald-500/40'
                    : 'bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20'
                }`}
              >
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

      {/* TAMPILAN DAFTAR KLAIM BERFORMAT REKAPAN: Langsung muncul saat kartu di-klik */}
      {selectedCategory && (
        <div
          ref={detailPanelRef}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header Bar Rekapan */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Daftar Rekapan Klaim :</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedCategory === 'petty_cash'
                      ? 'text-orange-400 bg-orange-500/10 border border-orange-500/30'
                      : selectedCategory === 'voucher'
                      ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                      : selectedCategory === 'lembur'
                      ? 'text-purple-400 bg-purple-500/10 border border-purple-500/30'
                      : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                  }`}
                >
                  {selectedCategory === 'petty_cash'
                    ? 'Petty Cash'
                    : selectedCategory === 'voucher'
                    ? 'Voucher Reimbursement'
                    : selectedCategory === 'lembur'
                    ? 'Form Lembur'
                    : 'Telah Disetujui'}
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  ({rekapanRows.length} data)
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Tutup Rekapan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabel Rekapan: HANYA Kolom Tanggal, Jenis, Account, Nominal, dan Status */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-950 text-slate-300 font-bold border-b border-slate-800 text-[11px] sm:text-xs uppercase tracking-wider">
                  <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">Tanggal</th>
                  <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">Jenis</th>
                  <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap">Account</th>
                  <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap text-right">Nominal</th>
                  <th className="py-2.5 px-3 sm:px-4 whitespace-nowrap text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rekapanRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      Tidak ada pengajuan dalam kategori ini.
                    </td>
                  </tr>
                ) : (
                  rekapanRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition">
                      {/* 1. Tanggal */}
                      <td className="py-2.5 px-3 sm:px-4 text-slate-300 font-mono whitespace-nowrap">
                        {row.tanggal}
                      </td>

                      {/* 2. Jenis */}
                      <td className="py-2.5 px-3 sm:px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            row.jenis === 'Lembur'
                              ? 'text-purple-400'
                              : row.jenis === 'Voucher'
                              ? 'text-amber-400'
                              : 'text-orange-400'
                          }`}
                        >
                          {row.jenis}
                        </span>
                      </td>

                      {/* 3. Account */}
                      <td className="py-2.5 px-3 sm:px-4 text-white font-medium whitespace-nowrap">
                        {row.account}
                      </td>

                      {/* 4. Nominal */}
                      <td className="py-2.5 px-3 sm:px-4 text-right font-mono font-bold text-orange-400 whitespace-nowrap">
                        {formatRupiah(row.nominal)}
                      </td>

                      {/* 5. Status */}
                      <td className="py-2.5 px-3 sm:px-4 text-center whitespace-nowrap">
                        {row.statusType === 'pending' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            Menunggu Approval
                          </span>
                        )}
                        {row.statusType === 'unpaid' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Siap Dicairkan (UNPAID)
                          </span>
                        )}
                        {row.statusType === 'paid' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                            Sudah Ditransfer (PAID)
                          </span>
                        )}
                        {row.statusType === 'rejected' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            Ditolak
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rekapanRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-950 font-bold border-t-2 border-slate-700">
                    <td
                      colSpan={3}
                      className="py-2.5 px-3 sm:px-4 text-slate-300 text-right uppercase tracking-wider text-xs"
                    >
                      Total Nominal :
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right font-mono text-sm font-black text-white whitespace-nowrap">
                      {formatRupiah(totalNominalRekapan)}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-center text-xs text-slate-400 whitespace-nowrap">
                      {rekapanRows.length} item
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
