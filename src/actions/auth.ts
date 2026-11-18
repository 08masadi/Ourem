'use server';

import { createClient } from '@/lib/supabase/server';
import { UserRole, UserProfile } from '@/types/database';
import { redirect } from 'next/navigation';

export async function signIn(prevState: any, formData: FormData) {
  const rawEmail = formData.get('email') as string;
  const password = formData.get('password') as string;

  const email = (rawEmail || '').trim().toLowerCase();

  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes('your-project') || !supabaseUrl.startsWith('https://')) {
    return {
      error: 'Supabase belum dihubungkan. Silakan isi URL & Key asli di file .env.local.',
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login credentials')) {
      return {
        error: 'Email atau kata sandi tidak cocok. Jika Anda baru mendaftar, pastikan email Anda sudah dikonfirmasi (atau dikonfirmasi langsung oleh admin di panel Supabase).',
      };
    }
    if (msg.includes('email not confirmed')) {
      return {
        error: 'Email belum dikonfirmasi. Silakan buka tautan konfirmasi di email Anda atau minta Admin untuk mengonfirmasi akun di Supabase.',
      };
    }
    return { error: error.message };
  }

  // Determine user role
  let role: UserRole = (data.user?.user_metadata?.role as UserRole) || 'employee';

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (profile?.role) {
    role = profile.role as UserRole;
  }

  const targetPath = role === 'director' ? '/director' : role === 'finance' ? '/finance' : '/employee';
  redirect(targetPath);
}

export async function signUp(prevState: any, formData: FormData) {
  const rawEmail = formData.get('email') as string;
  const password = formData.get('password') as string;
  const full_name = (formData.get('full_name') as string || '').trim();
  const role = (formData.get('role') as UserRole) || 'employee';
  const origin = (formData.get('origin') as string) || 'https://ourem.vercel.app';

  const email = (rawEmail || '').trim().toLowerCase();

  if (!email || !password || !full_name) {
    return { error: 'Nama lengkap, email, dan password wajib diisi.' };
  }

  if (password.length < 6) {
    return { error: 'Password minimal 6 karakter.' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes('your-project') || !supabaseUrl.startsWith('https://')) {
    return {
      error: 'Supabase belum dihubungkan. Silakan isi URL & Key asli di file .env.local.',
    };
  }

  const supabase = await createClient();

  const targetPath = role === 'director' ? '/director' : role === 'finance' ? '/finance' : '/employee';

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${targetPath}`,
      data: {
        full_name,
        role,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    // Upsert to profiles table
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name,
      role,
      updated_at: new Date().toISOString(),
    });
  }

  // If session is already created (email confirmation disabled in Supabase)
  if (data.session) {
    redirect(targetPath);
  }

  return {
    success: 'Pendaftaran berhasil! Silakan periksa inbox email untuk tautan konfirmasi, atau hubungi Admin untuk konfirmasi akun langsung di Supabase.',
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, department, bank_name, bank_account_number, bank_account_holder')
    .eq('id', user.id)
    .single();

  const signature_url: string | null =
    (user.user_metadata?.signature_url as string) || null;
  const avatar_url: string | null =
    (user.user_metadata?.avatar_url as string) || null;

  return {
    id: user.id,
    email: user.email || '',
    full_name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    role: (profile?.role as UserRole) || (user.user_metadata?.role as UserRole) || 'employee',
    department: profile?.department || user.user_metadata?.department || 'Staff OPS',
    bank_name: profile?.bank_name || null,
    bank_account_number: profile?.bank_account_number || null,
    bank_account_holder: profile?.bank_account_holder || null,
    avatar_url,
    signature_url,
  };
}

export async function updateProfileBank(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  const full_name = formData.get('full_name') as string;
  let department = formData.get('department') as string;

  // Determine user role to ensure Director and Finance are never assigned Staff OPS
  const { data: userRoleCheck } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const effectiveRole = userRoleCheck?.role || user.user_metadata?.role || 'employee';

  if (effectiveRole === 'director') {
    department = 'Director';
  } else if (effectiveRole === 'finance') {
    department = 'Finance';
  } else if (!department) {
    department = 'Staff OPS';
  }
  const bank_name = formData.get('bank_name') as string;
  const bank_account_number = formData.get('bank_account_number') as string;
  const bank_account_holder = formData.get('bank_account_holder') as string;
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
  } catch {
    // ignore
  }

  // Update user_metadata in auth so avatar and signature are always retained
  try {
    await supabase.auth.updateUser({
      data: {
        full_name: full_name || undefined,
        department: department || undefined,
        avatar_url: avatar_url || undefined,
        signature_url: signature_url || undefined,
      },
    });
  } catch {
    // Ignore auth metadata error
  }

  // Update profiles table with fallback if avatar_url/signature_url columns are not yet migrated
  const fullPayload: Record<string, any> = {
    full_name: full_name || undefined,
    department: department || (effectiveRole === 'director' ? 'Director' : effectiveRole === 'finance' ? 'Finance' : 'Staff OPS'),
    bank_name: bank_name || null,
    bank_account_number: bank_account_number || null,
    bank_account_holder: bank_account_holder || null,
    updated_at: new Date().toISOString(),
  };

  if (avatar_url) fullPayload.avatar_url = avatar_url;
  if (signature_url) fullPayload.signature_url = signature_url;

  let { error } = await supabase
    .from('profiles')
    .update(fullPayload)
    .eq('id', user.id);

  if (error && (error.message.includes('signature_url') || error.message.includes('avatar_url'))) {
    delete fullPayload.signature_url;
    delete fullPayload.avatar_url;
    const retryRes = await supabase
      .from('profiles')
      .update(fullPayload)
      .eq('id', user.id);
    error = retryRes.error;
  }

  if (error && error.message.includes('department')) {
    delete fullPayload.department;
    const retryRes = await supabase
      .from('profiles')
      .update(fullPayload)
      .eq('id', user.id);
    error = retryRes.error;
  }

  if (error) {
    return { error: error.message };
  }

  return {
    success: 'Data profil, rekening, dan tanda tangan berhasil diperbarui!',
    avatar_url: avatar_url || null,
    signature_url: signature_url || null,
  };
}

export async function getGlobalFinanceSignature(): Promise<{
  signature_url: string | null;
  full_name: string | null;
}> {
  const supabase = await createClient();
  try {
    // 1. Direct check: receipts/finance-signature.png
    const { data: rootFiles } = await supabase.storage.from('receipts').list('receipts');
    const hasFinSig = (rootFiles || []).some((f) => f.name.includes('finance-signature'));
    if (hasFinSig) {
      const { data: pubData } = supabase.storage
        .from('receipts')
        .getPublicUrl('receipts/finance-signature.png');

      const { data: finProfiles } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('role', 'finance');

      return {
        signature_url: pubData.publicUrl,
        full_name: finProfiles?.[0]?.full_name || 'FINANCE DEPT',
      };
    }

    // 2. Query profiles table for role === 'finance'
    const { data: finProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'finance');

    if (finProfiles && finProfiles.length > 0) {
      for (const finUser of finProfiles) {
        // Search inside 'receipts' folder for sig-finUser.id
        const finFile = (rootFiles || []).find(
          (f) => f.name.includes(`sig-${finUser.id}`) || f.name.includes(finUser.id)
        );
        if (finFile) {
          const { data: pubData } = supabase.storage
            .from('receipts')
            .getPublicUrl(`receipts/${finFile.name}`);
          return {
            signature_url: pubData.publicUrl,
            full_name: finUser.full_name || 'FINANCE DEPT',
          };
        }

        // Also check 'signatures' folder
        const { data: sigFiles } = await supabase.storage.from('receipts').list('signatures');
        const finSig = (sigFiles || []).find((f) => f.name.includes(finUser.id));
        if (finSig) {
          const { data: pubData } = supabase.storage
            .from('receipts')
            .getPublicUrl(`signatures/${finSig.name}`);
          return {
            signature_url: pubData.publicUrl,
            full_name: finUser.full_name || 'FINANCE DEPT',
          };
        }
      }
      return { signature_url: null, full_name: finProfiles[0].full_name || 'FINANCE DEPT' };
    }
  } catch {
    // ignore
  }

  return { signature_url: null, full_name: null };
}

export async function getGlobalDirectorSignature(): Promise<{
  signature_url: string | null;
  full_name: string | null;
}> {
  const supabase = await createClient();
  try {
    const { data: dirProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'director');

    if (dirProfiles && dirProfiles.length > 0) {
      return { signature_url: null, full_name: dirProfiles[0].full_name || 'DIRECTOR' };
    }
  } catch {
    // ignore
  }

  return { signature_url: null, full_name: 'DIRECTOR' };
}

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

  const redirectTarget = origin
    ? `${origin}/auth/callback?next=/reset-password`
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
