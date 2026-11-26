import { getEmployeeRequests } from '@/actions/requests';
import { getCurrentUserProfile } from '@/actions/auth';
import RequestList from '@/components/requests/RequestList';
import EmployeeMetricsCards from '@/components/requests/EmployeeMetricsCards';
import { extractOvertimeFromDescription } from '@/lib/formatters';
import { Clock, CheckCircle2, Wallet, Layers } from 'lucide-react';
import Link from 'next/link';
import BannerAvatar from '@/components/layout/BannerAvatar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EmployeeDashboardPage() {
  const [requests, profile] = await Promise.all([
    getEmployeeRequests(),
    getCurrentUserProfile(),
  ]);

  // Helper untuk mengenali kategori pengajuan
  const isOvertimeReq = (r: any) =>
    r.reimbursement_type === 'Lembur' ||
    r.account === 'Lembur' ||
    r.title?.startsWith('Form Lembur');

  const isVoucherReq = (r: any) =>
    !isOvertimeReq(r) && r.reimbursement_type === 'Voucher';

  const isPettyCashReq = (r: any) =>
    !isOvertimeReq(r) && !isVoucherReq(r);

  // Helper untuk mengambil nominal akurat (termasuk overtime yang disimpan di metadata)
  const getRequestNominal = (r: any) => {
    if (isOvertimeReq(r)) {
      const ov = extractOvertimeFromDescription(r.description);
      if (ov && typeof ov.nominal === 'number') {
        return ov.nominal;
      }
      return Number(r.amount) <= 1 ? 0 : Number(r.amount) || 0;
    }
    return Number(r.amount) || 0;
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

  // Total semua saldo yang diklaim dan belum dicairkan (Petty Cash + Voucher + Lembur)
  const totalUnpaidNominal =
    unpaidPettyCashNominal + unpaidVoucherNominal + unpaidOvertimeNominal;

  // Telah Disetujui
  const approvedCount = requests.filter(
    (r) => r.title !== '[DELETED]' && r.status === 'Disetujui'
  ).length;

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Total Unpaid Claim Balance & Profile Photo on Right */}
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-row justify-between items-center gap-4">
        {/* Left: Saldo Belum Dicairkan */}
        <div className="space-y-1">
          <div className="text-xs sm:text-sm font-bold text-orange-100 uppercase tracking-wider" style={{ color: '#ffedd5', textShadow: 'none', filter: 'none' }}>
            Total Saldo Belum Dicairkan
          </div>
          <div className="text-2xl sm:text-4xl lg:text-5xl font-black text-white font-mono tracking-tight" style={{ color: '#ffffff', textShadow: 'none', filter: 'none' }}>
            {formatRupiah(totalUnpaidNominal)}
          </div>
          <div className="text-xs text-orange-100/90 font-medium" style={{ color: '#ffedd5', textShadow: 'none', filter: 'none' }}>
            {unpaidRequests.length} pengajuan belum dicairkan
          </div>
        </div>

        {/* Right: Foto Profil Akun (Tanpa kotak & teks, klik untuk melihat ukuran besar) */}
        <BannerAvatar
          avatarUrl={profile?.avatar_url}
          fullName={profile?.full_name}
          email={profile?.email}
          role={profile?.role}
          department={profile?.department}
        />
      </div>

      {/* Metrics Cards: Category breakdown (Petty Cash, Voucher, Lembur) & Telah Disetujui */}
      <EmployeeMetricsCards requests={requests} />

      {/* Interactive Request List with Type Filter, Checkbox Batching, & PDF Export */}
      <RequestList
        initialRequests={requests}
        currentRole="employee"
        title="Riwayat Pengajuan Saya"
        subtitle="Pilih pengajuan untuk di-export ke format PDF resmi Petty Cash / Voucher / Form Lembur"
      />
    </div>
  );
}
