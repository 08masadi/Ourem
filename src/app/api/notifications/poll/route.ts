import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getUserNotifications } from '@/actions/requests';

export const dynamic = 'force-dynamic';

function cleanUrl(url?: string): string {
  if (!url) return '';
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');

    const supabaseUrl = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) || 'https://placeholder.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
    const combined: any[] = [];
    const seenIds = new Set<string>();

    // 1. Ambil dari file antrean notifikasi user: app-notifications/user-${userId}.json
    if (userId) {
      try {
        const { data: userData } = await supabase.storage
          .from('receipts')
          .download(`app-notifications/user-${userId}.json`);
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

    // 2. Ambil dari file antrean notifikasi role: app-notifications/role-${role}.json
    if (role) {
      try {
        const { data: roleData } = await supabase.storage
          .from('receipts')
          .download(`app-notifications/role-${role}.json`);
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

    // 3. Fallback: ambil dari getUserNotifications jika cookie sesi pengguna tersedia
    try {
      const userNotifs = await getUserNotifications(role || undefined);
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
