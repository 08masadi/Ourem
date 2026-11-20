import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/actions/auth';
import { OvertimeData, ReimbursementCategory } from '@/types/database';
import { formatOvertimeToDescription } from '@/lib/formatters';
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

    const tanggal_lembur =
      (formData.get('tanggal_lembur') as string) || new Date().toISOString().split('T')[0];
    const tipe_hari =
      ((formData.get('tipe_hari') as string) === 'hari libur' ? 'hari libur' : 'hari kerja') as
        | 'hari kerja'
        | 'hari libur';
    const lokasi_lembur = (formData.get('lokasi_lembur') as string) || '';
    const nama_karyawan = (formData.get('nama_karyawan') as string) || '';
    const perusahaan = (formData.get('perusahaan') as string) || '';
    const nama_pekerjaan = (formData.get('nama_pekerjaan') as string) || '';
    const jam_lembur = (formData.get('jam_lembur') as string) || '';
    const uraian_pekerjaan = (formData.get('uraian_pekerjaan') as string) || '';
    const nominalStr = (formData.get('nominal') as string) || '0';
    const department = (formData.get('department') as string) || 'Staff OPS';

    if (!nama_pekerjaan || !jam_lembur || !uraian_pekerjaan) {
      return NextResponse.json(
        { error: 'Nama pekerjaan, jam lembur, dan uraian pekerjaan wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanedNominal = nominalStr.replace(/[^0-9]/g, '');
    const rawNominal = Number(cleanedNominal) || 0;
    const dbAmount = rawNominal > 0 ? rawNominal : 1;

    let userProfile = null;
    try {
      userProfile = await getCurrentUserProfile();
    } catch {}

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
      console.error('Insert error in /api/requests/overtime:', insertError);
      return NextResponse.json(
        { error: `Gagal membuat pengajuan lembur: ${insertError.message}` },
        { status: 500 }
      );
    }

    try {
      const creatorName = userProfile?.full_name || 'Karyawan';
      await sendPushToRole('director', {
        title: 'Form Lembur Baru Masuk',
        body: `${creatorName} mengajukan Form Lembur untuk tanggal ${tanggal_lembur}.`,
        url: '/director',
      });
    } catch {}

    try {
      revalidatePath('/employee');
      revalidatePath('/director');
      revalidatePath('/finance');
    } catch {}

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Fatal error in /api/requests/overtime:', err);
    return NextResponse.json(
      { error: err?.message || 'Terjadi kesalahan sistem di server.' },
      { status: 500 }
    );
  }
}
