import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getUserNotifications } from '@/actions/requests';

export const dynamic = 'force-dynamic';

function cleanUrl(url?: string): string {
  if (!url) return '';
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

export async function GET(request: Request) {
  try {
    // Security Fix (VULN-07): Autentikasi sesi & otorisasi akses polling notifikasi
    const serverSupabase = await createClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Sesi login diperlukan untuk polling notifikasi.' },
        { status: 401 }
      );
    }

    const { data: userProfile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const actualRole = userProfile?.role || 'employee';

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    const requestedRole = searchParams.get('role');

    // Mencegah IDOR: User hanya boleh mengakses notifikasinya sendiri
    const effectiveUserId = user.id;

    // Mencegah privilege escalation: User hanya boleh polling role sesuai role akunnya
    let effectiveRole = actualRole;
    if (requestedRole && (requestedRole === 'director' || requestedRole === 'finance')) {
      if (actualRole !== requestedRole) {
        effectiveRole = actualRole; // Tolak spoofing role director/finance
      } else {
        effectiveRole = requestedRole;
      }
    }

    const supabaseUrl = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) || 'https://placeholder.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
    const combined: any[] = [];
    const seenIds = new Set<string>();

    // 1. Ambil dari file antrean notifikasi user milik pengguna yang terautentikasi
    if (effectiveUserId) {
      try {
        const { data: userData } = await supabase.storage
          .from('receipts')
          .download(`app-notifications/user-${effectiveUserId}.json`);
        if (userData) {
          const list = JSON.parse(await userData.text());
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item && item.id && !seenIds.has(item.id)) {
                seenIds.add(item.id);
                combined.push(item);
              }
            }
          }
        }
      } catch {}
    }

    // 2. Ambil dari file antrean notifikasi role sesuai role sah pengguna
    if (effectiveRole) {
      try {
        const { data: roleData } = await supabase.storage
          .from('receipts')
          .download(`app-notifications/role-${effectiveRole}.json`);
        if (roleData) {
          const list = JSON.parse(await roleData.text());
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item && item.id && !seenIds.has(item.id)) {
                seenIds.add(item.id);
                combined.push(item);
              }
            }
          }
        }
      } catch {}
    }

    // 3. Fallback: ambil dari getUserNotifications
    try {
      const userNotifs = await getUserNotifications(effectiveRole);
      if (Array.isArray(userNotifs)) {
        for (const item of userNotifs) {
          if (item && item.id && !seenIds.has(item.id)) {
            seenIds.add(item.id);
            combined.push({
              id: item.id,
              title: item.title,
              message: item.message,
              url: item.link || '/',
              createdAt: item.createdAt || item.date || new Date().toISOString(),
            });
          }
        }
      }
    } catch {}

    // Urutkan dari yang paling baru
    combined.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      count: combined.length,
      notifications: combined,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch notifications',
        notifications: [],
      },
      { status: 200 }
    );
  }
}
