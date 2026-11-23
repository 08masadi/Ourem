'use client';

import { useState, useTransition, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  ReimbursementRequest,
  UserRole,
  ReimbursementType,
  ReimbursementVoucherPrintData,
  OvertimeVoucherPrintData,
  MonthlyRecapReportData,
  MonthlyRecapItem,
} from '@/types/database';
import {
  updateDirectorStatus,
  updateFinancePayment,
  deleteReimbursementRequest,
  deleteBatchReimbursementRequests,
  updateBatchDirectorStatus,
  updateBatchFinancePayment,
  deleteReceiptAction,
  getLatestRequests,
} from '@/actions/requests';
import { getGlobalFinanceSignature, getGlobalDirectorSignature, getRequesterProfileInfo } from '@/actions/auth';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Eye,
  FileText,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Printer,
  Download,
  Layers,
  CheckSquare2,
  Square,
  Edit3,
  Trash2,
  X,
} from 'lucide-react';
const ReimbursementVoucherPdf = dynamic(() => import('./ReimbursementVoucherPdf'), { ssr: false });
const OvertimeVoucherPdf = dynamic(() => import('./OvertimeVoucherPdf'), { ssr: false });
const MonthlyRecapReportPdf = dynamic(() => import('./MonthlyRecapReportPdf'), { ssr: false });
const EditRequestModal = dynamic(() => import('./EditRequestModal'), { ssr: false });
const EditOvertimeModal = dynamic(() => import('./EditOvertimeModal'), { ssr: false });
const WordVoucherPreviewModal = dynamic(() => import('./WordVoucherPreviewModal'), { ssr: false });
import { triggerSuccessNotification } from '@/components/ui/DynamicIslandSuccess';
import {
  parseCustomerEntries,
  getCleanDescription,
  formatDetailKeterangan,
  normalizeAccount,
  parseAccountBlocksFromDescription,
  extractOvertimeFromDescription,
  extractMetadataFromDescription,
} from '@/lib/formatters';

interface RequestListProps {
  initialRequests: ReimbursementRequest[];
  currentRole: UserRole;
  title?: string;
  subtitle?: string;
}

const MONTHS = [
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

export default function RequestList({
  initialRequests,
  currentRole,
  title = 'Daftar Pengajuan Reimbursement',
  subtitle = 'Kelola dan pantau seluruh transaksi operasional',
}: RequestListProps) {
  const [requests, setRequests] = useState<ReimbursementRequest[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [typeFilter, setTypeFilter] = useState<string>('Semua');
  const [paymentFilter, setPaymentFilter] = useState<string>('Semua');
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pdfData, setPdfData] = useState<ReimbursementVoucherPrintData | null>(null);
  const [overtimePdfData, setOvertimePdfData] = useState<OvertimeVoucherPrintData | null>(null);
  const [monthlyRecapData, setMonthlyRecapData] = useState<MonthlyRecapReportData | null>(null);
  const [editRequest, setEditRequest] = useState<ReimbursementRequest | null>(null);

  const [selectedRequest, setSelectedRequest] = useState<ReimbursementRequest | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [rejectModalReq, setRejectModalReq] = useState<ReimbursementRequest | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [paymentModalReq, setPaymentModalReq] = useState<ReimbursementRequest | null>(null);
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [wordLoadingId, setWordLoadingId] = useState<string | null>(null);
  const [wordPreviewReq, setWordPreviewReq] = useState<ReimbursementRequest | null>(null);
  const [wordApprovers, setWordApprovers] = useState<{ finSig: any; dirSig: any } | null>(null);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(now.getMonth() + 1).padStart(2, '0')
  );
  const [selectedYear, setSelectedYear] = useState<string>(String(now.getFullYear()));

  // Sync state whenever initialRequests prop changes from Server Component
  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  const getRequesterDisplayName = (item?: ReimbursementRequest | null) => {
    if (!item) return 'Miskadi';
    const rawProfileName = item.profiles?.full_name?.trim();
    const meta = extractMetadataFromDescription(item.description);
    const ov = extractOvertimeFromDescription(item.description);
    const metaName = meta.full_name?.trim();
    const ovName = ov?.nama_karyawan?.trim();
    const anyName = (item as any).nama_karyawan?.trim();

    const isGeneric = (n?: string | null) =>
      !n || ['employee', 'karyawan', 'staff'].includes(n.toLowerCase());

    if (rawProfileName && !isGeneric(rawProfileName)) return rawProfileName;
    if (metaName && !isGeneric(metaName)) return metaName;
    if (ovName && !isGeneric(ovName)) return ovName;
    if (anyName && !isGeneric(anyName)) return anyName;

    const email = (item.profiles?.email || meta.email || '').toLowerCase();
    const phone = (item.profiles as any)?.phone || meta.phone || '';
    const empId = (item.profiles as any)?.employee_id || meta.employee_id || '';
    if (email.includes('miskadi') || phone.includes('085710002923') || empId.includes('CSK-007')) return 'Miskadi';
    if (email.includes('bryan') || phone.includes('3991') || empId.includes('CSK-003')) return 'Bryanda Yudhistira';

    return rawProfileName || metaName || 'Miskadi';
  };

  const handleCloseDetail = () => {
    setSelectedRequest(null);
    if (typeof window !== 'undefined' && window.location.search.includes('requestId')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('requestId');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  };

  // Tangani pembukaan langsung modal detail pengajuan dari notifikasi via URL / Event
  useEffect(() => {
    const openFromId = (id: string) => {
      const found = requests.find((r) => r.id === id);
      if (found) {
        setStatusFilter('Semua');
        setTypeFilter('Semua');
        setSearch('');
        setSelectedRequest(found);
      }
    };

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const reqId = params.get('requestId');
      if (reqId) {
        openFromId(reqId);
      }
    }

    const handleOpenDetailEvent = (e: any) => {
      if (e.detail?.requestId) {
        openFromId(e.detail.requestId);
      }
    };

    window.addEventListener('open-request-detail', handleOpenDetailEvent);
    return () => {
      window.removeEventListener('open-request-detail', handleOpenDetailEvent);
    };
  }, [requests]);

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await getLatestRequests(currentRole);
      if (fresh) {
        setRequests(fresh);
      }
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  // Background live sync every 8 seconds and on window focus
  useEffect(() => {
    const handleFocus = () => handleRefreshData();
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(handleRefreshData, 8000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [currentRole]);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateIndo = (dateStr?: string) => {
    if (!dateStr) return new Date().toLocaleDateString('id-ID');
    const [year, month, day] = dateStr.split('-');
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const filteredRequests = requests.filter((req) => {
    const isOvertime =
      req.reimbursement_type === 'Lembur' ||
      req.account === 'Lembur' ||
      req.title?.startsWith('Form Lembur');

    const matchesStatus =
      statusFilter === 'Semua' || req.status === statusFilter;

    let matchesType = true;
    if (typeFilter === 'Form Lembur') {
      matchesType = isOvertime;
    } else if (typeFilter === 'Petty Cash') {
      matchesType = !isOvertime && (req.reimbursement_type || 'Petty Cash') === 'Petty Cash';
    } else if (typeFilter === 'Voucher') {
      matchesType = !isOvertime && req.reimbursement_type === 'Voucher';
    }

    const matchesPayment =
      paymentFilter === 'Semua' || req.payment_status === paymentFilter;
    const matchesSearch =
      req.title.toLowerCase().includes(search.toLowerCase()) ||
      req.category.toLowerCase().includes(search.toLowerCase()) ||
      (req.customer && req.customer.toLowerCase().includes(search.toLowerCase())) ||
      getRequesterDisplayName(req).toLowerCase().includes(search.toLowerCase());

    return matchesStatus && matchesType && matchesPayment && matchesSearch;
  });

  const selectableRequests = filteredRequests.filter((r) => {
    if (r.payment_status === 'Paid') return false;
    if (currentRole === 'director') {
      // Akun Director HANYA memilih dan menyetujui pengajuan Form Lembur (Petty Cash & Voucher ditangani Finance)
      return (
        r.reimbursement_type === 'Lembur' ||
        r.account === 'Lembur' ||
        r.title?.startsWith('Form Lembur')
      );
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    const target = requests.find((r) => r.id === id);
    if (target?.payment_status === 'Paid') return; // Pengajuan yang sudah cair tidak bisa dipilih
    if (
      currentRole === 'director' &&
      !(
        target?.reimbursement_type === 'Lembur' ||
        target?.account === 'Lembur' ||
        target?.title?.startsWith('Form Lembur')
      )
    ) {
      return; // Di akun Director hanya Form Lembur yang dapat dipilih
    }
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectableRequests.length === 0) return;
    const allSelectableIds = selectableRequests.map((r) => r.id);
    const areAllSelected = allSelectableIds.every((id) => selectedIds.includes(id));

    if (areAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allSelectableIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allSelectableIds])));
    }
  };

  // Get list of unique dates for quick date-based export
  const availableDates = Array.from(
    new Set(filteredRequests.map((r) => r.request_date).filter(Boolean))
  ).sort().reverse();

  // Get list of available years for monthly recap
  const availableYears = Array.from(
    new Set([
      String(now.getFullYear()),
      String(now.getFullYear() - 1),
      ...requests.map((r) => (r.request_date ? r.request_date.split('-')[0] : '')).filter(Boolean),
    ])
  ).sort().reverse();

  const getBestSignature = (targetReqs: ReimbursementRequest[]) => {
    const reqWithSig = targetReqs.find((r) => r.signature_url);
    if (reqWithSig?.signature_url) return reqWithSig.signature_url;
    for (const r of targetReqs) {
      if ((r.profiles as any)?.signature_url) return (r.profiles as any).signature_url;
    }
    return null;
  };

  const getBestFinanceSignature = async () => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('ourem_finance_signature');
      const cachedName = localStorage.getItem('ourem_finance_name');
      if (cached) return { signature: cached, name: cachedName || 'FINANCE DEPT' };
    }
    try {
      const res = await getGlobalFinanceSignature();
      if (res?.signature_url) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('ourem_finance_signature', res.signature_url);
          if (res.full_name) localStorage.setItem('ourem_finance_name', res.full_name);
        }
        return { signature: res.signature_url, name: res.full_name || 'FINANCE DEPT' };
      }
    } catch {}
    return { signature: null, name: 'FINANCE DEPT' };
  };

  const getBestDirectorSignature = async () => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('ourem_director_signature');
      const cachedName = localStorage.getItem('ourem_director_name');
      if (cached) return { signature: cached, name: cachedName || 'DIREKTUR UTAMA' };
    }
    try {
      const res = await getGlobalDirectorSignature();
      if (res?.signature_url) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('ourem_director_signature', res.signature_url);
          if (res.full_name) localStorage.setItem('ourem_director_name', res.full_name);
        }
        return { signature: res.signature_url, name: res.full_name || 'DIREKTUR UTAMA' };
      }
    } catch {}
    return { signature: null, name: 'DIREKTUR UTAMA' };
  };

  const handleDeleteSingle = (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pengajuan reimbursement ini?')) return;
    startTransition(async () => {
      const res = await deleteReimbursementRequest(id);
      if (res?.success) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
      } else if (res?.error) {
        alert(res.error);
      }
    });
  };

  const handleDeleteReceipt = (receiptUrl: string) => {
    if (!selectedRequest) return;
    if (!confirm('Apakah Anda yakin ingin menghapus foto bukti nota ini?')) return;

    startTransition(async () => {
      const res = await deleteReceiptAction(selectedRequest.id, receiptUrl);
      if (res?.success) {
        const updated = {
          ...selectedRequest,
          receipt_url: res.receipt_url,
          description: res.description || selectedRequest.description,
        };
        setSelectedRequest(updated);
        setRequests((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
        triggerSuccessNotification(
          'Foto Berhasil Dihapus',
          'Foto bukti nota telah berhasil dihapus dari pengajuan ini.'
        );
      } else if (res?.error) {
        alert(res.error);
      }
    });
  };

  const handleDeleteBatch = () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Hapus ${selectedIds.length} pengajuan yang dipilih?`)) return;
    startTransition(async () => {
      const res = await deleteBatchReimbursementRequests(selectedIds);
      if (res?.success) {
        setRequests((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
        setSelectedIds([]);
      } else if (res?.error) {
        alert(res.error);
      }
    });
  };

  const handleBatchApprove = () => {
    if (selectedIds.length === 0) return;

    let targetIds: string[] = [];

    if (currentRole === 'director') {
      // Pada akun Director, HANYA setujui Form Lembur yang Menunggu Approval
      targetIds = requests
        .filter(
          (r) =>
            selectedIds.includes(r.id) &&
            r.status === 'Menunggu Approval' &&
            (r.reimbursement_type === 'Lembur' ||
              r.account === 'Lembur' ||
              r.title?.startsWith('Form Lembur'))
        )
        .map((r) => r.id);

      if (targetIds.length === 0) {
        alert('Tidak ada pengajuan Form Lembur yang menunggu persetujuan Director.');
        return;
      }
    } else if (currentRole === 'finance') {
      // Pada akun Finance, bisa menyetujui pengajuan petty cash, voucher, maupun Form Lembur yang Menunggu Approval
      targetIds = requests
        .filter(
          (r) =>
            selectedIds.includes(r.id) &&
            r.status === 'Menunggu Approval'
        )
        .map((r) => r.id);

      if (targetIds.length === 0) {
        alert('Tidak ada pengajuan terpilih yang berstatus "Menunggu Approval".');
        return;
      }
    } else {
      targetIds = selectedIds;
    }

    if (!confirm(`Setujui ${targetIds.length} pengajuan yang dipilih?`)) return;
    startTransition(async () => {
      const res = await updateBatchDirectorStatus(targetIds, 'Disetujui');
      if (res?.success) {
        setRequests((prev) =>
          prev.map((r) =>
            targetIds.includes(r.id)
              ? { ...r, status: 'Disetujui', rejection_reason: null }
              : r
          )
        );
        setSelectedIds((prev) => prev.filter((id) => !targetIds.includes(id)));
        triggerSuccessNotification(
          'Persetujuan Berhasil Disimpan',
          `${targetIds.length} pengajuan telah berhasil disetujui secara resmi.`
        );
      } else if (res?.error) {
        alert(res.error);
      }
    });
  };

  const handleBatchDisburse = () => {
    // Hanya proses pengajuan terpilih yang SUDAH DISETUJUI dan BELUM CAIR
    const approvedToDisburse = requests.filter(
      (r) => selectedIds.includes(r.id) && r.status === 'Disetujui' && r.payment_status !== 'Paid'
    );

    if (approvedToDisburse.length === 0) {
      alert('Tidak ada pengajuan terpilih yang berstatus "Disetujui" untuk dicairkan.');
      return;
    }

    if (!confirm(`Cairkan dana untuk ${approvedToDisburse.length} pengajuan yang telah disetujui?`)) return;

    const idsToDisburse = approvedToDisburse.map((r) => r.id);
    startTransition(async () => {
      const res = await updateBatchFinancePayment(idsToDisburse, 'Paid');
      if (res?.success) {
        setRequests((prev) =>
          prev.map((r) =>
            idsToDisburse.includes(r.id)
              ? { ...r, payment_status: 'Paid', status: 'Disetujui' }
              : r
          )
        );
        setSelectedIds((prev) => prev.filter((id) => !idsToDisburse.includes(id)));
        triggerSuccessNotification(
          'Pencairan Berhasil Disimpan',
          `${idsToDisburse.length} pengajuan telah berhasil dicairkan (PAID).`
        );
      } else if (res?.error) {
        alert(res.error);
      }
    });
  };

  const formatPrintItems = (targetRequests: ReimbursementRequest[], determinedType: ReimbursementType) => {
    return targetRequests.flatMap((item) => {
      const itemType = item.reimbursement_type || determinedType;
      const blocks = parseAccountBlocksFromDescription(
        item.description,
        item.account || item.category,
        Number(item.amount) || 0,
        item.customer,
        item.receipt_url
      );

      return blocks.flatMap((block, bIdx) => {
        const blockAcc = normalizeAccount(block.account || item.account || item.category, itemType);
        const blockAmount = Number(block.amount) || 0;
        const blockId = `${item.id}-blk-${bIdx}`;
        const entries =
          block.entries && block.entries.length > 0
            ? block.entries
            : [{ customer: item.customer || '-', description: item.title }];

        return entries.map((entry) => ({
          account: blockAcc,
          customer: entry.customer || '-',
          description: getCleanDescription(entry.description) || item.title,
          amount: blockAmount,
          receipt_date: (entry as any).receipt_date || item.request_date,
          blockId,
        }));
      });
    });
  };

  const openPdfForDate = async (dateStr: string, forceType?: ReimbursementType) => {
    const dateRequests = requests.filter((r) => r.request_date === dateStr);
    if (dateRequests.length === 0) return;

    const first = dateRequests[0];
    const determinedType = forceType || first.reimbursement_type || 'Petty Cash';

    if (determinedType === 'Lembur') {
      await openPdfForSingle(first);
      return;
    }

    const totalAmount = dateRequests.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const finSig = await getBestFinanceSignature();

    const isPaid = dateRequests.length > 0 && dateRequests.every((r) => r.payment_status === 'Paid');
    const paidReq =
      dateRequests.find((r) => r.payment_status === 'Paid' && r.payment_action_at) ||
      dateRequests.find((r) => r.payment_status === 'Paid') ||
      first;
    const paidDate = paidReq?.payment_action_at
      ? formatDateIndo(paidReq.payment_action_at.split('T')[0])
      : paidReq?.updated_at
      ? formatDateIndo(paidReq.updated_at.split('T')[0])
      : formatDateIndo(dateStr);

    const printData: ReimbursementVoucherPrintData = {
      type: determinedType,
      requestedBy: first.profiles?.full_name || 'MISKADI',
      department: first.department || first.profiles?.department || 'STAFF OPS',
      date: formatDateIndo(dateStr),
      items: formatPrintItems(dateRequests, determinedType),
      totalAmount,
      employeeSignature: getBestSignature(dateRequests),
      financeSignature: isPaid ? finSig.signature : null,
      financeOfficer: isPaid ? (finSig.name || 'FINANCE DEPT') : 'FINANCE DEPT',
      isPaid,
      paidDate: isPaid ? paidDate : null,
    };
    setPdfData(printData);
  };

  const handleOpenWordPreview = async (req: ReimbursementRequest) => {
    try {
      setWordLoadingId(req.id);
      const finSig = await getBestFinanceSignature();
      const dirSig = await getBestDirectorSignature();

      let enrichedReq = req;
      if (req.user_id) {
        try {
          const extra = await getRequesterProfileInfo(req.user_id);
          if (extra) {
            enrichedReq = {
              ...req,
              profiles: {
                ...req.profiles,
                full_name: extra.full_name || req.profiles?.full_name,
                email: extra.email || req.profiles?.email,
                phone: extra.phone || req.profiles?.phone,
                employee_id: extra.employee_id || req.profiles?.employee_id,
                department: extra.department || req.profiles?.department,
                bank_name: extra.bank_name || req.profiles?.bank_name,
                bank_account_number: extra.bank_account_number || req.profiles?.bank_account_number,
                bank_account_holder: extra.bank_account_holder || req.profiles?.bank_account_holder,
              } as any,
            };
          }
        } catch {}
      }

      setWordApprovers({
        finSig: {
          name: finSig.name || 'Dwi N',
          signature: finSig.signature,
        },
        dirSig: {
          name: dirSig.name || 'Adrian Nugroho',
          signature: dirSig.signature,
        },
      });
      setWordPreviewReq(enrichedReq);
    } catch (err: any) {
      console.error('Gagal membuka preview Word:', err);
      alert('Gagal membuka preview: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setWordLoadingId(null);
    }
  };

  const handleExportDocx = async (req: ReimbursementRequest) => {
    try {
      setWordLoadingId(req.id);
      const finSig = await getBestFinanceSignature();
      const dirSig = await getBestDirectorSignature();

      let enrichedReq = req;
      if (req.user_id) {
        try {
          const extra = await getRequesterProfileInfo(req.user_id);
          if (extra) {
            enrichedReq = {
              ...req,
              profiles: {
                ...req.profiles,
                full_name: extra.full_name || req.profiles?.full_name,
                email: extra.email || req.profiles?.email,
                phone: extra.phone || req.profiles?.phone,
                employee_id: extra.employee_id || req.profiles?.employee_id,
                department: extra.department || req.profiles?.department,
                bank_name: extra.bank_name || req.profiles?.bank_name,
                bank_account_number: extra.bank_account_number || req.profiles?.bank_account_number,
                bank_account_holder: extra.bank_account_holder || req.profiles?.bank_account_holder,
              } as any,
            };
          }
        } catch {}
      }

      // Dynamic import docx generator on demand to keep initial bundle lightweight
      const { generateReimbursementDocx, downloadDocxFile } = await import('@/lib/wordVoucherGenerator');

      // Pastikan HANYA mencetak data dari pengajuan ini sendiri (tidak bocor dari/ke pengajuan lain)
      const blob = await generateReimbursementDocx({
        request: enrichedReq,
        sameDateRequests: [enrichedReq],
        financeApprover: {
          name: finSig.name || 'Dwi N',
          signature: finSig.signature,
        },
        directorApprover: {
          name: dirSig.name || 'Adrian Nugroho',
          signature: dirSig.signature,
        },
      });

      const safeName = (req.profiles?.full_name || 'Staff').replace(/\s+/g, '-');
      const safeDate = (req.request_date || '').replace(/\//g, '-');
      const fileName = `Reimbursement-${safeName}-${safeDate}.docx`;

      await downloadDocxFile(blob, fileName);

      triggerSuccessNotification(
        'Dokumen Word Berhasil Dibuat',
        `File ${fileName} telah siap dan diunduh.`
      );
    } catch (err: any) {
      console.error('Gagal membuat dokumen Word:', err);
      alert('Gagal membuat dokumen Word: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setWordLoadingId(null);
    }
  };

  const openPdfForSingle = async (req: ReimbursementRequest) => {
    const isOvertime =
      req.reimbursement_type === 'Lembur' ||
      req.account === 'Lembur' ||
      req.title?.startsWith('Form Lembur');

    if (isOvertime) {
      const ov = extractOvertimeFromDescription(req.description);
      const finSig = await getBestFinanceSignature();
      const dirSig = await getBestDirectorSignature();
      const isApproved = req.status === 'Disetujui';
      const isPaid = req.payment_status === 'Paid';
      const paidDate = req.payment_action_at
        ? formatDateIndo(req.payment_action_at.split('T')[0])
        : req.updated_at
        ? formatDateIndo(req.updated_at.split('T')[0])
        : formatDateIndo(req.request_date);

      const ovPrintData: OvertimeVoucherPrintData = {
        tanggalLembur: ov?.tanggal_lembur
          ? ov.tanggal_lembur.split('-').reverse().join('/')
          : formatDateIndo(req.request_date),
        tipeHari: ov?.tipe_hari || 'hari kerja',
        lokasiLembur: ov?.lokasi_lembur || 'Kantor',
        namaKaryawan: ov?.nama_karyawan || getRequesterDisplayName(req),
        perusahaan: ov?.perusahaan || req.customer || 'PT. CITRA SARI KENCANA',
        namaPekerjaan: ov?.nama_pekerjaan || req.title.replace('Form Lembur - ', ''),
        jamLembur: ov?.jam_lembur || '-',
        uraianPekerjaan: ov?.uraian_pekerjaan || getCleanDescription(req.description),
        nominal: ov?.nominal !== undefined ? ov.nominal : (Number(req.amount) <= 1 ? 0 : Number(req.amount)),
        employeeSignature: req.signature_url || req.profiles?.signature_url || null,
        directorSignature: isApproved ? dirSig.signature : null,
        directorName: isApproved ? (dirSig.name || 'DIREKTUR UTAMA') : null,
        financeSignature: isPaid ? finSig.signature : null,
        financeName: isPaid ? (finSig.name || 'FINANCE DEPT') : null,
        isPaid,
        paidDate: isPaid ? paidDate : null,
      };
      setOvertimePdfData(ovPrintData);
      return;
    }

    // Enrich requester data
    let enrichedReq = req;
    if (req.user_id) {
      try {
        const extra = await getRequesterProfileInfo(req.user_id);
        if (extra && extra.full_name) {
          enrichedReq = {
            ...req,
            profiles: {
              ...req.profiles,
              full_name: extra.full_name || req.profiles?.full_name,
              department: extra.department || req.profiles?.department,
            } as any,
          };
        }
      } catch {}
    }

    // Pastikan HANYA mencetak pengajuan ini sendiri (jangan campur dengan pengajuan lain / orang lain)
    const targetRequests = [enrichedReq];
    const totalAmount = Number(enrichedReq.amount) || 0;
    const determinedType = enrichedReq.reimbursement_type || 'Petty Cash';
    const finSig = await getBestFinanceSignature();

    const isPaid = enrichedReq.payment_status === 'Paid';
    const paidDate = enrichedReq.payment_action_at
      ? formatDateIndo(enrichedReq.payment_action_at.split('T')[0])
      : enrichedReq.updated_at
      ? formatDateIndo(enrichedReq.updated_at.split('T')[0])
      : formatDateIndo(enrichedReq.request_date);

    const reqMeta = extractMetadataFromDescription(enrichedReq.description);
    const requesterName =
      enrichedReq.profiles?.full_name ||
      reqMeta.full_name ||
      (enrichedReq as any).nama_karyawan ||
      'Staff';

    const requesterDept =
      enrichedReq.department ||
      enrichedReq.profiles?.department ||
      reqMeta.department ||
      'STAFF OPS';

    const printData: ReimbursementVoucherPrintData = {
      type: determinedType,
      requestedBy: requesterName,
      department: requesterDept,
      date: formatDateIndo(enrichedReq.request_date),
      items: formatPrintItems([enrichedReq], determinedType),
      totalAmount,
      employeeSignature: enrichedReq.signature_url || enrichedReq.profiles?.signature_url || reqMeta.signature_url || null,
      financeSignature: isPaid ? finSig.signature : null,
      financeOfficer: isPaid ? (finSig.name || 'FINANCE DEPT') : 'FINANCE DEPT',
      isPaid,
      paidDate: isPaid ? paidDate : null,
    };
    setPdfData(printData);
  };

  const openPdfForSelected = async (forceType?: ReimbursementType) => {
    const selectedItems = requests.filter((r) => selectedIds.includes(r.id));
    if (selectedItems.length === 0) return;

    const first = selectedItems[0];
    const determinedType = forceType || first.reimbursement_type || 'Petty Cash';

    if (determinedType === 'Lembur') {
      await openPdfForSingle(first);
      return;
    }
    const totalAmount = selectedItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const finSig = await getBestFinanceSignature();

    const isPaid = selectedItems.length > 0 && selectedItems.every((r) => r.payment_status === 'Paid');
    const paidReq =
      selectedItems.find((r) => r.payment_status === 'Paid' && r.payment_action_at) ||
      selectedItems.find((r) => r.payment_status === 'Paid') ||
      first;
    const paidDate = paidReq?.payment_action_at
      ? formatDateIndo(paidReq.payment_action_at.split('T')[0])
      : paidReq?.updated_at
      ? formatDateIndo(paidReq.updated_at.split('T')[0])
      : formatDateIndo(first.request_date);

    const printData: ReimbursementVoucherPrintData = {
      type: determinedType,
      requestedBy: first.profiles?.full_name || 'MISKADI',
      department: first.department || first.profiles?.department || 'STAFF OPS',
      date: formatDateIndo(first.request_date),
      items: formatPrintItems(selectedItems, determinedType),
      totalAmount,
      employeeSignature: getBestSignature(selectedItems),
      financeSignature: isPaid ? finSig.signature : null,
      financeOfficer: isPaid ? (finSig.name || 'FINANCE DEPT') : 'FINANCE DEPT',
      isPaid,
      paidDate: isPaid ? paidDate : null,
    };
    setPdfData(printData);
  };

  const openPdfForMonthYear = async (month: string, year: string, targetType: string) => {
    const isOvertimeFilter = targetType === 'Form Lembur';
    const periodPrefix = `${year}-${month}`;

    // Filter HANYA pengeluaran yang SUDAH DITRANSFER (PAID) oleh Finance ke semua employee yang mengajukan
    const matchingRequests = requests.filter((r) => {
      if (r.title === '[DELETED]') return false;
      if (r.payment_status !== 'Paid') return false; // HANYA PENGELUARAN YANG SUDAH DITRANSFER

      const isOv =
        r.reimbursement_type === 'Lembur' ||
        r.account === 'Lembur' ||
        r.title?.startsWith('Form Lembur');

      if (isOvertimeFilter) {
        if (!isOv) return false;
      } else {
        if (isOv) return false;
        const rType = r.reimbursement_type || 'Petty Cash';
        if (rType !== targetType) return false;
      }

      const reqDate = r.request_date || '';
      const payDate = r.payment_action_at ? r.payment_action_at.split('T')[0] : '';
      return reqDate.startsWith(periodPrefix) || payDate.startsWith(periodPrefix);
    });

    const monthLabel = MONTHS.find((m) => m.value === month)?.label || month;

    if (matchingRequests.length === 0) {
      alert(
        `Tidak ada pengeluaran ${targetType} yang sudah ditransfer (Paid) pada periode ${monthLabel} ${year}.`
      );
      return;
    }

    // Urutkan transaksi berdasarkan tanggal pengajuan/transfer
    matchingRequests.sort((a, b) => (a.request_date || '').localeCompare(b.request_date || ''));

    // Format item untuk laporan rekapan pengeluaran bulanan
    const items: MonthlyRecapItem[] = matchingRequests.map((r, idx) => {
      const isOv =
        r.reimbursement_type === 'Lembur' ||
        r.account === 'Lembur' ||
        r.title?.startsWith('Form Lembur');

      let cleanDesc = getCleanDescription(r.description);
      if (isOv) {
        const ov = extractOvertimeFromDescription(r.description);
        cleanDesc = ov?.uraian_pekerjaan || cleanDesc;
      }
      if (r.customer) {
        cleanDesc = `[${r.customer}] ${cleanDesc}`;
      }

      const empName =
        r.profiles?.full_name ||
        (r as any).nama_karyawan ||
        'Karyawan';
      const dept = r.department || r.profiles?.department || 'Staff OPS';

      // Tanggal Pengajuan (Reimburse ataupun Lembur)
      let submissionDateRaw = r.request_date;
      if (isOv) {
        const ov = extractOvertimeFromDescription(r.description);
        if (ov?.tanggal_lembur) {
          submissionDateRaw = ov.tanggal_lembur;
        }
      }
      if (!submissionDateRaw && r.created_at) {
        submissionDateRaw = r.created_at.split('T')[0];
      }
      const submissionDateFormatted = formatDateIndo(submissionDateRaw);

      // Tanggal Pembayaran
      const paymentDateRaw = r.payment_action_at
        ? r.payment_action_at.split('T')[0]
        : r.updated_at
        ? r.updated_at.split('T')[0]
        : r.request_date;
      const paymentDateFormatted = formatDateIndo(paymentDateRaw);

      return {
        no: idx + 1,
        id: r.id,
        employeeName: empName,
        submissionDate: submissionDateFormatted,
        department: dept,
        date: paymentDateFormatted,
        paymentDate: paymentDateFormatted,
        description: cleanDesc,
        amount: Number(r.amount) || 0,
      };
    });

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const finSig = await getBestFinanceSignature();
    const dirSig = await getBestDirectorSignature();

    const title = `LAPORAN REKAPITULASI PEMBAYARAN ${targetType.toUpperCase()}`;

    const recapData: MonthlyRecapReportData = {
      title,
      type: (targetType === 'Form Lembur' ? 'Lembur' : targetType) as ReimbursementType,
      periodMonth: monthLabel,
      periodYear: year,
      periodLabel: `${monthLabel} ${year}`,
      printedAt: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      items,
      totalAmount,
      financeSignature: finSig.signature,
      financeName: finSig.name,
      directorSignature: dirSig.signature,
      directorName: dirSig.name,
    };

    setMonthlyRecapData(recapData);
  };

  const handleApprove = (reqId: string) => {
    startTransition(async () => {
      const res = await updateDirectorStatus(reqId, 'Disetujui');
      if (res?.success) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === reqId
              ? { ...r, status: 'Disetujui', rejection_reason: null }
              : r
          )
        );
        if (selectedRequest?.id === reqId) {
          setSelectedRequest((prev) =>
            prev ? { ...prev, status: 'Disetujui', rejection_reason: null } : null
          );
        }
        triggerSuccessNotification(
          'Persetujuan Berhasil Disimpan',
          'Form lembur telah resmi disetujui oleh Direktur.'
        );
      }
    });
  };

  const handleRejectConfirm = () => {
    if (!rejectModalReq) return;
    const reqId = rejectModalReq.id;

    startTransition(async () => {
      const res = await updateDirectorStatus(reqId, 'Ditolak', rejectReason);
      if (res?.success) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === reqId
              ? { ...r, status: 'Ditolak', rejection_reason: rejectReason }
              : r
          )
        );
        setRejectModalReq(null);
        setRejectReason('');
      }
    });
  };

  const handlePaymentConfirm = () => {
    if (!paymentModalReq) return;
    const reqId = paymentModalReq.id;

    startTransition(async () => {
      const res = await updateFinancePayment(reqId, 'Paid', paymentNote);
      if (res?.success) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === reqId
              ? { ...r, payment_status: 'Paid', payment_note: paymentNote }
              : r
          )
        );
        setPaymentModalReq(null);
        setPaymentNote('');
        triggerSuccessNotification(
          'Pencairan Berhasil Disimpan',
          'Klaim telah berhasil ditandai sebagai dicairkan (PAID).'
        );
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white">{title}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Cari pengajuan / customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Filter Bar: Jenis, Status, Pembayaran (Dropdown & Sejajar) & Sync Data */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/60 p-2.5 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Dropdown Filter Jenis */}
          <div className="flex-1 min-w-[125px] sm:flex-initial flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs shadow-sm focus-within:ring-2 focus-within:ring-orange-500 transition">
            <Layers className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="text-slate-400 font-semibold hidden md:inline shrink-0">Jenis:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer w-full pr-1 truncate"
              title="Pilih Jenis Pengajuan"
              aria-label="Filter berdasarkan jenis pengajuan"
            >
              <option value="Semua" className="bg-slate-900 text-white">Semua Jenis</option>
              <option value="Petty Cash" className="bg-slate-900 text-white">Petty Cash</option>
              <option value="Voucher" className="bg-slate-900 text-white">Voucher</option>
              <option value="Form Lembur" className="bg-slate-900 text-white">Form Lembur</option>
            </select>
          </div>

          {/* Dropdown Filter Status */}
          <div className="flex-1 min-w-[125px] sm:flex-initial flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs shadow-sm focus-within:ring-2 focus-within:ring-orange-500 transition">
            <Filter className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="text-slate-400 font-semibold hidden md:inline shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer w-full pr-1 truncate"
              title="Pilih Status Approval"
              aria-label="Filter berdasarkan status approval"
            >
              <option value="Semua" className="bg-slate-900 text-white">Semua Status</option>
              <option value="Menunggu Approval" className="bg-slate-900 text-white">Menunggu Approval</option>
              <option value="Disetujui" className="bg-slate-900 text-white">Disetujui</option>
              {currentRole !== 'director' && currentRole !== 'finance' && (
                <option value="Ditolak" className="bg-slate-900 text-white">Ditolak</option>
              )}
            </select>
          </div>

          {/* Dropdown Filter Pembayaran (Khusus Akun Finance) */}
          {currentRole === 'finance' && (
            <div className="flex-1 min-w-[135px] sm:flex-initial flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs shadow-sm focus-within:ring-2 focus-within:ring-emerald-500 transition">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-400 font-semibold hidden md:inline shrink-0">Pembayaran:</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="bg-transparent text-emerald-400 font-bold text-xs focus:outline-none cursor-pointer w-full pr-1 truncate"
                title="Pilih Status Pembayaran"
                aria-label="Filter berdasarkan status pembayaran"
              >
                <option value="Semua" className="bg-slate-900 text-white">Semua Pembayaran</option>
                <option value="Unpaid" className="bg-slate-900 text-white">Unpaid (Belum Ditransfer)</option>
                <option value="Paid" className="bg-slate-900 text-white">Paid (Sudah Ditransfer)</option>
              </select>
            </div>
          )}

          {/* Export PDF Controls: Rekapan Bulanan saat jenis dipilih */}
          {typeFilter !== 'Semua' && (
            <div className="flex items-center gap-1.5 animate-in fade-in flex-wrap sm:flex-nowrap w-full sm:w-auto pt-1 sm:pt-0">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex-1 sm:flex-none px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                title="Pilih Bulan Rekap"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value} className="bg-slate-900 text-white">
                    {m.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="flex-1 sm:flex-none px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                title="Pilih Tahun Rekap"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr} className="bg-slate-900 text-white">
                    {yr}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => openPdfForMonthYear(selectedMonth, selectedYear, typeFilter)}
                className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                title={`Export PDF Rekap ${typeFilter} untuk Periode ${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Export PDF Periode</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Baris Kontrol Checklist & Batch Action (Di luar kolom filter, di antara kolom filter dan daftar riwayat pengajuan) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Pilih Semua */}
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={selectableRequests.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            title={
              selectableRequests.length === 0
                ? 'Semua pengajuan telah dicairkan (Paid)'
                : currentRole === 'director'
                ? 'Pilih semua Form Lembur yang belum dicairkan'
                : 'Pilih semua yang belum dicairkan'
            }
          >
            {selectedIds.length > 0 &&
            selectableRequests.length > 0 &&
            selectableRequests.every((r) => selectedIds.includes(r.id)) ? (
              <CheckSquare2 className="w-4 h-4 text-orange-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-500" />
            )}
            <span>Pilih Semua</span>
          </button>

          {/* Batch Action Buttons saat Checklist box dipilih */}
          {selectedIds.length > 0 && (
            <>
              {currentRole === 'director' ? (
                // Akun Director: Tombol Setujui HANYA untuk Form Lembur yang Menunggu Approval
                (() => {
                  const overtimeApprovals = requests.filter(
                    (r) =>
                      selectedIds.includes(r.id) &&
                      r.status === 'Menunggu Approval' &&
                      (r.reimbursement_type === 'Lembur' ||
                        r.account === 'Lembur' ||
                        r.title?.startsWith('Form Lembur'))
                  );
                  if (overtimeApprovals.length === 0) return null;
                  return (
                    <button
                      type="button"
                      onClick={handleBatchApprove}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm animate-in fade-in cursor-pointer disabled:opacity-50"
                      title="Setujui Form Lembur yang dipilih"
                    >
                      {isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Setujui ({overtimeApprovals.length})</span>
                    </button>
                  );
                })()
              ) : currentRole === 'finance' ? (
                // Akun Finance: Tombol Cairkan Dana HANYA MUNCUL KETIKA SUDAH DISETUJUI
                <div className="flex items-center gap-1.5">
                  {requests.some(
                    (r) =>
                      selectedIds.includes(r.id) &&
                      r.status === 'Disetujui' &&
                      r.payment_status !== 'Paid'
                  ) && (
                    <button
                      type="button"
                      onClick={handleBatchDisburse}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm animate-in fade-in cursor-pointer disabled:opacity-50"
                      title="Cairkan dana untuk pengajuan yang telah disetujui"
                    >
                      {isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5" />
                      )}
                      <span>
                        Cairkan Dana (
                        {
                          requests.filter(
                            (r) =>
                              selectedIds.includes(r.id) &&
                              r.status === 'Disetujui' &&
                              r.payment_status !== 'Paid'
                          ).length
                        }
                        )
                      </span>
                    </button>
                  )}

                  {/* Tombol Setujui jika ada pengajuan terpilih yang masih Menunggu Approval - KHUSUS NON-LEMBUR */}
                  {requests.some(
                    (r) =>
                      selectedIds.includes(r.id) &&
                      r.status === 'Menunggu Approval' &&
                      !(r.reimbursement_type === 'Lembur' || r.account === 'Lembur' || r.title?.startsWith('Form Lembur'))
                  ) && (
                    <button
                      type="button"
                      onClick={handleBatchApprove}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition shadow-sm animate-in fade-in cursor-pointer disabled:opacity-50"
                      title="Setujui pengajuan petty cash / voucher terpilih"
                    >
                      {isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>
                        Setujui (
                        {
                          requests.filter(
                            (r) =>
                              selectedIds.includes(r.id) &&
                              r.status === 'Menunggu Approval' &&
                              !(r.reimbursement_type === 'Lembur' || r.account === 'Lembur' || r.title?.startsWith('Form Lembur'))
                          ).length
                        }
                        )
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                // Akun Employee: Tetap tombol Hapus untuk draf / pengajuan sendiri
                <button
                  type="button"
                  onClick={handleDeleteBatch}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 hover:text-white rounded-xl text-xs font-bold transition shadow-sm animate-in fade-in cursor-pointer disabled:opacity-50"
                  title="Hapus semua pengajuan terpilih"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Hapus ({selectedIds.length})</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Counter keterangan jumlah pengajuan jika dipilih */}
        {selectedIds.length > 0 && (
          <span className="text-xs text-slate-400 font-medium">
            {selectedIds.length} pengajuan dipilih
          </span>
        )}
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-slate-800/80 rounded-3xl">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">Belum ada pengajuan</h3>
          <p className="text-xs text-slate-500 mt-1">
            Data pengajuan yang sesuai dengan filter pencarian tidak ditemukan.
          </p>
        </div>
      ) : (
        <div
          onTouchStart={() => {
            if (typeof window !== 'undefined' && (window as any).AndroidApp?.setSwipeRefreshEnabled) {
              (window as any).AndroidApp.setSwipeRefreshEnabled(false);
            }
          }}
          onTouchEnd={() => {
            if (typeof window !== 'undefined' && (window as any).AndroidApp?.setSwipeRefreshEnabled) {
              (window as any).AndroidApp.setSwipeRefreshEnabled(true);
            }
          }}
          onTouchCancel={() => {
            if (typeof window !== 'undefined' && (window as any).AndroidApp?.setSwipeRefreshEnabled) {
              (window as any).AndroidApp.setSwipeRefreshEnabled(true);
            }
          }}
          className="max-h-[380px] sm:max-h-[440px] lg:max-h-[500px] overflow-y-auto space-y-2.5 sm:space-y-3 pr-1.5 sm:pr-2.5 custom-scrollbar overscroll-contain"
        >
          {filteredRequests.map((req) => {
            const isPendingApproval = req.status === 'Menunggu Approval';
            const isApproved = req.status === 'Disetujui';
            const isRejected = req.status === 'Ditolak';
            const isPaid = req.payment_status === 'Paid';
            const isSelected = selectedIds.includes(req.id);
            const isOvertimeReq =
              req.reimbursement_type === 'Lembur' ||
              req.account === 'Lembur' ||
              req.title?.startsWith('Form Lembur');
            const reqType = isOvertimeReq ? 'Lembur' : (req.reimbursement_type || 'Petty Cash');
            const displayTitle = isOvertimeReq
              ? req.title
              : (req.account || req.category || req.title?.split(' - ')[0] || req.title);

            return (
              <div
                key={req.id}
                role="button"
                tabIndex={0}
                aria-label={`Buka detail pengajuan ${displayTitle}, tanggal ${formatDateIndo(req.request_date)}`}
                onClick={() => setSelectedRequest(req)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedRequest(req);
                  }
                }}
                className={`bg-slate-900/90 border rounded-xl sm:rounded-2xl p-3 sm:p-4 transition shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-4 cursor-pointer hover:border-slate-700/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                  isSelected
                    ? 'border-orange-500 bg-orange-950/10'
                    : 'border-slate-800 hover:bg-slate-900'
                }`}
              >
                {/* Checkbox and Left Info */}
                <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0 w-full sm:w-auto">
                  {/* Pengajuan yang dananya sudah dicairkan (PAID) tidak bisa dipilih lewat checklist box */}
                  {isPaid ? (
                    <div
                      className="mt-0.5 text-slate-700 cursor-not-allowed shrink-0 p-1.5"
                      title="Pengajuan ini sudah dicairkan (PAID) dan tidak dapat dipilih lagi"
                      onClick={(e) => e.stopPropagation()}
                      aria-hidden="true"
                    >
                      <Square className="w-4 h-4 text-slate-700/80" />
                    </div>
                  ) : currentRole === 'director' && !isOvertimeReq ? (
                    <div
                      className="mt-0.5 text-slate-700/50 cursor-not-allowed shrink-0 p-1.5"
                      title="Persetujuan Petty Cash & Voucher dilakukan oleh Finance"
                      onClick={(e) => e.stopPropagation()}
                      aria-hidden="true"
                    >
                      <Square className="w-4 h-4 text-slate-700/40" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(req.id);
                      }}
                      className="mt-0.5 text-slate-400 hover:text-white shrink-0 cursor-pointer p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 transition"
                      title={isSelected ? 'Batalkan pilihan' : 'Pilih pengajuan ini'}
                      aria-label={isSelected ? `Batalkan pilihan ${displayTitle}` : `Pilih pengajuan ${displayTitle}`}
                    >
                      {isSelected ? (
                        <CheckSquare2 className="w-4 h-4 text-orange-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  )}

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-slate-400">
                      {/* Reimbursement Type (Tanpa highlight kotak) */}
                      <span
                        className={`font-bold uppercase tracking-wider ${
                          reqType === 'Lembur'
                            ? 'text-purple-400'
                            : reqType === 'Voucher'
                            ? 'text-amber-400'
                            : 'text-orange-400'
                        }`}
                      >
                        {reqType === 'Lembur' ? 'FORM LEMBUR' : reqType}
                      </span>

                      {/* Tanggal (Kategori di samping tanggal dihilangkan) */}
                      <span>• {formatDateIndo(req.request_date)}</span>

                      {/* Pengaju & Department */}
                      <span>
                        • {getRequesterDisplayName(req)} ({req.department || req.profiles?.department || 'Staff OPS'})
                      </span>
                    </div>

                    {/* Judul Pengajuan (Customer di samping kategori pada Petty Cash & Voucher dihilangkan) */}
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                      {displayTitle}
                    </h3>

                    {/* Status Badges & Nominal (Mobile: Sejajar, Desktop: Badges di kiri) */}
                    <div className="flex items-center justify-between sm:justify-start gap-2 pt-0.5 w-full">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isPendingApproval && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            <span>Menunggu Approval</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Disetujui</span>
                          </span>
                        )}
                        {isRejected && currentRole !== 'director' && currentRole !== 'finance' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                            <XCircle className="w-3 h-3" />
                            <span>Ditolak</span>
                          </span>
                        )}

                        {isApproved && (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                              isPaid
                                ? 'text-teal-300 bg-teal-500/10 border-teal-500/30'
                                : 'text-slate-400 bg-slate-800 border-slate-700'
                            }`}
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>{isPaid ? 'Sudah Ditransfer (PAID)' : 'Belum Ditransfer (UNPAID)'}</span>
                          </span>
                        )}
                      </div>

                      {/* Nominal Klaim di Tampilan Mobile (Sejajar di sebelah kanan) */}
                      <div className="text-right sm:hidden shrink-0 ml-auto flex flex-col items-end">
                        <div className="text-[10px] text-slate-400 font-medium leading-tight">Nominal Klaim</div>
                        <div className="text-xs sm:text-sm font-black text-orange-400 font-mono leading-tight">
                          {reqType === 'Lembur' && Number(req.amount) <= 1
                            ? 'Dihitung Direktur'
                            : formatRupiah(req.amount)}
                        </div>
                      </div>
                    </div>

                    {req.rejection_reason && currentRole !== 'director' && currentRole !== 'finance' && (
                      <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-900/50 p-2 rounded-xl mt-1 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400 mt-0.5" />
                        <span>Alasan penolakan: {req.rejection_reason}</span>
                      </div>
                    )}

                    {req.payment_note && (
                      <div className="text-[11px] text-teal-300 bg-teal-950/40 border border-teal-900/50 p-2 rounded-xl mt-1">
                        Catatan Pembayaran: {req.payment_note}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Amount (Desktop: Tampilan kolom kanan kartu) */}
                <div className="hidden sm:flex sm:flex-col items-end justify-center shrink-0 text-right">
                  <div className="text-xs text-slate-400 font-medium">Nominal Klaim</div>
                  <div className="text-base sm:text-lg font-black text-orange-400 font-mono">
                    {reqType === 'Lembur' && Number(req.amount) <= 1
                      ? 'Dihitung Direktur'
                      : formatRupiah(req.amount)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Request Modal */}
      {editRequest && (
        (editRequest.reimbursement_type === 'Lembur' ||
          editRequest.account === 'Lembur' ||
          editRequest.title?.startsWith('Form Lembur')) ? (
          <EditOvertimeModal
            request={editRequest}
            currentRole={currentRole}
            onClose={() => setEditRequest(null)}
            onSuccess={(updated) => {
              setRequests((prev) =>
                prev.map((r) => (r.id === updated.id ? updated : r))
              );
              if (selectedRequest?.id === updated.id) {
                setSelectedRequest(updated);
              }
              triggerSuccessNotification(
                'Perubahan Berhasil Disimpan',
                'Data form lembur telah berhasil diperbarui.'
              );
            }}
          />
        ) : (
          <EditRequestModal
            request={editRequest}
            currentRole={currentRole}
            onClose={() => setEditRequest(null)}
            onSuccess={(updated) => {
              setRequests((prev) =>
                prev.map((r) => (r.id === updated.id ? updated : r))
              );
              if (selectedRequest?.id === updated.id) {
                setSelectedRequest(updated);
              }
              triggerSuccessNotification(
                'Perubahan Berhasil Disimpan',
                'Data pengajuan reimbursement telah berhasil diperbarui.'
              );
            }}
          />
        )
      )}

      {/* Modal: View Details & Receipt */}
      {selectedRequest && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 cursor-pointer"
          onClick={handleCloseDetail}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Detail Pengajuan</h3>
              <button
                onClick={handleCloseDetail}
                className="text-slate-400 hover:text-white text-xs font-bold px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer transition"
              >
                ✕ Tutup
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400">
                    {selectedRequest.reimbursement_type === 'Lembur' || selectedRequest.account === 'Lembur' || selectedRequest.title?.startsWith('Form Lembur')
                      ? 'Jenis Dokumen:'
                      : 'Jenis Reimbursement:'}
                  </span>
                  <p className="text-orange-400 font-bold text-sm uppercase">
                    {selectedRequest.reimbursement_type === 'Lembur' || selectedRequest.account === 'Lembur' || selectedRequest.title?.startsWith('Form Lembur')
                      ? 'FORM LEMBUR'
                      : selectedRequest.reimbursement_type || 'Petty Cash'}
                  </p>
                </div>
              </div>

              {/* Tampilkan Account / Kategori HANYA jika BUKAN Form Lembur */}
              {!(selectedRequest.reimbursement_type === 'Lembur' || selectedRequest.account === 'Lembur' || selectedRequest.title?.startsWith('Form Lembur')) ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400">Account / Kategori:</span>
                    <p className="text-white font-semibold">
                      {selectedRequest.account || selectedRequest.category}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Department:</span>
                    <p className="text-white font-semibold">
                      {selectedRequest.department || selectedRequest.profiles?.department || 'Staff OPS'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400">Department:</span>
                    <p className="text-white font-semibold">
                      {selectedRequest.department || selectedRequest.profiles?.department || 'Staff OPS'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Tanggal:</span>
                    <p className="text-white font-semibold">
                      {formatDateIndo(selectedRequest.request_date)}
                    </p>
                  </div>
                </div>
              )}

              {/* Tanggal & Pengaju (untuk reimburse) atau Pengaju (untuk lembur) */}
              {!(selectedRequest.reimbursement_type === 'Lembur' || selectedRequest.account === 'Lembur' || selectedRequest.title?.startsWith('Form Lembur')) ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400">Tanggal:</span>
                    <p className="text-white font-semibold">
                      {formatDateIndo(selectedRequest.request_date)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Pengaju:</span>
                    <p className="text-white font-semibold">
                      {getRequesterDisplayName(selectedRequest)}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="text-slate-400">Pengaju:</span>
                  <p className="text-white font-semibold">
                    {getRequesterDisplayName(selectedRequest)}
                  </p>
                </div>
              )}

              {/* Klien / Customer if present */}
              {selectedRequest.customer && (
                <div>
                  <span className="text-slate-400">Klien / Customer:</span>
                  <p className="text-white font-semibold">
                    {selectedRequest.customer}
                  </p>
                </div>
              )}

              <div>
                <span className="text-slate-400">Nominal:</span>
                <p className="text-orange-400 font-bold font-mono text-sm">
                  {(selectedRequest.reimbursement_type === 'Lembur' ||
                    selectedRequest.account === 'Lembur' ||
                    selectedRequest.title?.startsWith('Form Lembur')) &&
                  Number(selectedRequest.amount) <= 1
                    ? '(Dihitung oleh Direktur)'
                    : formatRupiah(selectedRequest.amount)}
                </p>
              </div>

              {selectedRequest.description && (
                <div>
                  <span className="text-slate-400">Keterangan:</span>
                  <p className="text-slate-200 bg-slate-950 p-3 rounded-xl border border-slate-800 whitespace-pre-line leading-relaxed font-mono">
                    {formatDetailKeterangan(selectedRequest.description)}
                  </p>
                </div>
              )}

              {/* Bank Account Info for Finance */}
              {selectedRequest.profiles?.bank_account_number && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl">
                  <span className="text-emerald-400 font-bold block mb-1">Rekening Pembayaran:</span>
                  <p className="text-white">
                    {selectedRequest.profiles.bank_name} - {selectedRequest.profiles.bank_account_number}
                  </p>
                  <p className="text-slate-300">a.n. {selectedRequest.profiles.bank_account_holder}</p>
                </div>
              )}

              {/* Receipt Preview (Tampilan Foto Kecil / Compact Thumbnails agar tidak memenuhi layar) */}
              {(() => {
                const parsedBlocks = parseAccountBlocksFromDescription(
                  selectedRequest.description,
                  selectedRequest.account,
                  Number(selectedRequest.amount),
                  selectedRequest.customer,
                  selectedRequest.receipt_url
                );

                const blockReceipts = parsedBlocks
                  .map((b) => b.receipt_url)
                  .filter(Boolean) as string[];

                const allReceipts = Array.from(
                  new Set([selectedRequest.receipt_url, ...blockReceipts].filter(Boolean))
                ) as string[];

                const canDeletePhoto =
                  selectedRequest.payment_status !== 'Paid' &&
                  currentRole !== 'director';

                return (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <span>Bukti Nota / Dokumen</span>
                        {allReceipts.length > 0 && (
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full font-bold">
                            {allReceipts.length}
                          </span>
                        )}
                      </span>
                      {allReceipts.length > 0 && (
                        <span className="text-[10px] text-slate-500">
                          Klik foto untuk perbesar
                        </span>
                      )}
                    </div>

                    {allReceipts.length > 0 ? (
                      <div className="flex flex-wrap gap-2.5 pt-1">
                        {allReceipts.map((url, idx) => (
                          <div
                            key={`receipt-${idx}`}
                            className="relative group flex flex-col items-center"
                          >
                            <div
                              onClick={() => setViewingReceipt(url)}
                              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-slate-800 bg-slate-950 p-1 overflow-hidden cursor-pointer hover:border-orange-500 transition shadow-sm flex items-center justify-center shrink-0"
                              title="Klik untuk melihat foto ukuran penuh"
                            >
                              <img
                                src={url}
                                alt={`Nota ${idx + 1}`}
                                className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition duration-200"
                              />
                            </div>

                            {/* Tombol Hapus Cepat Foto Bukti Nota */}
                            {canDeletePhoto && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteReceipt(url);
                                }}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md cursor-pointer transition z-10"
                                title="Hapus foto bukti nota ini"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}

                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-orange-400 hover:text-orange-300 font-semibold mt-1 flex items-center gap-0.5"
                            >
                              <span>Nota #{idx + 1}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px]">
                        Tidak ada lampiran bukti nota.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Action Buttons Section di Bawah Kolom Lampiran Bukti Nota (Ikon saja tanpa teks) */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-end gap-2">
                {/* Export / Cetak PDF Button (Kecuali Director pada Petty Cash & Voucher) */}
                {!(
                  currentRole === 'director' &&
                  !(
                    selectedRequest.reimbursement_type === 'Lembur' ||
                    selectedRequest.account === 'Lembur' ||
                    selectedRequest.title?.startsWith('Form Lembur')
                  )
                ) && (
                  <button
                    type="button"
                    onClick={() => openPdfForSingle(selectedRequest)}
                    className="p-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white transition flex items-center justify-center cursor-pointer shadow-md"
                    title={
                      selectedRequest.reimbursement_type === 'Lembur' ||
                      selectedRequest.account === 'Lembur' ||
                      selectedRequest.title?.startsWith('Form Lembur')
                        ? 'Cetak Form Lembur (PDF)'
                        : 'Cetak PDF Voucher'
                    }
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}

                {/* Preview & Cetak MS Word (.docx) Button Khusus Akun Finance */}
                {currentRole === 'finance' &&
                  !(
                    selectedRequest.reimbursement_type === 'Lembur' ||
                    selectedRequest.account === 'Lembur' ||
                    selectedRequest.title?.startsWith('Form Lembur')
                  ) && (
                    <button
                      type="button"
                      onClick={() => handleOpenWordPreview(selectedRequest)}
                      disabled={wordLoadingId === selectedRequest.id}
                      className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition flex items-center justify-center cursor-pointer shadow-md disabled:opacity-50"
                      title="Preview & Download Dokumen MS Word (.docx)"
                    >
                      {wordLoadingId === selectedRequest.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </button>
                  )}

                {/* Edit Button: Tampilkan untuk selain Director, atau khusus Form Lembur di akun Director */}
                {(currentRole !== 'director' ||
                  selectedRequest.reimbursement_type === 'Lembur' ||
                  selectedRequest.account === 'Lembur' ||
                  selectedRequest.title?.startsWith('Form Lembur')) &&
                  selectedRequest.payment_status !== 'Paid' && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedRequest;
                        handleCloseDetail();
                        setEditRequest(target);
                      }}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition flex items-center justify-center cursor-pointer border border-slate-700"
                      title={
                        currentRole === 'director'
                          ? 'Hitung / Edit Lembur'
                          : 'Edit Pengajuan'
                      }
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                )}

                {/* Director Approval Actions - KHUSUS FORM LEMBUR */}
                {currentRole === 'director' &&
                  selectedRequest.status === 'Menunggu Approval' &&
                  (selectedRequest.reimbursement_type === 'Lembur' ||
                    selectedRequest.account === 'Lembur' ||
                    selectedRequest.title?.startsWith('Form Lembur')) && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectModalReq(selectedRequest);
                          setRejectReason('');
                        }}
                        disabled={isPending}
                        className="p-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 transition flex items-center justify-center shadow-sm disabled:opacity-50 cursor-pointer"
                        title="Tolak Form Lembur"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleApprove(selectedRequest.id);
                          setSelectedRequest((prev) =>
                            prev ? { ...prev, status: 'Disetujui', rejection_reason: null } : null
                          );
                        }}
                        disabled={isPending}
                        className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center shadow-sm disabled:opacity-50 cursor-pointer"
                        title="Setujui Form Lembur"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                )}

                {/* Finance Approval Actions - BISA SETUJUI SEMUA TERMASUK FORM LEMBUR */}
                {currentRole === 'finance' &&
                  selectedRequest.status === 'Menunggu Approval' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRejectModalReq(selectedRequest);
                          setRejectReason('');
                        }}
                        disabled={isPending}
                        className="p-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 transition flex items-center justify-center shadow-sm disabled:opacity-50 cursor-pointer"
                        title="Tolak Pengajuan"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleApprove(selectedRequest.id);
                          setSelectedRequest((prev) =>
                            prev ? { ...prev, status: 'Disetujui', rejection_reason: null } : null
                          );
                        }}
                        disabled={isPending}
                        className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center shadow-sm disabled:opacity-50 cursor-pointer"
                        title={
                          selectedRequest.reimbursement_type === 'Lembur' ||
                          selectedRequest.account === 'Lembur' ||
                          selectedRequest.title?.startsWith('Form Lembur')
                            ? 'Setujui Form Lembur'
                            : 'Setujui Pengajuan'
                        }
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                )}

                {/* Finance Payment Action - SEMUA TIPE KLAIM YANG DISETUJUI & BELUM CAIR */}
                {currentRole === 'finance' &&
                  selectedRequest.status === 'Disetujui' &&
                  selectedRequest.payment_status !== 'Paid' && (
                    <button
                      type="button"
                      onClick={() => setPaymentModalReq(selectedRequest)}
                      disabled={isPending}
                      className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center shadow-sm disabled:opacity-50 cursor-pointer"
                      title="Cairkan Dana"
                    >
                      <CreditCard className="w-4 h-4" />
                    </button>
                )}

                {/* Employee Delete Action - Draf / Menunggu Approval */}
                {currentRole === 'employee' &&
                  selectedRequest.status === 'Menunggu Approval' && (
                    <button
                      type="button"
                      onClick={() => {
                        const id = selectedRequest.id;
                        handleDeleteSingle(id);
                        setSelectedRequest(null);
                      }}
                      disabled={isPending}
                      className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 transition flex items-center justify-center cursor-pointer"
                      title="Hapus Pengajuan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rejection Reason (Director) */}
      {rejectModalReq && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-bold text-white text-base">Alasan Penolakan Pengajuan</h3>
            <p className="text-xs text-slate-400">
              Tuliskan alasan penolakan agar pengaju dapat memperbaiki atau mengetahui penyebabnya:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalReq(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={isPending || !rejectReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Konfirmasi Tolak</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mark as Paid (Finance) */}
      {paymentModalReq && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-bold text-white text-base">Pencairan Dana (Mark as Paid)</h3>
            <p className="text-xs text-slate-400">
              Pengajuan: <strong className="text-white">{paymentModalReq.title}</strong>
              <br />
              Nominal:{' '}
              <strong className="text-orange-400 font-mono">
                {formatRupiah(paymentModalReq.amount)}
              </strong>
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nomor Referensi / Catatan Transfer Bank:
              </label>
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPaymentModalReq(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handlePaymentConfirm}
                disabled={isPending}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Konfirmasi Lunas (PAID)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Export Modal (Render di paling atas agar tidak tertumpuk modal detail) */}
      {pdfData && (
        <ReimbursementVoucherPdf
          data={pdfData}
          onClose={() => setPdfData(null)}
        />
      )}

      {/* Overtime Form Lembur PDF Modal */}
      {overtimePdfData && (
        <OvertimeVoucherPdf
          data={overtimePdfData}
          onClose={() => setOvertimePdfData(null)}
        />
      )}

      {/* Monthly Disbursement Recap Report PDF Modal */}
      {monthlyRecapData && (
        <MonthlyRecapReportPdf
          data={monthlyRecapData}
          onClose={() => setMonthlyRecapData(null)}
        />
      )}

      {/* Preview Modal Format MS Word (.docx) & Cetak (Hanya mencetak pengajuan yang dipilih, tidak mencampur pengajuan lain) */}
      {wordPreviewReq && wordApprovers && (
        <WordVoucherPreviewModal
          request={wordPreviewReq}
          sameDateRequests={[wordPreviewReq]}
          financeApprover={wordApprovers.finSig}
          directorApprover={wordApprovers.dirSig}
          onClose={() => {
            setWordPreviewReq(null);
            setWordApprovers(null);
          }}
        />
      )}

      {/* Modal: Fullscreen / Lightbox Bukti Nota */}
      {viewingReceipt && (
        <div
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[60] flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setViewingReceipt(null)}
        >
          <div
            className="relative max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl p-3 shadow-2xl flex flex-col items-center w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center pb-2 px-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white">Foto Bukti Nota</span>
              <div className="flex items-center gap-2">
                <a
                  href={viewingReceipt}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Buka di tab baru</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={() => setViewingReceipt(null)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-2 overflow-auto max-h-[75vh] flex items-center justify-center w-full">
              <img
                src={viewingReceipt}
                alt="Bukti Nota Penuh"
                className="max-w-full max-h-[70vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
