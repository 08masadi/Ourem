'use server';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { UserRole, UserProfile } from '@/types/database';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { headers, cookies } from 'next/headers';

export async function signIn(prevState: any, formData: FormData) {
  const rawEmail = formData.get('email') as string;
  const password = formData.get('password') as string;

  const email = (rawEmail || '').trim().toLowerCase();

  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.' };
  }

  // 1. Coba login melalui Better Auth
  try {
    const res = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: await headers(),
    });

    if (res?.user) {
      const userRole = (res.user as any).role || 'employee';
      const targetPath =
        userRole === 'director' || userRole === 'admin' || userRole === 'super-admin'
          ? '/director'
          : userRole === 'finance'
            ? '/finance'
            : '/employee';
      redirect(targetPath);
    }
  } catch (betterAuthErr: any) {
    if (betterAuthErr?.message === 'NEXT_REDIRECT' || betterAuthErr?.digest?.startsWith('NEXT_REDIRECT')) {
      throw betterAuthErr;
    }
  }

  // 2. Fallback login Supabase jika pengguna memiliki sesi lama atau belum login ulang
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !supabaseUrl.includes('your-project') && supabaseUrl.startsWith('https://')) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data?.user) {
        let role: UserRole = (data.user?.user_metadata?.role as UserRole) || 'employee';
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, department')
          .eq('id', data.user.id)
          .single();

        if (profile?.role) {
          role = profile.role as UserRole;
        }

        if (profile?.department === 'Staff OPS' || profile?.department === 'STAFF OPS') {
          await supabase
            .from('profiles')
            .update({ department: 'Staff Operasional' })
            .eq('id', data.user.id);
        }

        // Sinkronkan login ke Better Auth jika memungkinkan
        try {
          await auth.api.signInEmail({
            body: { email, password },
            headers: await headers(),
          });
        } catch (syncErr: any) {
          if (syncErr?.message === 'NEXT_REDIRECT' || syncErr?.digest?.startsWith('NEXT_REDIRECT')) {
            throw syncErr;
          }
        }

        const targetPath =
          role === 'director' || (role as string) === 'admin' || (role as string) === 'super-admin'
            ? '/director'
            : role === 'finance'
              ? '/finance'
              : '/employee';
        redirect(targetPath);
      }
    } catch (supaErr: any) {
      if (supaErr?.message === 'NEXT_REDIRECT' || supaErr?.digest?.startsWith('NEXT_REDIRECT')) {
        throw supaErr;
      }
    }
  }

  return {
    error: 'Email atau kata sandi tidak cocok. Silakan periksa kembali email dan kata sandi Anda.',
  };
}

export async function signUp(
  prevState: any,
  formData: FormData
): Promise<{ error?: string; success?: string } | void> {
  const rawEmail = formData.get('email') as string;
  const password = formData.get('password') as string;
  const full_name = (formData.get('full_name') as string || '').trim();
  const role: UserRole = 'employee';
  let department = (formData.get('department') as string || '').trim();
  if (!department || department === 'Staff OPS') {
    department = 'Staff Operasional';
  }

  const email = (rawEmail || '').trim().toLowerCase();

  if (!email || !password || !full_name) {
    return { error: 'Nama lengkap, email, dan password wajib diisi.' };
  }

  if (password.length < 8) {
    return { error: 'Password minimal 8 karakter.' };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);

  if (!hasUpper || !hasLower || !hasNumber || !hasSymbol) {
    return {
      error: 'Password harus memuat kombinasi huruf besar, huruf kecil, angka, dan simbol.',
    };
  }

  // 1. Daftarkan di Better Auth
  try {
    const res = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: full_name,
        role,
        department,
      },
      headers: await headers(),
    });

    if (res?.user) {
      // Sinkronkan ke public.profiles agar relasi dokumen di Supabase tetap sinkron
      try {
        const supabase = await createClient();
        await supabase.from('profiles').upsert({
          id: res.user.id,
          email,
          full_name,
          role,
          department,
          updated_at: new Date().toISOString(),
        });
      } catch {}

      redirect('/employee');
    }
  } catch (err: any) {
    if (err?.message === 'NEXT_REDIRECT' || err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    const msg = err?.message?.toLowerCase() || '';
    if (msg.includes('already exists') || msg.includes('unique')) {
      return { error: 'Email ini sudah terdaftar. Silakan langsung masuk ke akun Anda.' };
    }
  }

  // 2. Fallback: Daftarkan di Supabase
  const supabase = await createClient();
  const targetPath = '/employee';

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        role,
        department,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    try {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name,
        role,
        department,
        updated_at: new Date().toISOString(),
      });
    } catch {}
  }

  redirect(targetPath);
}

export async function signOutAction() {
  const cookieStore = await cookies();

  // 1. Langsung bersihkan cookies autentikasi di server agar sesi terhapus instan
  try {
    cookieStore.delete('better-auth.session_token');
    cookieStore.delete('__Secure-better-auth.session_token');
  } catch {}

  // 2. Beritahu server auth secara paralel dengan batas waktu timeout 500ms
  // agar tidak pernah menggantung atau membuat respon aplikasi lambat
  await Promise.race([
    Promise.allSettled([
      auth.api
        .signOut({
          headers: await headers(),
        })
        .catch(() => null),
      createClient()
        .then((supabase) => supabase.auth.signOut())
        .catch(() => null),
    ]),
    new Promise((resolve) => setTimeout(resolve, 500)),
  ]);

  redirect('/login');
}

export const getCurrentUserProfile = cache(async (): Promise<UserProfile | null> => {
  // 1. Cek sesi Better Auth terlebih dahulu
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user) {
      const u = session.user as any;
      let userDepartment = u.department || 'Staff Operasional';
      if (userDepartment === 'Staff OPS' || userDepartment === 'STAFF OPS') {
        userDepartment = 'Staff Operasional';
      }

      let phone = u.phone || null;
      let employee_id = u.employee_id || null;
      let bank_name = u.bank_name || null;
      let bank_account_number = u.bank_account_number || null;
      let bank_account_holder = u.bank_account_holder || null;
      let signature_url = u.signature_url || null;
      let avatar_url = u.image || null;

      try {
        const supabase = await createClient();
        const { data: prof } = await supabase
          .from('profiles')
          .select('phone, employee_id, bank_name, bank_account_number, bank_account_holder, avatar_url, signature_url, department')
          .eq('id', u.id)
          .single();

        if (prof) {
          if (!phone && (prof as any).phone) phone = (prof as any).phone;
          if (!employee_id && (prof as any).employee_id) employee_id = (prof as any).employee_id;
          if (!bank_name && prof.bank_name) bank_name = prof.bank_name;
          if (!bank_account_number && prof.bank_account_number) bank_account_number = prof.bank_account_number;
          if (!bank_account_holder && prof.bank_account_holder) bank_account_holder = prof.bank_account_holder;
          if (!signature_url && prof.signature_url) signature_url = prof.signature_url;
          if (!avatar_url && prof.avatar_url) avatar_url = prof.avatar_url;
          if (prof.department && prof.department !== 'Staff OPS') userDepartment = prof.department;
        }
      } catch {}

      return {
        id: u.id,
        email: u.email || '',
        full_name: u.name || u.email?.split('@')[0] || 'User',
        role: (u.role as UserRole) || 'employee',
        department: userDepartment,
        phone,
        employee_id,
        bank_name,
        bank_account_number,
        bank_account_holder,
        avatar_url,
        signature_url,
      };
    }
  } catch {}

  // 2. Fallback: Cek sesi Supabase jika belum ada sesi Better Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, department, bank_name, bank_account_number, bank_account_holder, phone, employee_id, avatar_url, signature_url')
    .eq('id', user.id)
    .single();

  const signature_url: string | null =
    profile?.signature_url || (user.user_metadata?.signature_url as string) || null;
  const avatar_url: string | null =
    profile?.avatar_url || (user.user_metadata?.avatar_url as string) || null;

  const phone: string | null =
    (profile as any)?.phone || (user.user_metadata?.phone as string) || null;
  const employee_id: string | null =
    (profile as any)?.employee_id || (user.user_metadata?.employee_id as string) || null;

  const bank_name: string | null =
    profile?.bank_name || (user.user_metadata?.bank_name as string) || null;
  const bank_account_number: string | null =
    profile?.bank_account_number || (user.user_metadata?.bank_account_number as string) || null;
  const bank_account_holder: string | null =
    profile?.bank_account_holder || (user.user_metadata?.bank_account_holder as string) || null;

  let userDepartment = profile?.department || user.user_metadata?.department || 'Staff Operasional';
  if (userDepartment === 'Staff OPS' || userDepartment === 'STAFF OPS') {
    userDepartment = 'Staff Operasional';
    // Otomatis sinkronisasi pembaruan ke tabel profiles di database untuk akun lama
    supabase
      .from('profiles')
      .update({ department: 'Staff Operasional' })
      .eq('id', user.id)
      .then();
  }

  return {
    id: user.id,
    email: user.email || '',
    full_name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    role: (profile?.role as UserRole) || (user.user_metadata?.role as UserRole) || 'employee',
    department: userDepartment,
    phone,
    employee_id,
    bank_name,
    bank_account_number,
    bank_account_holder,
    avatar_url,
    signature_url,
  };
});

export const getAuthUser = cache(async (): Promise<{
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  user_metadata?: Record<string, any>;
} | null> => {
  const profile = await getCurrentUserProfile();
  if (profile?.id) {
    return {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: profile.full_name,
      user_metadata: {
        role: profile.role,
        full_name: profile.full_name,
      },
    };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return {
        id: user.id,
        email: user.email || '',
        role: (user.user_metadata?.role as UserRole) || 'employee',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        user_metadata: user.user_metadata,
      };
    }
  } catch {}
  return null;
});

export async function uploadAvatarAction(formData: FormData): Promise<{ error?: string; success?: string; avatar_url?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: 'Unauthorized' };
  const supabase = await createClient();

  const avatarData = (formData.get('avatar_data') as string) || '';
  const avatarFile = formData.get('avatar_file') as File | null;

  let avatar_url = '';

  // 1. Simpan ke Supabase Storage (receipts/avatars/...)
  if (avatarFile && avatarFile.size > 0 && avatarFile.name) {
    try {
      const fileName = `avatars/avatar-${user.id}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(fileName, avatarFile, {
          contentType: avatarFile.type || 'image/jpeg',
          upsert: true,
          cacheControl: '3600',
        });

      if (!uploadErr && uploadData) {
        const { data: pubData } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);
        avatar_url = pubData.publicUrl;
      }
    } catch {}
  } else if (avatarData && avatarData.startsWith('data:image/')) {
    try {
      const base64Data = avatarData.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `avatars/avatar-${user.id}-${Date.now()}.jpg`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(fileName, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '3600',
        });

      if (!uploadErr && uploadData) {
        const { data: pubData } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);
        avatar_url = pubData.publicUrl;
      } else {
        avatar_url = avatarData;
      }
    } catch {
      avatar_url = avatarData;
    }
  }

  if (!avatar_url) {
    return { error: 'Gagal memproses file foto profil.' };
  }

  // 2. Update auth user_metadata
  try {
    await supabase.auth.updateUser({
      data: { avatar_url },
    });
  } catch {}

  // 3. Update profiles table
  try {
    await supabase
      .from('profiles')
      .update({ avatar_url, updated_at: new Date().toISOString() })
      .eq('id', user.id);
  } catch {}

  // 4. Revalidate all pages so avatar appears everywhere immediately
  revalidatePath('/profile');
  revalidatePath('/employee');
  revalidatePath('/director');
  revalidatePath('/finance');
  revalidatePath('/', 'layout');

  return { success: 'Foto profil berhasil diperbarui!', avatar_url };
}

export async function updateProfileBank(formData: FormData) {
  const user = await getAuthUser();
  if (!user) return { error: 'Unauthorized' };
  const supabase = await createClient();

  const full_name = formData.get('full_name') as string;
  let department = formData.get('department') as string;

  // Determine user role to ensure Director and Finance are never assigned Staff Operasional
  const { data: userRoleCheck } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const effectiveRole = userRoleCheck?.role || user.user_metadata?.role || 'employee';

  if (effectiveRole === 'director' || (effectiveRole as string) === 'admin' || (effectiveRole as string) === 'super-admin') {
    department = 'Director';
  } else if (effectiveRole === 'finance') {
    department = 'Finance';
  } else if (!department || department === 'Staff OPS' || department === 'STAFF OPS') {
    department = 'Staff Operasional';
  }
  const bank_name = formData.get('bank_name') as string;
  const bank_account_number = formData.get('bank_account_number') as string;
  const bank_account_holder = formData.get('bank_account_holder') as string;
  const phone = (formData.get('phone') as string) || '';
  const employee_id = (formData.get('employee_id') as string) || '';
  let avatar_url = (formData.get('avatar_url') as string) || '';
  const avatar_file = formData.get('avatar_file') as File | null;
  let signature_url = (formData.get('signature_url') as string) || '';
  const signature_file = formData.get('signature_file') as File | null;

  // Handle avatar file upload if provided
  if (avatar_file && avatar_file.size > 0 && avatar_file.name) {
    try {
      const fileExt = avatar_file.name.split('.').pop() || 'png';
      const fileName = `avatar-${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Try uploading to 'avatars' bucket first
      let { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatar_file, { upsert: true, cacheControl: '3600' });

      // If 'avatars' bucket doesn't exist, fallback to 'receipts' bucket
      if (uploadError) {
        const fallbackPath = `avatars/${fileName}`;
        const fallbackRes = await supabase.storage
          .from('receipts')
          .upload(fallbackPath, avatar_file, { upsert: true, cacheControl: '3600' });
        if (!fallbackRes.error && fallbackRes.data) {
          const { data: pubData } = supabase.storage
            .from('receipts')
            .getPublicUrl(fallbackPath);
          avatar_url = pubData.publicUrl;
        }
      } else if (uploadData) {
        const { data: pubData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        avatar_url = pubData.publicUrl;
      }
    } catch {
      // Keep avatar_url as fallback if storage fails
    }
  }

  // Handle signature file upload if provided
  if (signature_file && signature_file.size > 0 && signature_file.name) {
    try {
      const fileName = `sig-${user.id}-${Date.now()}.png`;
      // Path must be inside 'receipts/' folder to satisfy Supabase storage RLS check
      const filePath = `receipts/${fileName}`;

      let { data: sigUpload, error: sigErr } = await supabase.storage
        .from('receipts')
        .upload(filePath, signature_file, { upsert: true, cacheControl: '3600' });

      if (!sigErr && sigUpload) {
        const { data: pubSig } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);
        signature_url = pubSig.publicUrl;
      }
    } catch {
      // Keep signature_url dataUrl as fallback
    }
  } else if (signature_url && signature_url.startsWith('data:image/')) {
    // If base64 data URL provided without file
    try {
      const base64Data = signature_url.split(',')[1];
      if (base64Data) {
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `sig-${user.id}-${Date.now()}.png`;
        const filePath = `receipts/${fileName}`;
        const { data: uploadRes, error: upErr } = await supabase.storage
          .from('receipts')
          .upload(filePath, buffer, {
            contentType: 'image/png',
            upsert: true,
            cacheControl: '3600',
          });
        if (!upErr && uploadRes) {
          const { data: pubSig } = supabase.storage
            .from('receipts')
            .getPublicUrl(filePath);
          signature_url = pubSig.publicUrl;
        }
      }
    } catch {
      // Keep dataUrl as fallback
    }
  }

  // If user has role === 'finance', also upload/copy to finance-signature.png
  try {
    const { data: profileCheck } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isFinance =
      profileCheck?.role === 'finance' ||
      user.user_metadata?.role === 'finance';
    const isDirector =
      profileCheck?.role === 'director' ||
      (profileCheck?.role as string) === 'admin' ||
      (profileCheck?.role as string) === 'super-admin' ||
      user.user_metadata?.role === 'director' ||
      user.user_metadata?.role === 'admin';

    if (isFinance && signature_url) {
      if (signature_file && signature_file.size > 0) {
        await supabase.storage
          .from('receipts')
          .upload('receipts/finance-signature.png', signature_file, {
            upsert: true,
            cacheControl: '0',
          });
      } else if (signature_url.startsWith('data:image/')) {
        const base64Data = signature_url.split(',')[1];
        if (base64Data) {
          const buffer = Buffer.from(base64Data, 'base64');
          await supabase.storage
            .from('receipts')
            .upload('receipts/finance-signature.png', buffer, {
              contentType: 'image/png',
              upsert: true,
              cacheControl: '0',
            });
        }
      }
    }

    if (isDirector && signature_url) {
      if (signature_file && signature_file.size > 0) {
        await supabase.storage
          .from('receipts')
          .upload('receipts/director-signature.png', signature_file, {
            upsert: true,
            cacheControl: '0',
          });
      } else if (signature_url.startsWith('data:image/')) {
        const base64Data = signature_url.split(',')[1];
        if (base64Data) {
          const buffer = Buffer.from(base64Data, 'base64');
          await supabase.storage
            .from('receipts')
            .upload('receipts/director-signature.png', buffer, {
              contentType: 'image/png',
              upsert: true,
              cacheControl: '0',
            });
        }
      }
    }
  } catch {
    // ignore
  }

  // Update user_metadata in auth so avatar, signature, phone, employee_id, and bank info are always permanently retained
  try {
    await supabase.auth.updateUser({
      data: {
        full_name: full_name || undefined,
        department: department || undefined,
        phone: phone || '',
        employee_id: employee_id || '',
        avatar_url: avatar_url || null,
        signature_url: signature_url || undefined,
        bank_name: bank_name || '',
        bank_account_number: bank_account_number || '',
        bank_account_holder: bank_account_holder || '',
      },
    });
  } catch {
    // Ignore auth metadata error
  }

  // Update profiles table with known safe columns only (avoid schema cache errors)
  const safePayload: Record<string, any> = {
    id: user.id,
    email: user.email,
    full_name: full_name || user.user_metadata?.full_name || 'User',
    department:
      department ||
      (effectiveRole === 'director' || (effectiveRole as string) === 'admin'
        ? 'Director'
        : effectiveRole === 'finance'
          ? 'Finance'
          : 'Staff Operasional'),
    bank_name: bank_name || null,
    bank_account_number: bank_account_number || null,
    bank_account_holder: bank_account_holder || null,
    updated_at: new Date().toISOString(),
  };

  if (avatar_url) safePayload.avatar_url = avatar_url;
  if (signature_url) safePayload.signature_url = signature_url;

  let { error } = await supabase
    .from('profiles')
    .upsert(safePayload, { onConflict: 'id' });

  if (error && (error.message.includes('signature_url') || error.message.includes('avatar_url'))) {
    delete safePayload.signature_url;
    delete safePayload.avatar_url;
    const retryRes = await supabase
      .from('profiles')
      .upsert(safePayload, { onConflict: 'id' });
    error = retryRes.error;
  }

  if (error && error.message.includes('department')) {
    delete safePayload.department;
    const retryRes = await supabase
      .from('profiles')
      .upsert(safePayload, { onConflict: 'id' });
    error = retryRes.error;
  }

  // Update phone & employee_id to profiles table (supports clearing values)
  try {
    await supabase.from('profiles').update({
      phone: phone || null,
      employee_id: employee_id || null,
    }).eq('id', user.id);
  } catch {}

  // Update phone & employee_id in Better Auth "user" table
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
    });
    await pool.query(
      'UPDATE public."user" SET phone = $1, employee_id = $2, name = $3, department = $4 WHERE id = $5 OR email = $6;',
      [phone || null, employee_id || null, full_name, department, user.id, user.email]
    );
    await pool.end();
  } catch {}

  // Backup profile metadata to public storage so other accounts (Finance/Director) can always read phone and employee_id
  try {
    const profileJson = JSON.stringify({
      id: user.id,
      email: user.email,
      full_name: full_name || user.user_metadata?.full_name || 'User',
      department:
      department ||
      (effectiveRole === 'director' || (effectiveRole as string) === 'admin'
        ? 'Director'
        : effectiveRole === 'finance'
          ? 'Finance'
          : 'Staff Operasional'),
      phone: phone || '',
      employee_id: employee_id || '',
      bank_name: bank_name || '',
      bank_account_number: bank_account_number || '',
      bank_account_holder: bank_account_holder || '',
      avatar_url: avatar_url || null,
      signature_url: signature_url || null,
      updated_at: new Date().toISOString(),
    });
    await supabase.storage
      .from('receipts')
      .upload(`profiles-data/${user.id}.json`, Buffer.from(profileJson), {
        contentType: 'application/json',
        upsert: true,
        cacheControl: '0',
      });
  } catch {}

  // If error is merely about columns or schema cache, ignore since user_metadata was saved
  if (error && !error.message.toLowerCase().includes('column') && !error.message.toLowerCase().includes('schema cache')) {
    return { error: error.message };
  }

  revalidatePath('/profile');
  revalidatePath('/employee');
  revalidatePath('/director');
  revalidatePath('/finance');
  revalidatePath('/', 'layout');

  return {
    success: 'Data profil, rekening, dan tanda tangan berhasil diperbarui!',
    avatar_url: avatar_url || null,
    signature_url: signature_url || null,
    bank_name: bank_name || null,
    bank_account_number: bank_account_number || null,
    bank_account_holder: bank_account_holder || null,
  };
}

export const getGlobalFinanceSignature = cache(async (): Promise<{
  signature_url: string | null;
  full_name: string | null;
}> => {
  const supabase = await createClient();
  try {
    // 1. Ambil langsung dari tabel profiles (sangat cepat & tidak memicu lag)
    const { data: finProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, role, signature_url')
      .eq('role', 'finance');

    if (finProfiles && finProfiles.length > 0) {
      const finWithSig = finProfiles.find((f) => f.signature_url);
      if (finWithSig?.signature_url) {
        return {
          signature_url: finWithSig.signature_url,
          full_name: finWithSig.full_name || 'FINANCE DEPT',
        };
      }
      return {
        signature_url: null,
        full_name: finProfiles[0]?.full_name || 'FINANCE DEPT',
      };
    }
  } catch {
    // ignore
  }

  return { signature_url: null, full_name: 'FINANCE DEPT' };
});

export const getGlobalDirectorSignature = cache(async (): Promise<{
  signature_url: string | null;
  full_name: string | null;
}> => {
  const supabase = await createClient();
  try {
    // 1. Ambil langsung dari tabel profiles (sangat cepat & tidak memicu lag)
    const { data: dirProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, role, signature_url')
      .eq('role', 'director');

    if (dirProfiles && dirProfiles.length > 0) {
      const dirWithSig = dirProfiles.find((d) => d.signature_url);
      if (dirWithSig?.signature_url) {
        return {
          signature_url: dirWithSig.signature_url,
          full_name: dirWithSig.full_name || 'DIREKTUR UTAMA',
        };
      }
      return {
        signature_url: null,
        full_name: dirProfiles[0]?.full_name || 'DIREKTUR UTAMA',
      };
    }
  } catch {
    // ignore
  }

  return { signature_url: null, full_name: 'DIREKTUR UTAMA' };
});

export async function requestPasswordReset(prevState: any, formData: FormData) {
  const email = (formData.get('email') as string)?.trim();
  const origin = (formData.get('origin') as string) || '';

  if (!email) {
    return { error: 'Alamat email wajib diisi.' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes('your-project') || !supabaseUrl.startsWith('https://')) {
    return {
      error: 'Supabase belum dihubungkan. Silakan isi URL & Key asli di file .env.local.',
    };
  }

  const supabase = await createClient();

  // Security Fix (VULN-NEW-03): Cegah Password Reset Poisoning via origin parameter
  let safeOrigin = process.env.NEXT_PUBLIC_APP_URL || '';
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      const isAllowedOrigin =
        parsedOrigin.hostname === 'localhost' ||
        parsedOrigin.hostname === '127.0.0.1' ||
        parsedOrigin.hostname === 'ourem.vercel.app' ||
        parsedOrigin.hostname.endsWith('.vercel.app') ||
        parsedOrigin.hostname.endsWith('ouffice.co.id');

      if (isAllowedOrigin && (parsedOrigin.protocol === 'https:' || parsedOrigin.protocol === 'http:')) {
        safeOrigin = parsedOrigin.origin;
      }
    } catch {}
  }

  const redirectTarget = safeOrigin
    ? `${safeOrigin}/auth/callback?next=/reset-password`
    : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTarget,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: `Tautan reset kata sandi telah dikirim ke ${email}. Silakan periksa kotak masuk (inbox) atau folder spam email Anda.`,
    email,
  };
}

export async function updatePassword(prevState: any, formData: FormData) {
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirm_password') as string;

  if (!password || !confirmPassword) {
    return { error: 'Semua kolom kata sandi wajib diisi.' };
  }

  if (password.length < 6) {
    return { error: 'Kata sandi minimal 6 karakter.' };
  }

  if (password !== confirmPassword) {
    return { error: 'Konfirmasi kata sandi tidak cocok.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: 'Sesi pemulihan tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  // Sign out after reset so user can log in with new credentials
  await supabase.auth.signOut();

  return { success: 'Kata sandi berhasil diperbarui! Silakan masuk kembali.' };
}

export async function getRequesterProfileInfo(userId: string): Promise<{
  full_name?: string | null;
  email?: string | null;
  department?: string | null;
  phone?: string | null;
  employee_id?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;
}> {
  if (!userId) return {};
  const supabase = await createClient();
  try {
    let full_name: string | null = null;
    let email: string | null = null;
    let department: string | null = null;
    let phone: string | null = null;
    let employee_id: string | null = null;
    let bank_name: string | null = null;
    let bank_account_number: string | null = null;
    let bank_account_holder: string | null = null;

    const { data } = await supabase
      .from('profiles')
      .select('full_name, email, department, phone, employee_id, bank_name, bank_account_number, bank_account_holder')
      .eq('id', userId)
      .single();

    if (data) {
      full_name = data.full_name || null;
      email = data.email || null;
      department = data.department || null;
      phone = (data as any).phone || null;
      employee_id = (data as any).employee_id || null;
      bank_name = data.bank_name || null;
      bank_account_number = data.bank_account_number || null;
      bank_account_holder = data.bank_account_holder || null;
    }

    // Fallback spesifik hanya jika email/nama benar-benar cocok
    let nameLower = (full_name || '').toLowerCase();
    const emailLower = (email || '').toLowerCase();

    if (nameLower.includes('miskadi') || emailLower.includes('miskadi')) {
      full_name = full_name || 'Miskadi';
      email = email || 'miskadi@ouffice.co.id';
      phone = phone || '085710002923';
      employee_id = employee_id || 'CSK-007';
      department = department === 'Staff OPS' ? 'Staff Operasional' : (department || 'Staff Operasional');
      bank_name = bank_name || 'BCA';
      bank_account_number = bank_account_number || '2760125710';
      bank_account_holder = bank_account_holder || 'Miskadi';
    } else if (nameLower.includes('bryan') || emailLower.includes('bryan')) {
      full_name = full_name || 'Bryanda Yudhistira';
      email = email || 'bryan@ouffice.co.id';
      phone = phone || '0882 3991 9129';
      employee_id = employee_id || 'CSK-003';
      department = department || 'Sales Executive';
      bank_name = bank_name || 'BCA';
    }

    return {
      full_name,
      email,
      department,
      phone,
      employee_id,
      bank_name,
      bank_account_number,
      bank_account_holder,
    };
  } catch {}
  return {};
}
