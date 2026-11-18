'use server';

import { createClient } from '@/lib/supabase/server';
import {
  ReimbursementCategory,
  ReimbursementRequest,
  RequestStatus,
  PaymentStatus,
  ReimbursementType,
  UserRole,
  OvertimeData,
} from '@/types/database';
import { getCurrentUserProfile } from './auth';
import {
  normalizeAccount,
  extractMetadataFromDescription,
  formatOvertimeToDescription,
  extractOvertimeFromDescription,
} from '@/lib/formatters';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createReimbursement(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk membuat pengajuan.' };
  }

  const title = formData.get('title') as string;
  const reimbursement_type = (formData.get('reimbursement_type') as ReimbursementType) || 'Petty Cash';
  const customer = (formData.get('customer') as string) || '';
  const account = (formData.get('account') as string) || (formData.get('category') as string) || 'Bensin';
  const department = (formData.get('department') as string) || 'Staff OPS';
  let signature_url = (formData.get('signature_url') as string) || '';

  // If no signature_url provided in form, use user's profile signature
  if (!signature_url) {
    const userProfile = await getCurrentUserProfile();
    signature_url = userProfile?.signature_url || '';
  }
  const amountStr = formData.get('amount') as string;
  const request_date = (formData.get('request_date') as string) || new Date().toISOString().split('T')[0];
  const description = formData.get('description') as string;
  const receipt_file = formData.get('receipt_file') as File | null;
  let receipt_url = (formData.get('receipt_url') as string) || '';

  // Map sub-accounts (Bensin, Parkir, Tol, Makan, Kopi, Rokok, Material) to valid CHECK constraint values in database:
  let category: ReimbursementCategory = 'Operasional Lainnya';
  if (['Bensin', 'Parkir', 'Tol', 'Transport', 'Transport Lainnya'].includes(account)) {
    category = 'Transport';
  } else if (['Makan', 'Kopi', 'Rokok', 'Konsumsi', 'Makan & Konsumsi', 'Konsumsi Lainnya'].includes(account)) {
    category = 'Makan & Konsumsi';
  } else if (['Material', 'Alat Tulis Kantor', 'Alat Tulis Kantor (ATK)', 'Sparepart & Perlengkapan'].includes(account)) {
    category = 'Alat Tulis Kantor';
  } else if (account === 'Hotel & Penginapan') {
    category = 'Hotel & Penginapan';
  } else if (account === 'Medis & Kesehatan') {
    category = 'Medis & Kesehatan';
  } else {
    category = 'Operasional Lainnya';
  }

  if (!title || !amountStr) {
    return { error: 'Judul/keterangan dan nominal wajib diisi.' };
  }

  // Parse numeric amount
  const cleanedAmount = amountStr.replace(/[^0-9]/g, '');
  const amount = Number(cleanedAmount);

  if (isNaN(amount) || amount <= 0) {
    return { error: 'Nominal harus berupa angka valid lebih dari 0.' };
  }

  // Handle receipt file upload if present (single or multiple block files)
  const blockCount = Number(formData.get('block_count') || 1);
  for (let i = 0; i < blockCount; i++) {
    const file = formData.get(`receipt_file_${i}`) as File | null;
    if (file && file.size > 0 && file.name) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}-${i}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath);
          if (!receipt_url) receipt_url = publicUrlData.publicUrl;
        }
      } catch {
        // ignore
      }
    }
  }

  if (!receipt_url && receipt_file && receipt_file.size > 0 && receipt_file.name) {
    try {
      const fileExt = receipt_file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, receipt_file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);
        receipt_url = publicUrlData.publicUrl;
      }
    } catch {
      // If storage bucket isn't setup yet, ignore
    }
  }

  const insertPayload: any = {
    user_id: user.id,
    title,
    category,
    amount,
    request_date,
    description,
    receipt_url: receipt_url || null,
    status: 'Menunggu Approval',
    payment_status: 'Unpaid',
    reimbursement_type,
    customer: customer || null,
    account: account || null,
    department: department || 'Staff OPS',
    signature_url: signature_url || null,
  };

  // Attempt insert with fallback if columns not yet migrated
  let { error: insertError } = await supabase
    .from('reimbursement_requests')
    .insert(insertPayload);

  if (insertError && insertError.message.includes('column')) {
    // Retry without newly added columns in case migration hasn't run yet
    delete insertPayload.reimbursement_type;
    delete insertPayload.customer;
    delete insertPayload.account;
    delete insertPayload.department;
    delete insertPayload.signature_url;

    const retry = await supabase
      .from('reimbursement_requests')
      .insert(insertPayload);
    insertError = retry.error;
  }

  if (insertError) {
    return { error: `Gagal menyimpan pengajuan: ${insertError.message}` };
  }

  revalidatePath('/employee');
  revalidatePath('/director');
  revalidatePath('/finance');
  redirect('/employee');
}

export async function createOvertimeRequest(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk membuat pengajuan lembur.' };
  }

  const tanggal_lembur =
    (formData.get('tanggal_lembur') as string) || new Date().toISOString().split('T')[0];
  const tipe_hari =
    ((formData.get('tipe_hari') as string) === 'hari libur' ? 'hari libur' : 'hari kerja') as
      | 'hari kerja'
      | 'hari libur';
  const lokasi_lembur = (formData.get('lokasi_lembur') as string) || 'Kantor';
  const nama_karyawan = (formData.get('nama_karyawan') as string) || '';
  const perusahaan = (formData.get('perusahaan') as string) || 'PT. CITRA SARI KENCANA';
  const nama_pekerjaan = (formData.get('nama_pekerjaan') as string) || '';
  const jam_lembur = (formData.get('jam_lembur') as string) || '';
  const uraian_pekerjaan = (formData.get('uraian_pekerjaan') as string) || '';
  const nominalStr = (formData.get('nominal') as string) || '0';
  const department = (formData.get('department') as string) || 'Staff OPS';

  if (!nama_pekerjaan || !jam_lembur || !uraian_pekerjaan) {
    return { error: 'Nama pekerjaan, jam lembur, dan uraian pekerjaan wajib diisi.' };
  }

  const cleanedNominal = nominalStr.replace(/[^0-9]/g, '');
  const rawNominal = Number(cleanedNominal) || 0;
  // Supabase constraint: amount NUMERIC NOT NULL CHECK (amount > 0).
  // If nominal is 0 or empty, use 1 as a placeholder so the DB check constraint passes.
  const dbAmount = rawNominal > 0 ? rawNominal : 1;

  // Profile signature
  const userProfile = await getCurrentUserProfile();
  const signature_url = userProfile?.signature_url || '';
  const finalNamaKaryawan = nama_karyawan || userProfile?.full_name || 'Karyawan';

  const overtimeData: OvertimeData = {
    tanggal_lembur,
    tipe_hari,
    lokasi_lembur,
    nama_karyawan: finalNamaKaryawan,
    perusahaan,
    nama_pekerjaan,
    jam_lembur,
    uraian_pekerjaan,
    nominal: rawNominal,
  };

  const description = formatOvertimeToDescription(overtimeData, {
    department,
    signature_url,
  });

  const title = `Form Lembur - ${nama_pekerjaan}`;
  const category: ReimbursementCategory = 'Operasional Lainnya';

  const insertPayload: any = {
    user_id: user.id,
    title,
    category,
    amount: dbAmount,
    request_date: tanggal_lembur,
    description,
    status: 'Menunggu Approval',
    payment_status: 'Unpaid',
    reimbursement_type: 'Lembur',
    customer: perusahaan,
    account: 'Lembur',
    department,
    signature_url: signature_url || null,
  };

  let { error: insertError } = await supabase
    .from('reimbursement_requests')
    .insert(insertPayload);

  // If check constraint on reimbursement_type ('Petty Cash', 'Voucher') triggers
  if (
    insertError &&
    (insertError.message.includes('reimbursement_type') ||
      insertError.message.includes('check constraint'))
  ) {
    insertPayload.reimbursement_type = 'Petty Cash';
    const retryType = await supabase
      .from('reimbursement_requests')
      .insert(insertPayload);
    insertError = retryType.error;
  }

  if (insertError && insertError.message.includes('column')) {
    delete insertPayload.reimbursement_type;
    delete insertPayload.customer;
    delete insertPayload.account;
    delete insertPayload.department;
    delete insertPayload.signature_url;

    const retry = await supabase
      .from('reimbursement_requests')
      .insert(insertPayload);
    insertError = retry.error;
  }

  if (insertError) {
    console.error('Error insert overtime request:', insertError);
    return { error: `Gagal membuat pengajuan lembur: ${insertError.message}` };
  }

  revalidatePath('/employee');
  revalidatePath('/director');
  revalidatePath('/finance');
  redirect('/employee');
}

export async function updateReimbursement(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk mengubah pengajuan.' };
  }

  const id = formData.get('id') as string;
  const title = formData.get('title') as string;
  const reimbursement_type = (formData.get('reimbursement_type') as ReimbursementType) || 'Petty Cash';
  const customer = (formData.get('customer') as string) || '';
  const account = (formData.get('account') as string) || (formData.get('category') as string) || 'Bensin';
  const department = (formData.get('department') as string) || 'Staff OPS';
  let signature_url = (formData.get('signature_url') as string) || '';

  // If no signature_url provided in form, use user's profile signature
  if (!signature_url) {
    const userProfile = await getCurrentUserProfile();
    signature_url = userProfile?.signature_url || '';
  }
  const amountStr = formData.get('amount') as string;
  const request_date = (formData.get('request_date') as string) || new Date().toISOString().split('T')[0];
  const description = formData.get('description') as string;
  const receipt_file = formData.get('receipt_file') as File | null;
  let receipt_url = (formData.get('receipt_url') as string) || '';

  if (!id || !title || !amountStr) {
    return { error: 'ID, judul, dan nominal wajib diisi.' };
  }

  const cleanedAmount = amountStr.replace(/[^0-9]/g, '');
  const amount = Number(cleanedAmount);

  if (isNaN(amount) || amount <= 0) {
    return { error: 'Nominal harus berupa angka valid lebih dari 0.' };
  }

  // Handle receipt upload if files were provided (single or multi-block)
  const blockCount = Number(formData.get('block_count') || 1);
  for (let i = 0; i < blockCount; i++) {
    const file = formData.get(`receipt_file_${i}`) as File | null;
    if (file && file.size > 0 && file.name) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}-${i}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath);
          if (!receipt_url) receipt_url = publicUrlData.publicUrl;
        }
      } catch {
        // ignore
      }
    }
  }

  if (!receipt_url && receipt_file && receipt_file.size > 0 && receipt_file.name) {
    try {
      const fileExt = receipt_file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, receipt_file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);
        receipt_url = publicUrlData.publicUrl;
      }
    } catch {
      // Ignore
    }
  }

  // Map sub-accounts (Bensin, Parkir, Tol, Makan, Kopi, Rokok, Material) to valid CHECK constraint values in database:
  let category: ReimbursementCategory = 'Operasional Lainnya';
  if (['Bensin', 'Parkir', 'Tol', 'Transport', 'Transport Lainnya'].includes(account)) {
    category = 'Transport';
  } else if (['Makan', 'Kopi', 'Rokok', 'Konsumsi', 'Makan & Konsumsi', 'Konsumsi Lainnya'].includes(account)) {
    category = 'Makan & Konsumsi';
  } else if (['Material', 'Alat Tulis Kantor', 'Alat Tulis Kantor (ATK)', 'Sparepart & Perlengkapan'].includes(account)) {
    category = 'Alat Tulis Kantor';
  } else if (account === 'Hotel & Penginapan') {
    category = 'Hotel & Penginapan';
  } else if (account === 'Medis & Kesehatan') {
    category = 'Medis & Kesehatan';
  } else {
    category = 'Operasional Lainnya';
  }

  const updatePayload: any = {
    title,
    category,
    amount,
    request_date,
    description,
    reimbursement_type,
    customer: customer || null,
    account: account || null,
    department: department || 'Staff OPS',
    updated_at: new Date().toISOString(),
  };

  if (receipt_url) {
    updatePayload.receipt_url = receipt_url;
  }
  if (signature_url) {
    updatePayload.signature_url = signature_url;
  }

  let { error: updateError } = await supabase
    .from('reimbursement_requests')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateError && updateError.message.includes('column')) {
    delete updatePayload.reimbursement_type;
    delete updatePayload.customer;
    delete updatePayload.account;
    delete updatePayload.department;
    delete updatePayload.signature_url;

    const retry = await supabase
      .from('reimbursement_requests')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id);
    updateError = retry.error;
  }

  if (updateError) {
    return { error: `Gagal memperbarui pengajuan: ${updateError.message}` };
  }

  revalidatePath('/employee');
  revalidatePath('/director');
  revalidatePath('/finance');
  return { success: true };
}

export async function updateOvertimeRequest(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk mengubah pengajuan lembur.' };
  }

  const id = formData.get('id') as string;
  const tanggal_lembur =
    (formData.get('tanggal_lembur') as string) || new Date().toISOString().split('T')[0];
  const tipe_hari =
    ((formData.get('tipe_hari') as string) === 'hari libur' ? 'hari libur' : 'hari kerja') as
      | 'hari kerja'
      | 'hari libur';
  const lokasi_lembur = (formData.get('lokasi_lembur') as string) || 'Kantor';
  const nama_karyawan = (formData.get('nama_karyawan') as string) || '';
  const perusahaan = (formData.get('perusahaan') as string) || 'PT. CITRA SARI KENCANA';
  const nama_pekerjaan = (formData.get('nama_pekerjaan') as string) || '';
  const jam_lembur = (formData.get('jam_lembur') as string) || '';
  const uraian_pekerjaan = (formData.get('uraian_pekerjaan') as string) || '';
  const nominalStr = (formData.get('nominal') as string) || '0';
  const department = (formData.get('department') as string) || 'Staff OPS';

  if (!id || !nama_pekerjaan || !jam_lembur || !uraian_pekerjaan) {
    return { error: 'Nama pekerjaan, jam lembur, dan uraian pekerjaan wajib diisi.' };
  }

  const cleanedNominal = nominalStr.replace(/[^0-9]/g, '');
  const rawNominal = Number(cleanedNominal) || 0;
  const dbAmount = rawNominal > 0 ? rawNominal : 1;

  // Pertahankan signature karyawan pembuat jika sudah ada (misal saat diedit oleh Director)
  const { data: existingReq } = await supabase
    .from('reimbursement_requests')
    .select('signature_url, profiles:user_id(id, full_name, signature_url)')
    .eq('id', id)
    .single();

  const userProfile = await getCurrentUserProfile();
  const signature_url =
    existingReq?.signature_url ||
    (existingReq?.profiles as any)?.signature_url ||
    userProfile?.signature_url ||
    '';
  const finalNamaKaryawan =
    nama_karyawan ||
    (existingReq?.profiles as any)?.full_name ||
    userProfile?.full_name ||
    'Karyawan';

  const overtimeData: OvertimeData = {
    tanggal_lembur,
    tipe_hari,
    lokasi_lembur,
    nama_karyawan: finalNamaKaryawan,
    perusahaan,
    nama_pekerjaan,
    jam_lembur,
    uraian_pekerjaan,
    nominal: rawNominal,
  };

  const description = formatOvertimeToDescription(overtimeData, {
    department,
    signature_url,
  });

  const title = `Form Lembur - ${nama_pekerjaan}`;

  const updatePayload: any = {
    title,
    amount: dbAmount,
    request_date: tanggal_lembur,
    description,
    customer: perusahaan,
    account: 'Lembur',
    department,
    updated_at: new Date().toISOString(),
  };

  let { error: updateError } = await supabase
    .from('reimbursement_requests')
    .update(updatePayload)
    .eq('id', id);

  if (updateError && updateError.message.includes('column')) {
    delete updatePayload.customer;
    delete updatePayload.account;
    delete updatePayload.department;

    const retry = await supabase
      .from('reimbursement_requests')
      .update(updatePayload)
      .eq('id', id);
    updateError = retry.error;
  }

  if (updateError) {
    return { error: `Gagal memperbarui pengajuan lembur: ${updateError.message}` };
  }

  const { data: updatedRequest } = await supabase
    .from('reimbursement_requests')
    .select('*, profiles:user_id(id, full_name, email, role, department, bank_name, bank_account_number, bank_account_holder, avatar_url, signature_url)')
    .eq('id', id)
    .single();

  revalidatePath('/employee');
  revalidatePath('/director');
  revalidatePath('/finance');
  return { success: true, data: updatedRequest };
}

export async function getEmployeeRequests(): Promise<ReimbursementRequest[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  let rawList: any[] = [];

  try {
    const { data, error } = await supabase
      .from('reimbursement_requests')
      .select(`
        *,
        profiles:user_id (
          id,
          email,
          full_name,
          role,
          department,
          bank_name,
          bank_account_number,
          bank_account_holder
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      rawList = data;
    }
  } catch {
    // If join fails, continue to fallback
  }

  // Fallback query if joined select didn't produce results
  if (rawList.length === 0) {
    try {
      const { data: fallbackData } = await supabase
        .from('reimbursement_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (Array.isArray(fallbackData)) {
        rawList = fallbackData;
      }
    } catch {
      // Fallback query error
    }
  }

  // Get current user profile & signature
  const userProfile = await getCurrentUserProfile();

  const activeList = rawList.filter(
    (item) => !item.description?.includes('__DELETED__:true') && item.title !== '[DELETED]'
  );

  return activeList.map((item) => {
    const meta = extractMetadataFromDescription(item.description);
    const determinedType = item.reimbursement_type || meta.reimbursement_type || 'Petty Cash';
    const determinedAccount = normalizeAccount(
      item.account || meta.account || item.category,
      determinedType
    );
    const determinedDepartment =
      item.department || meta.department || item.profiles?.department || userProfile?.department || 'Staff OPS';
    const determinedSignature =
      item.signature_url || meta.signature_url || userProfile?.signature_url || null;

    return {
      ...item,
      reimbursement_type: determinedType,
      account: determinedAccount,
      customer: item.customer || meta.customer || null,
      department: determinedDepartment,
      signature_url: determinedSignature,
      profiles: item.profiles || (userProfile ? {
        id: userProfile.id,
        email: userProfile.email,
        full_name: userProfile.full_name,
        role: userProfile.role,
        department: userProfile.department,
        bank_name: userProfile.bank_name || null,
        bank_account_number: userProfile.bank_account_number || null,
        bank_account_holder: userProfile.bank_account_holder || null,
      } : undefined),
    } as ReimbursementRequest;
  });
}

export async function getAllRequests(): Promise<ReimbursementRequest[]> {
  const supabase = await createClient();
  let rawList: any[] = [];

  try {
    const { data, error } = await supabase
      .from('reimbursement_requests')
      .select(`
        *,
        profiles:user_id (
          id,
          email,
          full_name,
          role,
          department,
          bank_name,
          bank_account_number,
          bank_account_holder
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      rawList = data;
    }
  } catch {
    // If join fails, continue to fallback
  }

  if (rawList.length === 0) {
    try {
      const { data: fallbackData } = await supabase
        .from('reimbursement_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (Array.isArray(fallbackData)) {
        rawList = fallbackData;
      }
    } catch {
      // Fallback query error
    }
  }

  const activeList = rawList.filter(
    (item) => !item.description?.includes('__DELETED__:true') && item.title !== '[DELETED]'
  );

  return activeList.map((item) => {
    const meta = extractMetadataFromDescription(item.description);
    const determinedType = item.reimbursement_type || meta.reimbursement_type || 'Petty Cash';
    const determinedAccount = normalizeAccount(
      item.account || meta.account || item.category,
      determinedType
    );
    const determinedDepartment =
      item.department || meta.department || item.profiles?.department || 'Staff OPS';
    const determinedSignature =
      item.signature_url || meta.signature_url || null;

    return {
      ...item,
      reimbursement_type: determinedType,
      account: determinedAccount,
      customer: item.customer || meta.customer || null,
      department: determinedDepartment,
      signature_url: determinedSignature,
    } as ReimbursementRequest;
  });
}

export async function updateDirectorStatus(
  requestId: string,
  status: RequestStatus,
  rejectionReason?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  const updatePayload: any = {
    status,
    director_id: user.id,
    director_action_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (status === 'Ditolak') {
    updatePayload.rejection_reason = rejectionReason || 'Tidak memenuhi kualifikasi';
  } else {
    updatePayload.rejection_reason = null;
  }

  const { error } = await supabase
    .from('reimbursement_requests')
    .update(updatePayload)
    .eq('id', requestId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/director');
  revalidatePath('/employee');
  revalidatePath('/finance');
  return { success: true };
}

export async function updateFinancePayment(
  requestId: string,
  paymentStatus: PaymentStatus,
  paymentNote?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('reimbursement_requests')
    .update({
      payment_status: paymentStatus,
      payment_note: paymentNote || null,
      finance_id: user.id,
      payment_action_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/finance');
  revalidatePath('/director');
  revalidatePath('/employee');
  return { success: true };
}

export async function deleteReimbursementRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  let isDeleted = false;

  // 1. Coba Hard Delete permanen ke Supabase
  try {
    const { data: deletedRows, error: deleteError } = await supabase
      .from('reimbursement_requests')
      .delete()
      .eq('id', requestId)
      .select('id');

    if (!deleteError && Array.isArray(deletedRows) && deletedRows.length > 0) {
      isDeleted = true;
    }
  } catch {
    // Jika policy DELETE belum terpasang di database, lanjut ke fallback
  }

  // 2. Jika baris belum terhapus permanen (karena RLS Supabase), terapkan guaranteed soft-delete
  if (!isDeleted) {
    try {
      await supabase
        .from('reimbursement_requests')
        .update({
          description: '__DELETED__:true',
          title: '[DELETED]',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);
    } catch {
      // fallback
    }
  }

  revalidatePath('/employee');
  revalidatePath('/director');
  revalidatePath('/finance');
  return { success: true };
}

export async function deleteBatchReimbursementRequests(requestIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };
  if (!requestIds || requestIds.length === 0) return { success: true };

  let deletedIds = new Set<string>();

  // 1. Coba Hard Delete permanen ke Supabase
  try {
    const { data: deletedRows, error: deleteError } = await supabase
      .from('reimbursement_requests')
      .delete()
      .in('id', requestIds)
      .select('id');

    if (!deleteError && Array.isArray(deletedRows)) {
      deletedIds = new Set(deletedRows.map((r) => r.id));
    }
  } catch {
    // ignore
  }

  // 2. Untuk baris yang belum terhapus oleh RLS, terapkan guaranteed soft-delete
  const remainingIds = requestIds.filter((id) => !deletedIds.has(id));
  if (remainingIds.length > 0) {
    try {
      await supabase
        .from('reimbursement_requests')
        .update({
          description: '__DELETED__:true',
          title: '[DELETED]',
          updated_at: new Date().toISOString(),
        })
        .in('id', remainingIds);
    } catch {
      // ignore
    }
  }

  revalidatePath('/employee');
  revalidatePath('/director');
  revalidatePath('/finance');
  return { success: true };
}

export async function updateBatchDirectorStatus(
  requestIds: string[],
  status: RequestStatus = 'Disetujui',
  rejectionReason?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };
  if (!requestIds || requestIds.length === 0) return { success: true };

  const updatePayload: any = {
    status,
    director_id: user.id,
    director_action_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (status === 'Ditolak') {
    updatePayload.rejection_reason = rejectionReason || 'Tidak memenuhi kualifikasi';
  } else {
    updatePayload.rejection_reason = null;
  }

  const { error } = await supabase
    .from('reimbursement_requests')
    .update(updatePayload)
    .in('id', requestIds);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/director');
  revalidatePath('/employee');
  revalidatePath('/finance');
  return { success: true };
}

export async function updateBatchFinancePayment(
  requestIds: string[],
  paymentStatus: PaymentStatus = 'Paid',
  paymentNote?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };
  if (!requestIds || requestIds.length === 0) return { success: true };

  const updatePayload: any = {
    payment_status: paymentStatus,
    payment_note: paymentNote || 'Dicairkan oleh Finance',
    finance_id: user.id,
    payment_action_at: new Date().toISOString(),
    status: 'Disetujui', // Pastikan status disetujui saat dicairkan
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('reimbursement_requests')
    .update(updatePayload)
    .in('id', requestIds);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/director');
  revalidatePath('/employee');
  revalidatePath('/finance');
  return { success: true };
}

export async function getLatestRequests(role: UserRole): Promise<ReimbursementRequest[]> {
  if (role === 'employee') {
    return await getEmployeeRequests();
  }
  return await getAllRequests();
}

export interface AppNotification {
  id: string;
  requestId?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'payment';
  date: string;
  link: string;
  createdAt: string;
}

export async function getUserNotifications(targetRole?: string): Promise<AppNotification[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const userProfile = await getCurrentUserProfile();
  const effectiveRole = (
    targetRole ||
    userProfile?.role ||
    (user.user_metadata?.role as string) ||
    'employee'
  ).toLowerCase().trim();

  const isDirector = effectiveRole === 'director';
  const isFinance = effectiveRole === 'finance';
  const isEmployee = !isDirector && !isFinance;

  const notifications: AppNotification[] = [];

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getNominal = (r: ReimbursementRequest) => {
    const isOvertime =
      r.reimbursement_type === 'Lembur' ||
      r.account === 'Lembur' ||
      r.title?.startsWith('Form Lembur');
    if (isOvertime) {
      const ov = extractOvertimeFromDescription(r.description);
      if (ov && typeof ov.nominal === 'number') {
        return ov.nominal;
      }
      return Number(r.amount) <= 1 ? 0 : Number(r.amount) || 0;
    }
    return Number(r.amount) || 0;
  };

  const getCategoryInfo = (r: ReimbursementRequest) => {
    const isOvertime =
      r.reimbursement_type === 'Lembur' ||
      r.account === 'Lembur' ||
      r.title?.startsWith('Form Lembur');
    const typeLabel = isOvertime ? 'Form Lembur' : (r.reimbursement_type || 'Petty Cash');
    const accName = isOvertime ? 'Lembur Kerja' : (r.account || r.category || 'Operasional');
    const nominal = getNominal(r);
    const nominalStr =
      nominal > 0 ? formatRupiah(nominal) : isOvertime ? '(Nominal dihitung Direktur)' : 'Rp 0';
    return { isOvertime, typeLabel, accName, nominal, nominalStr };
  };

  try {
    if (isEmployee) {
      // 1. Akun Employee: pengajuan employee sudah disetujui, dicairkan, atau menunggu
      const myReqs = await getEmployeeRequests();

      for (const req of myReqs) {
        if (req.title === '[DELETED]') continue;
        const { typeLabel, accName, nominalStr } = getCategoryInfo(req);

        // Jika sudah dicairkan oleh Finance
        if (req.payment_status === 'Paid') {
          notifications.push({
            id: `paid-${req.id}`,
            requestId: req.id,
            title: `Klaim Berhasil Dicairkan (PAID)`,
            message: `Dana klaim ${typeLabel} (${accName}) sebesar ${nominalStr} telah berhasil ditransfer oleh Finance.`,
            type: 'payment',
            date: req.payment_action_at || req.updated_at || req.created_at,
            link: `/employee?requestId=${req.id}`,
            createdAt: req.payment_action_at || req.updated_at || req.created_at,
          });
        }

        // Jika sudah disetujui oleh Direksi / Finance
        if (req.status === 'Disetujui') {
          if (req.payment_status !== 'Paid') {
            notifications.push({
              id: `approved-${req.id}`,
              requestId: req.id,
              title: `Pengajuan Disetujui`,
              message: `Pengajuan ${typeLabel} (${accName}) sebesar ${nominalStr} telah disetujui dan siap dicairkan oleh Finance.`,
              type: 'success',
              date: req.director_action_at || req.updated_at || req.created_at,
              link: `/employee?requestId=${req.id}`,
              createdAt: req.director_action_at || req.updated_at || req.created_at,
            });
          }
        } else if (req.status === 'Ditolak') {
          notifications.push({
            id: `rejected-${req.id}`,
            requestId: req.id,
            title: `Pengajuan Ditolak`,
            message: `Pengajuan ${typeLabel} (${accName}) sebesar ${nominalStr} ditolak. Alasan: ${req.rejection_reason || 'Tidak memenuhi kualifikasi'}.`,
            type: 'warning',
            date: req.director_action_at || req.updated_at || req.created_at,
            link: `/employee?requestId=${req.id}`,
            createdAt: req.director_action_at || req.updated_at || req.created_at,
          });
        } else if (req.status === 'Menunggu Approval') {
          notifications.push({
            id: `pending-${req.id}`,
            requestId: req.id,
            title: `Pengajuan Telah Dikirim`,
            message: `Pengajuan ${typeLabel} (${accName}) sebesar ${nominalStr} berhasil dikirim dan menunggu persetujuan.`,
            type: 'info',
            date: req.created_at,
            link: `/employee?requestId=${req.id}`,
            createdAt: req.created_at,
          });
        }
      }

      if (!userProfile?.signature_url) {
        notifications.push({
          id: 'employee-no-sig',
          title: 'Upload Tanda Tangan Karyawan',
          message: 'Lengkapi foto tanda tangan (.PNG) Anda di halaman Profil agar otomatis tertera di formulir voucher.',
          type: 'info',
          date: new Date().toISOString(),
          link: '/profile',
          createdAt: new Date().toISOString(),
        });
      }
    } else if (isDirector) {
      // 2. Akun Director: Notifikasi HANYA Form Lembur yang membutuhkan persetujuan Direksi
      const allReqs = await getAllRequests();

      for (const req of allReqs) {
        if (req.title === '[DELETED]') continue;

        // Khusus akun Director, notifikasi yang masuk HANYA pengajuan form lembur saja
        const isOvertime =
          req.reimbursement_type === 'Lembur' ||
          req.account === 'Lembur' ||
          req.title?.startsWith('Form Lembur');

        if (!isOvertime) continue;

        const empName = req.profiles?.full_name || 'Karyawan';
        const { typeLabel, accName, nominalStr } = getCategoryInfo(req);

        // Pengajuan baru Form Lembur dari employee yang menunggu approval
        if (req.status === 'Menunggu Approval') {
          notifications.push({
            id: `dir-pending-${req.id}`,
            requestId: req.id,
            title: `Ada Pengajuan Form Lembur: ${empName}`,
            message: `Karyawan ${empName} mengajukan ${typeLabel} (${accName}) ${nominalStr}. Menunggu persetujuan Anda.`,
            type: 'warning',
            date: req.created_at,
            link: `/director?requestId=${req.id}`,
            createdAt: req.created_at,
          });
        } else if (req.status === 'Disetujui') {
          notifications.push({
            id: `dir-processed-${req.id}`,
            requestId: req.id,
            title: `Form Lembur Telah Disetujui: ${empName}`,
            message: `Klaim ${typeLabel} (${accName}) senilai ${nominalStr} telah Anda setujui.`,
            type: 'success',
            date: req.director_action_at || req.updated_at || req.created_at,
            link: `/director?requestId=${req.id}`,
            createdAt: req.director_action_at || req.updated_at || req.created_at,
          });
        }
      }
    } else if (isFinance) {
      // 3. Akun Finance: Semua notifikasi bisa masuk (Petty Cash, Voucher, dan Form Lembur)
      const allReqs = await getAllRequests();

      for (const req of allReqs) {
        if (req.title === '[DELETED]') continue;
        const empName = req.profiles?.full_name || 'Karyawan';
        const { typeLabel, accName, nominalStr } = getCategoryInfo(req);

        // a) Ada Pengajuan Baru dari Employee (Menunggu Approval)
        if (req.status === 'Menunggu Approval') {
          notifications.push({
            id: `fin-new-${req.id}`,
            requestId: req.id,
            title: `Ada Pengajuan Baru: ${empName}`,
            message: `Karyawan ${empName} mengajukan klaim ${typeLabel} (${accName}) sebesar ${nominalStr}.`,
            type: 'info',
            date: req.created_at,
            link: `/finance?requestId=${req.id}`,
            createdAt: req.created_at,
          });
        }

        // b) Pengajuan Telah Disetujui (Siap Dicairkan)
        if (req.status === 'Disetujui' && req.payment_status !== 'Paid') {
          const rekInfo = req.profiles?.bank_name
            ? ` (Rek: ${req.profiles.bank_name} - ${req.profiles.bank_account_number || ''})`
            : '';
          notifications.push({
            id: `fin-approved-${req.id}`,
            requestId: req.id,
            title: `Pengajuan Siap Dicairkan: ${empName}`,
            message: `Klaim ${typeLabel} (${accName}) senilai ${nominalStr} telah disetujui dan siap dicairkan/ditransfer${rekInfo}.`,
            type: 'success',
            date: req.director_action_at || req.updated_at || req.created_at,
            link: `/finance?requestId=${req.id}`,
            createdAt: req.director_action_at || req.updated_at || req.created_at,
          });
        }

        // c) Pencairan Telah Selesai (Paid)
        if (req.payment_status === 'Paid') {
          notifications.push({
            id: `fin-paid-${req.id}`,
            requestId: req.id,
            title: `Pencairan Selesai (PAID): ${empName}`,
            message: `Dana klaim ${typeLabel} (${accName}) sebesar ${nominalStr} telah berhasil ditransfer.`,
            type: 'payment',
            date: req.payment_action_at || req.updated_at || req.created_at,
            link: `/finance?requestId=${req.id}`,
            createdAt: req.payment_action_at || req.updated_at || req.created_at,
          });
        }
      }

      if (!userProfile?.signature_url) {
        notifications.push({
          id: 'finance-no-sig',
          title: 'Upload Tanda Tangan Finance',
          message: 'Upload foto tanda tangan (.PNG) Anda di menu Profil agar otomatis terpasang saat cetak PDF voucher.',
          type: 'info',
          date: new Date().toISOString(),
          link: '/profile',
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Urutkan notifikasi dari yang paling baru ke paling lama
    notifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.error('Error fetching notifications:', err);
  }

  // Jika belum ada notifikasi sama sekali, berikan status sistem
  if (notifications.length === 0) {
    notifications.push({
      id: 'system-ready',
      title: 'Tidak Ada Notifikasi Baru',
      message: 'Semua aktivitas dan pengajuan Anda telah up-to-date.',
      type: 'info',
      date: new Date().toISOString(),
      link: '/profile',
      createdAt: new Date().toISOString(),
    });
  }

  // Batasi maksimal 25 notifikasi terbaru
  return notifications.slice(0, 25);
}
