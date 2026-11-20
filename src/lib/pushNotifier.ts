import { setVapidDetails, sendNotification, type PushSubscription } from 'web-push';
import { createClient } from '@/lib/supabase/server';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BFjdw5B__5724ShiRwAyNrzhp_B0Ob0UAtD9YZJQ5QYvoZvC7KmaNUTVZNR3F4AzNUZTLWi88SB-nDtC2e_2aHk';
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'VAQ9yWjZ7F4243vVuPEicm3MvjxkNH2WSxyejfFd8KQ';
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:admin@ouffice.co.id';

try {
  setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.error('Failed to initialize web-push VAPID details:', err);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

export interface StoredSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  role?: string;
  updatedAt: string;
  userAgent?: string;
}

interface UserSubscriptionFile {
  userId: string;
  role: string;
  subscriptions: StoredSubscription[];
}

/**
 * Menyimpan push subscription dari HP Android / browser user ke Supabase Storage
 */
export async function saveSubscriptionToStorage(
  userId: string,
  role: string,
  subscription: PushSubscription,
  userAgent?: string
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const filePath = `push-subscriptions/${userId}.json`;

    let existingData: UserSubscriptionFile = {
      userId,
      role,
      subscriptions: [],
    };

    try {
      const { data: fileData } = await supabase.storage
        .from('receipts')
        .download(filePath);
      if (fileData) {
        const text = await fileData.text();
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.subscriptions)) {
          existingData = parsed;
          existingData.role = role || existingData.role;
        }
      }
    } catch {
      // File belum ada
    }

    const newSub: StoredSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      role,
      updatedAt: new Date().toISOString(),
      userAgent: userAgent || 'Android/Web',
    };

    // Filter duplikat berdasarkan endpoint
    const filtered = existingData.subscriptions.filter(
      (s) => s.endpoint !== subscription.endpoint
    );
    filtered.push(newSub);
    existingData.subscriptions = filtered;
    existingData.role = role;

    await supabase.storage
      .from('receipts')
      .upload(filePath, Buffer.from(JSON.stringify(existingData, null, 2)), {
        contentType: 'application/json',
        upsert: true,
        cacheControl: '0',
      });

    return true;
  } catch (err) {
    console.error('Error saving push subscription:', err);
    return false;
  }
}

/**
 * Mengirim notifikasi push ke satu pengguna (semua device Android/PWA miliknya)
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  try {
    const supabase = await createClient();
    const filePath = `push-subscriptions/${userId}.json`;

    const { data: fileData, error } = await supabase.storage
      .from('receipts')
      .download(filePath);
    if (error || !fileData) return;

    const text = await fileData.text();
    const userFile: UserSubscriptionFile = JSON.parse(text);

    if (!userFile || !Array.isArray(userFile.subscriptions)) return;

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      tag: payload.tag || `ourem-${Date.now()}`,
      icon: payload.icon || '/icons/icon-192.png',
      badge: payload.badge || '/icons/icon-192.png',
    });

    const activeSubs: StoredSubscription[] = [];

    for (const sub of userFile.subscriptions) {
      try {
        await sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payloadString,
          {
            TTL: 60 * 60 * 24, // 24 jam agar tersampaikan saat HP baru menyala/online
            urgency: 'high', // Prioritas tinggi agar Android membangunkan layar/notifikasi saat sleep
          }
        );
        activeSubs.push(sub);
      } catch (sendErr: any) {
        // Jika status 410 atau 404, subscription sudah kadaluarsa (app di-uninstall / di-reset)
        if (sendErr?.statusCode === 410 || sendErr?.statusCode === 404) {
          // hapus subscription usang
        } else {
          activeSubs.push(sub);
        }
      }
    }

    // Perbarui file jika ada yang usang
    if (activeSubs.length !== userFile.subscriptions.length) {
      userFile.subscriptions = activeSubs;
      await supabase.storage
        .from('receipts')
        .upload(filePath, Buffer.from(JSON.stringify(userFile, null, 2)), {
          contentType: 'application/json',
          upsert: true,
          cacheControl: '0',
        });
    }
  } catch (err) {
    console.error(`Error sending push to user ${userId}:`, err);
  }
}

/**
 * Mengirim notifikasi push ke semua pengguna dengan role tertentu (misal: 'finance' atau 'director')
 */
export async function sendPushToRole(targetRole: string, payload: PushPayload) {
  try {
    const supabase = await createClient();
    const { data: files } = await supabase.storage
      .from('receipts')
      .list('push-subscriptions');

    if (!files || files.length === 0) return;

    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;
      const userId = file.name.replace('.json', '');

      try {
        const { data: fileData } = await supabase.storage
          .from('receipts')
          .download(`push-subscriptions/${file.name}`);
        if (!fileData) continue;

        const text = await fileData.text();
        const userFile: UserSubscriptionFile = JSON.parse(text);

        if (userFile && userFile.role === targetRole) {
          await sendPushToUser(userId, payload);
        }
      } catch {}
    }
  } catch (err) {
    console.error(`Error sending push to role ${targetRole}:`, err);
  }
}
