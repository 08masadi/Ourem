'use server';

import { createClient } from '@/lib/supabase/server';
import { UserRole, UserProfile } from '@/types/database';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

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
  // Security Fix (VULN-02): Cegah eskalasi hak akses saat pendaftaran akun baru.
  // Semua pendaftaran baru selalu diatur ke role 'employee'.
  // Role 'director' atau 'finance' hanya boleh diberikan oleh Administrator di panel Supabase.
  const role: UserRole = 'employee';
  let department = (formData.get('department') as string || '').trim();
  if (!department) {
    department = 'Staff OPS';
  }

  let safeOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://ourem.vercel.app';
  const rawOrigin = (formData.get('origin') as string) || '';
  if (rawOrigin) {
    try {
      const parsed = new URL(rawOrigin);
      const isAllowed =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === 'ourem.vercel.app' ||
        parsed.hostname.endsWith('.vercel.app') ||
        parsed.hostname.endsWith('ouffice.co.id');
      if (isAllowed && (parsed.protocol === 'https:' || parsed.protocol === 'http:')) {
        safeOrigin = parsed.origin;
      }
    } catch {}
  }

  const origin = safeOrigin;

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

  const targetPath = '/employee';

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${targetPath}`,
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
    // Upsert to profiles table
    const profilePayload: Record<string, any> = {
      id: data.user.id,
      email,
      full_name,
      role,
      department,
      updated_at: new Date().toISOString(),
    };
    let { error: profErr } = await supabase.from('profiles').upsert(profilePayload);
    if (profErr && profErr.message.includes('department')) {
      delete profilePayload.department;
      await supabase.from('profiles').upsert(profilePayload);
    }
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
    .select('id, email, full_name, role, department, bank_name, bank_account_number, bank_account_holder, avatar_url, signature_url')
    .eq('id', user.id)
    .single();

  const signature_url: string | null =
    profile?.signature_url || (user.user_metadata?.signature_url as string) || null;
  const avatar_url: string | null =
    profile?.avatar_url || (user.user_metadata?.avatar_url as string) || null;

  let phone: string | null =
    (profile as any)?.phone || (user.user_metadata?.phone as string) || null;
  let employee_id: string | null =
    (profile as any)?.employee_id || (user.user_metadata?.employee_id as string) || null;

  if (!phone || !employee_id) {
    try {
      const { data: fileData } = await supabase.storage
        .from('receipts')
        .download(`profiles-data/${user.id}.json`);
      if (fileData) {
        const text = await fileData.text();
        const json = JSON.parse(text);
        if (!phone && json.phone) phone = json.phone;
        if (!employee_id && json.employee_id) employee_id = json.employee_id;
      }
    } catch {}
  }

  const nameLower = (profile?.full_name || user.user_metadata?.full_name || '').toLowerCase();
  const emailLower = (user.email || '').toLowerCase();
  if (!phone || !employee_id) {
    if (nameLower.includes('miskadi') || emailLower.includes('miskadi')) {
      phone = phone || '085710002923';
      employee_id = employee_id || 'CSK-007';
    } else if (nameLower.includes('bryan') || emailLower.includes('bryan')) {
      phone = phone || '0882 3991 9129';
      employee_id = employee_id || 'CSK-003';
    }
  }

  const bank_name: string | null =
    profile?.bank_name || (user.user_metadata?.bank_name as string) || null;
  const bank_account_number: string | null =
    profile?.bank_account_number || (user.user_metadata?.bank_account_number as string) || null;
  const bank_account_holder: string | null =
    profile?.bank_account_holder || (user.user_metadata?.bank_account_holder as string) || null;

  return {
    id: user.id,
    email: user.email || '',
    full_name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    role: (profile?.role as UserRole) || (user.user_metadata?.role as UserRole) || 'employee',
    department: profile?.department || user.user_metadata?.department || 'Staff OPS',
    phone,
    employee_id,
    bank_name,
    bank_account_number,
    bank_account_holder,
    avatar_url,
    signature_url,
  };
}

export async function uploadAvatarAction(formData: FormData): Promise<{ error?: string; success?: string; avatar_url?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

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
      user.user_metadata?.role === 'director';

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
    department: department || (effectiveRole === 'director' ? 'Director' : effectiveRole === 'finance' ? 'Finance' : 'Staff OPS'),
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

  // Try to update phone & employee_id to profiles table if columns exist, but never fail if they don't
  if (phone || employee_id) {
    try {
      const extraCols: Record<string, any> = {};
      if (phone) extraCols.phone = phone;
      if (employee_id) extraCols.employee_id = employee_id;
      await supabase.from('profiles').update(extraCols).eq('id', user.id);
    } catch {}
  }

  // Backup profile metadata to public storage so other accounts (Finance/Director) can always read phone and employee_id
  try {
    const profileJson = JSON.stringify({
      id: user.id,
      email: user.email,
      full_name: full_name || user.user_metadata?.full_name || 'User',
      department: department || (effectiveRole === 'director' ? 'Director' : effectiveRole === 'finance' ? 'Finance' : 'Staff OPS'),
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

export async function getGlobalFinanceSignature(): Promise<{
  signature_url: string | null;
  full_name: string | null;
}> {
  const supabase = await createClient();
  try {
    // 1. Direct check in profiles table
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
    }

    // 2. Direct check: receipts/finance-signature.png
    const { data: rootFiles } = await supabase.storage.from('receipts').list('receipts');
    const hasFinSig = (rootFiles || []).some((f) => f.name.includes('finance-signature'));
    if (hasFinSig) {
      const { data: pubData } = supabase.storage
        .from('receipts')
        .getPublicUrl('receipts/finance-signature.png');

      return {
        signature_url: pubData.publicUrl,
        full_name: finProfiles?.[0]?.full_name || 'FINANCE DEPT',
      };
    }

    // 3. Search storage files for finance user
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

  return { signature_url: null, full_name: 'FINANCE DEPT' };
}

export async function getGlobalDirectorSignature(): Promise<{
  signature_url: string | null;
  full_name: string | null;
}> {
  const supabase = await createClient();
  try {
    // 1. Direct check in profiles table
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
    }

    // 2. Direct check in storage: receipts/director-signature.png
    const { data: rootFiles } = await supabase.storage.from('receipts').list('receipts');
    const hasDirSig = (rootFiles || []).some((f) => f.name.includes('director-signature'));
    if (hasDirSig) {
      const { data: pubData } = supabase.storage
        .from('receipts')
        .getPublicUrl('receipts/director-signature.png');

      return {
        signature_url: pubData.publicUrl,
        full_name: dirProfiles?.[0]?.full_name || 'DIREKTUR UTAMA',
      };
    }

    // 3. Search storage for director user id
    if (dirProfiles && dirProfiles.length > 0) {
      for (const dirUser of dirProfiles) {
        const dirFile = (rootFiles || []).find(
          (f) => f.name.includes(`sig-${dirUser.id}`) || f.name.includes(dirUser.id)
        );
        if (dirFile) {
          const { data: pubData } = supabase.storage
            .from('receipts')
            .getPublicUrl(`receipts/${dirFile.name}`);
          return {
            signature_url: pubData.publicUrl,
            full_name: dirUser.full_name || 'DIREKTUR UTAMA',
          };
        }

        const { data: sigFiles } = await supabase.storage.from('receipts').list('signatures');
        const dirSigFile = (sigFiles || []).find((f) => f.name.includes(dirUser.id));
        if (dirSigFile) {
          const { data: pubData } = supabase.storage
            .from('receipts')
            .getPublicUrl(`signatures/${dirSigFile.name}`);
          return {
            signature_url: pubData.publicUrl,
            full_name: dirUser.full_name || 'DIREKTUR UTAMA',
          };
        }
      }
      return { signature_url: null, full_name: dirProfiles[0].full_name || 'DIREKTUR UTAMA' };
    }
  } catch {
    // ignore
  }

  return { signature_url: null, full_name: 'DIREKTUR UTAMA' };
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
      .select('*')
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

    // 1. Check storage profiles-data/${userId}.json
    if (!phone || !employee_id) {
      try {
        const { data: fileData } = await supabase.storage
          .from('receipts')
          .download(`profiles-data/${userId}.json`);
        if (fileData) {
          const text = await fileData.text();
          const json = JSON.parse(text);
          if (json) {
            full_name = full_name || json.full_name || null;
            email = email || json.email || null;
            department = department || json.department || null;
            phone = phone || json.phone || null;
            employee_id = employee_id || json.employee_id || null;
            bank_name = bank_name || json.bank_name || null;
            bank_account_number = bank_account_number || json.bank_account_number || null;
            bank_account_holder = bank_account_holder || json.bank_account_holder || null;
          }
        }
      } catch {}
    }

    // 2. Directory fallback for seeded employees
    const isGeneric = (n?: string | null) => !n || ['employee', 'karyawan', 'staff'].includes(n.trim().toLowerCase());
    let nameLower = (full_name || '').toLowerCase();
    const emailLower = (email || '').toLowerCase();

    if (nameLower.includes('miskadi') || emailLower.includes('miskadi') || isGeneric(full_name)) {
      full_name = isGeneric(full_name) ? 'Miskadi' : full_name || 'Miskadi';
      email = email || 'miskadi@ouffice.co.id';
      phone = phone || '085710002923';
      employee_id = employee_id || 'CSK-007';
      department = department || 'Staff OPS';
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
    } else if (nameLower.includes('staff') || emailLower.includes('karyawan')) {
      phone = phone || '0882 3991 9129';
      employee_id = employee_id || 'CSK-002';
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
