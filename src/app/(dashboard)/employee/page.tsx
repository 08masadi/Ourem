import { getEmployeeRequests } from '@/actions/requests';
import RequestList from '@/components/requests/RequestList';
import { extractOvertimeFromDescription } from '@/lib/formatters';
import { Clock, CheckCircle2, Wallet, Layers } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EmployeeDashboardPage() {
  const requests = await getEmployeeRequests();

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
      {/* Top Banner with Total Unpaid Claim Balance */}
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs font-bold text-orange-200 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            <span>Dashboard Karyawan • Ourem Gen 2</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black">
            Klaim Operasional & Form Lembur
          </h1>
          <p className="text-xs text-orange-100 mt-1 max-w-md">
            Ajukan klaim kas kecil (petty cash), voucher operasional, atau form lembur resmi, serta cetak / export PDF resmi.
          </p>
        </div>

        {/* Total Saldo Belum Dicairkan (Transparan tanpa kolom kotak, angka besar) */}
        <div className="text-left sm:text-right shrink-0">
          <div className="text-xs font-bold text-orange-200 uppercase tracking-wider mb-1">
            Total Saldo Belum Dicairkan
          </div>
          <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-white font-mono tracking-tight drop-shadow-sm">
            {formatRupiah(totalUnpaidNominal)}
          </div>
          <div className="text-xs text-orange-100 font-medium mt-1">
            {unpaidRequests.length} pengajuan belum dicairkan
          </div>
        </div>
      </div>

      {/* Metrics Cards: Category breakdown (Petty Cash, Voucher, Lembur) & Telah Disetujui */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Kolom 1: Petty Cash */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Petty Cash</span>
            <Wallet className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-white font-mono">
            {formatRupiah(unpaidPettyCashNominal)}
          </div>
          <div className="text-[11px] text-orange-400/80 mt-1">
            {unpaidPettyCashRequests.length} pengajuan belum cair
          </div>
        </div>

        {/* Kolom 2: Voucher Reimbursement */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Voucher Reimbursement</span>
            <span className="text-[11px] font-black tracking-tight text-amber-400 border border-amber-500/40 px-1 py-0.5 rounded bg-amber-500/10 font-mono">
              RP
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold text-white font-mono">
            {formatRupiah(unpaidVoucherNominal)}
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1">
            {unpaidVoucherRequests.length} pengajuan belum cair
          </div>
        </div>

        {/* Kolom 3: Lembur (Di sisi kiri Telah Disetujui) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Lembur</span>
            <Clock className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-white font-mono">
            {formatRupiah(unpaidOvertimeNominal)}
          </div>
          <div className="text-[11px] text-orange-400/80 mt-1">
            {unpaidOvertimeRequests.length} pengajuan belum cair
          </div>
        </div>

        {/* Kolom 4: Telah Disetujui (Di sisi paling kanan) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Telah Disetujui</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-base sm:text-lg font-bold text-emerald-400">
            {approvedCount} transaksi
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Siap dicairkan finance</div>
        </div>
      </div>

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
