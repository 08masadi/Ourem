import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/actions/auth';
import { ReimbursementType, ReimbursementCategory } from '@/types/database';
import { sendPushToRole } from '@/lib/pushNotifier';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Sesi login telah berakhir. Silakan login kembali.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    const title = (formData.get('title') as string) || '';
    const reimbursement_type =
      (formData.get('reimbursement_type') as ReimbursementType) || 'Petty Cash';
    const customer = (formData.get('customer') as string) || '';
    const account =
      (formData.get('account') as string) ||
      (formData.get('category') as string) ||
      'Bensin';
    const rawApiDept = (formData.get('department') as string) || '';
    const department = rawApiDept === 'Staff OPS' || !rawApiDept ? 'Staff Operasional' : rawApiDept;
    let signature_url = (formData.get('signature_url') as string) || '';

    let userProfile = null;
    try {
      userProfile = await getCurrentUserProfile();
    } catch {}

    if (!signature_url) {
      signature_url = userProfile?.signature_url || '';
    }
    const amountStr = (formData.get('amount') as string) || '0';
    const request_date =
      (formData.get('request_date') as string) ||
      new Date().toISOString().split('T')[0];
    const description = (formData.get('description') as string) || '';
    let receipt_url = (formData.get('receipt_url') as string) || '';

    let category: ReimbursementCategory = 'Operasional Lainnya';
    if (['Bensin', 'Parkir', 'Tol', 'Transport', 'Transport Lainnya'].includes(account)) {
      category = 'Transport';
    } else if (
      ['Makan', 'Kopi', 'Rokok', 'Konsumsi', 'Makan & Konsumsi', 'Konsumsi Lainnya'].includes(
        account
      )
    ) {
      category = 'Makan & Konsumsi';
    } else if (
      [
        'Material',
        'Alat Tulis Kantor',
        'Alat Tulis Kantor (ATK)',
        'Sparepart & Perlengkapan',
      ].includes(account)
    ) {
      category = 'Alat Tulis Kantor';
    } else if (account === 'Hotel & Penginapan') {
      category = 'Hotel & Penginapan';
    } else if (account === 'Medis & Kesehatan') {
      category = 'Medis & Kesehatan';
    } else {
      category = 'Operasional Lainnya';
    }

    if (!title || !amountStr) {
      return NextResponse.json(
        { error: 'Judul dan nominal wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanedAmount = amountStr.replace(/[^0-9]/g, '');
    const amount = Number(cleanedAmount);

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Nominal harus berupa angka valid lebih dari 0.' },
        { status: 400 }
      );
    }

    // Upload receipt file if present
    const blockCount = Number(formData.get('block_count') || 1);
    const uploadedBlockUrls: Record<number, string> = {};

    // 1. First collect any already uploaded receipt URLs from client
    for (let i = 0; i < blockCount; i++) {
      const existingUrl = (formData.get(`receipt_url_${i}`) as string) || '';
      if (existingUrl) {
        uploadedBlockUrls[i] = existingUrl;
        if (!receipt_url) receipt_url = existingUrl;
      }
    }

    // 2. Upload any files that were sent directly to the server
    for (let i = 0; i < blockCount; i++) {
      if (uploadedBlockUrls[i]) continue;

      const file = formData.get(`receipt_file_${i}`) as File | null;
      const isFile =
        file &&
        typeof file === 'object' &&
        'size' in file &&
        typeof (file as any).size === 'number' &&
        (file as any).size > 0;

      if (isFile) {
        try {
          // Security Fix (VULN-08): Whitelist ekstensi & batasi ukuran maksimal 10MB
          if ((file as any).size > 10 * 1024 * 1024) {
            console.warn(`File block ${i} ditolak: Ukuran melebihi batas 10MB`);
            continue;
          }

          const rawName = ((file as any).name || 'nota.jpg').toLowerCase();
          let fileExt = rawName.includes('.') ? rawName.split('.').pop() || 'jpg' : 'jpg';
          const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
          if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
            fileExt = 'jpg';
          }

          const fileName = `${user.id}-${Date.now()}-${i}.${fileExt}`;
          const filePath = `receipts/${fileName}`;
          const buffer = Buffer.from(await file.arrayBuffer());

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(filePath, buffer, {
              contentType: (file as any).type?.includes('svg') ? 'image/jpeg' : (file as any).type || 'image/jpeg',
              cacheControl: '3600',
              upsert: false,
            });

          if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('receipts')
              .getPublicUrl(filePath);
            const pubUrl = publicUrlData.publicUrl;
            uploadedBlockUrls[i] = pubUrl;
            if (!receipt_url) receipt_url = pubUrl;
          } else {
            console.error('Storage upload error for block', i, uploadError);
          }
        } catch (uploadErr) {
          console.error('File block upload error in API route:', uploadErr);
        }
      }
    }

    const singleReceipt = formData.get('receipt_file') as File | null;
    if (!receipt_url && singleReceipt) {
      const isFile =
        typeof singleReceipt === 'object' &&
        'size' in singleReceipt &&
        typeof (singleReceipt as any).size === 'number' &&
        (singleReceipt as any).size > 0;

      if (isFile) {
        try {
          // Security Fix (VULN-08): Whitelist ekstensi & batasi ukuran maksimal 10MB
          if ((singleReceipt as any).size > 10 * 1024 * 1024) {
            console.warn('Single receipt file ditolak: Ukuran melebihi batas 10MB');
          } else {
            const rawName = ((singleReceipt as any).name || 'nota.jpg').toLowerCase();
            let fileExt = rawName.includes('.') ? rawName.split('.').pop() || 'jpg' : 'jpg';
            const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
            if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
              fileExt = 'jpg';
            }

            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `receipts/${fileName}`;
            const buffer = Buffer.from(await singleReceipt.arrayBuffer());

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('receipts')
              .upload(filePath, buffer, {
                contentType: (singleReceipt as any).type?.includes('svg') ? 'image/jpeg' : (singleReceipt as any).type || 'image/jpeg',
                cacheControl: '3600',
                upsert: false,
              });

            if (!uploadError && uploadData) {
              const { data: publicUrlData } = supabase.storage
                .from('receipts')
                .getPublicUrl(filePath);
              receipt_url = publicUrlData.publicUrl;
              if (!uploadedBlockUrls[0]) uploadedBlockUrls[0] = receipt_url;
            }
          }
        } catch (uploadErr) {
          console.error('Single receipt upload error in API route:', uploadErr);
        }
      }
    }

    // Embed uploaded receipt URLs back into description JSON blocks if missing
    let finalDescription = description;
    if (Object.keys(uploadedBlockUrls).length > 0 && finalDescription.includes('__ITEMS_JSON__:')) {
      try {
        finalDescription = finalDescription.replace(
          /__ITEMS_JSON__:([\s\S]*?)__END_ITEMS_JSON__/,
          (match, jsonStr) => {
            const parsed = JSON.parse(jsonStr);
            if (parsed && Array.isArray(parsed.blocks)) {
              parsed.blocks.forEach((b: any, idx: number) => {
                if (uploadedBlockUrls[idx] && !b.receipt_url) {
                  b.receipt_url = uploadedBlockUrls[idx];
                }
              });
              return `__ITEMS_JSON__:${JSON.stringify(parsed)}__END_ITEMS_JSON__`;
            }
            return match;
          }
        );
      } catch (err) {
        console.error('Error updating description with uploaded receipt URLs:', err);
      }
    }

    const insertPayload: any = {
      user_id: user.id,
      title,
      category,
      amount,
      request_date,
      description: finalDescription,
      receipt_url: receipt_url || null,
      status: 'Menunggu Approval',
      payment_status: 'Unpaid',
      reimbursement_type,
      customer: customer || null,
      account: account || null,
      department: department || 'Staff Operasional',
      signature_url: signature_url || null,
    };

    let { error: insertError } = await supabase
      .from('reimbursement_requests')
      .insert(insertPayload);

    if (
      insertError &&
      (insertError.message?.toLowerCase().includes('column') ||
        insertError.code === '42703' ||
        insertError.code === 'PGRST204')
    ) {
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
      console.error('Insert error in /api/requests/create:', insertError);
      return NextResponse.json(
        { error: `Gagal menyimpan pengajuan: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Kirim push notification
    try {
      const creatorName = userProfile?.full_name || 'Karyawan';
      const notifBody = `${creatorName} mengajukan ${reimbursement_type} (${account}) sebesar Rp ${amount.toLocaleString('id-ID')}.`;
      await Promise.allSettled([
        sendPushToRole('director', {
          title: 'Pengajuan Reimbursement Baru',
          body: notifBody,
          url: '/director',
        }),
        sendPushToRole('finance', {
          title: 'Pengajuan Reimbursement Baru',
          body: notifBody,
          url: '/finance',
        }),
      ]);
    } catch {}

    try {
      revalidatePath('/employee');
      revalidatePath('/director');
      revalidatePath('/finance');
    } catch {}

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Fatal error in /api/requests/create:', err);
    return NextResponse.json(
      { error: err?.message || 'Terjadi kesalahan sistem di server.' },
      { status: 500 }
    );
  }
}
