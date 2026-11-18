import { getAllRequests } from '@/actions/requests';
import RequestList from '@/components/requests/RequestList';
import { extractOvertimeFromDescription } from '@/lib/formatters';
import { CreditCard, CheckCircle2, Clock, Wallet } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FinanceDashboardPage() {
  const allRequests = await getAllRequests();

  const getRequestNominal = (curr: any) => {
    const isOvertime =
      curr.reimbursement_type === 'Lembur' ||
      curr.account === 'Lembur' ||
      curr.title?.startsWith('Form Lembur');
    if (isOvertime) {
      const ov = extractOvertimeFromDescription(curr.description);
      if (ov && typeof ov.nominal === 'number') {
        return ov.nominal;
      }
      return Number(curr.amount) <= 1 ? 0 : Number(curr.amount) || 0;
    }
    return Number(curr.amount) || 0;
  };

  // Requests that director has approved are ready for finance processing
  const approvedRequests = allRequests.filter((r) => r.status === 'Disetujui');
  const unpaidRequests = approvedRequests.filter((r) => r.payment_status === 'Unpaid');
  const paidRequests = approvedRequests.filter((r) => r.payment_status === 'Paid');

  const unpaidAmount = unpaidRequests.reduce((acc, curr) => acc + getRequestNominal(curr), 0);
  const paidAmount = paidRequests.reduce((acc, curr) => acc + getRequestNominal(curr), 0);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="text-[11px] sm:text-xs font-bold text-emerald-200 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" />
          <span>Keuangan & Pembayaran (Finance)</span>
        </div>
        <h1 className="text-lg sm:text-xl font-black">
          Pembayaran Reimbursement dan Overtime
        </h1>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Siap Ditransfer (Unpaid) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Siap Ditransfer (Unpaid)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-400">
            {formatRupiah(unpaidAmount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            {unpaidRequests.length} klaim
          </div>
        </div>

        {/* Card 2: Sudah Ditransfer (Paid) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Sudah Ditransfer (Paid)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
            {formatRupiah(paidAmount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            {paidRequests.length} klaim
          </div>
        </div>

        {/* Card 3: Total Klaim Disetujui */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Klaim Disetujui</span>
            <Wallet className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-white font-mono">
            {formatRupiah(unpaidAmount + paidAmount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            {approvedRequests.length} klaim disetujui
          </div>
        </div>

        {/* Card 4: Total Seluruh Transaksi */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Seluruh Transaksi</span>
            <span className="text-[11px] font-black tracking-tight text-orange-400 border border-orange-500/40 px-1 py-0.5 rounded bg-orange-500/10 font-mono">
              RP
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-white font-mono">
            {allRequests.length} klaim
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Semua status</div>
        </div>
      </div>

      {/* Interactive Finance Request List */}
      <RequestList
        initialRequests={allRequests}
        currentRole="finance"
        title="Daftar Pembayaran"
        subtitle="Setujui pengajuan petty cash / voucher, dan klik 'Cairkan Dana' untuk mencatat transfer lunas"
      />
    </div>
  );
}
