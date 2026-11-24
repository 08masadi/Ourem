import { getAllRequests } from '@/actions/requests';
import { getCurrentUserProfile } from '@/actions/auth';
import RequestList from '@/components/requests/RequestList';
import BannerAvatar from '@/components/layout/BannerAvatar';
import { extractOvertimeFromDescription } from '@/lib/formatters';
import { CheckSquare, Clock, CheckCircle2, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DirectorDashboardPage() {
  const [allRequests, profile] = await Promise.all([
    getAllRequests(),
    getCurrentUserProfile(),
  ]);

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

  const pendingRequests = allRequests.filter((r) => r.status === 'Menunggu Approval');
  const approvedRequests = allRequests.filter((r) => r.status === 'Disetujui');
  const paidRequests = approvedRequests.filter((r) => r.payment_status === 'Paid');

  const pendingAmount = pendingRequests.reduce((acc, curr) => acc + getRequestNominal(curr), 0);
  const approvedAmount = approvedRequests.reduce((acc, curr) => acc + getRequestNominal(curr), 0);
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
      {/* Top Banner with BannerAvatar on Right */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 rounded-2xl p-4 sm:p-5 text-white shadow-lg flex flex-row justify-between items-center gap-4">
        <div>
          <div className="text-[11px] sm:text-xs font-bold text-amber-200 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Persetujuan Direksi (Approval)</span>
          </div>
          <h1 className="text-lg sm:text-xl font-black">
            Persetujuan Lembur
          </h1>
        </div>

        <BannerAvatar
          avatarUrl={profile?.avatar_url}
          fullName={profile?.full_name}
          email={profile?.email}
          role={profile?.role}
          department={profile?.department}
        />
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Perlu Disetujui */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Perlu Disetujui</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-400">
            {formatRupiah(pendingAmount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            {pendingRequests.length} klaim
          </div>
        </div>

        {/* Card 2: Telah Disetujui */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Telah Disetujui</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
            {formatRupiah(approvedAmount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            {approvedRequests.length} klaim
          </div>
        </div>

        {/* Card 3: Sudah Ditransfer (Pengganti Ditolak) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Sudah Ditransfer</span>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-teal-400">
            {formatRupiah(paidAmount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            {paidRequests.length} klaim
          </div>
        </div>

        {/* Card 4: Total Masuk */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Masuk</span>
            <span className="text-[11px] font-black tracking-tight text-orange-400 border border-orange-500/40 px-1 py-0.5 rounded bg-orange-500/10 font-mono">
              RP
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold text-white font-mono">
            {allRequests.length} klaim
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Semua divisi</div>
        </div>
      </div>

      {/* Interactive Approval List */}
      <RequestList
        initialRequests={allRequests}
        currentRole="director"
        title="Daftar Klaim"
        subtitle="Klik 'Setujui' untuk memproses pengajuan operasional"
      />
    </div>
  );
}
