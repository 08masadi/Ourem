export type UserRole = 'employee' | 'director' | 'finance';

export type ReimbursementType = 'Petty Cash' | 'Voucher' | 'Lembur';

export type RequestStatus = 'Menunggu Approval' | 'Disetujui' | 'Ditolak';

export type PaymentStatus = 'Unpaid' | 'Paid';

export type ReimbursementCategory =
  | 'Transport'
  | 'Bensin'
  | 'Parkir'
  | 'Tol'
  | 'Makan & Konsumsi'
  | 'Alat Tulis Kantor'
  | 'Hotel & Penginapan'
  | 'Medis & Kesehatan'
  | 'Operasional Lainnya';

export const DEPARTMENT_OPTIONS = [
  'Staff OPS',
  'Staff Administration',
  'Staff Purchasing',
  'Sales Marketing',
  'Finance',
  'Director',
  'Manager',
] as const;

export type DepartmentType = (typeof DEPARTMENT_OPTIONS)[number] | string;

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string | null;
  phone?: string | null;
  employee_id?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;
  avatar_url?: string | null;
  signature_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReimbursementRequest {
  id: string;
  user_id: string;
  title: string;
  category: ReimbursementCategory;
  reimbursement_type?: ReimbursementType;
  account?: string | null;
  customer?: string | null;
  department?: string | null;
  signature_url?: string | null;
  amount: number;
  request_date: string;
  description?: string | null;
  receipt_url?: string | null;
  status: RequestStatus;
  rejection_reason?: string | null;
  director_id?: string | null;
  director_action_at?: string | null;
  payment_status: PaymentStatus;
  payment_note?: string | null;
  finance_id?: string | null;
  payment_action_at?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: UserProfile;
}

export interface ReimbursementVoucherPrintData {
  type: ReimbursementType;
  requestedBy: string;
  department: string;
  date: string;
  items: {
    account: string;
    customer: string;
    description: string;
    amount: number;
  }[];
  totalAmount: number;
  employeeSignature?: string | null;
  financeSignature?: string | null;
  financeOfficer?: string | null;
  isPaid?: boolean;
  paidDate?: string | null;
}

export interface OvertimeData {
  tanggal_lembur: string;
  tipe_hari: 'hari kerja' | 'hari libur';
  lokasi_lembur: string;
  nama_karyawan: string;
  perusahaan: string;
  nama_pekerjaan: string;
  jam_lembur: string;
  uraian_pekerjaan: string;
  nominal?: number;
}

export interface OvertimeVoucherPrintData {
  tanggalLembur: string;
  tipeHari: 'hari kerja' | 'hari libur';
  lokasiLembur: string;
  namaKaryawan: string;
  perusahaan: string;
  namaPekerjaan: string;
  jamLembur: string;
  uraianPekerjaan: string;
  nominal?: number;
  employeeSignature?: string | null;
  directorSignature?: string | null;
  directorName?: string | null;
  financeSignature?: string | null;
  financeName?: string | null;
  isPaid?: boolean;
  paidDate?: string | null;
}

export interface MonthlyRecapItem {
  no: number;
  id: string;
  employeeName: string;
  department: string;
  date: string;
  description: string;
  amount: number;
}

export interface MonthlyRecapReportData {
  title: string;
  type: ReimbursementType;
  periodMonth: string;
  periodYear: string;
  periodLabel: string;
  printedAt: string;
  items: MonthlyRecapItem[];
  totalAmount: number;
  financeSignature?: string | null;
  financeName?: string | null;
  directorSignature?: string | null;
  directorName?: string | null;
}
