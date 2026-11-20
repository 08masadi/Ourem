'use client';

import React, { useEffect, useState } from 'react';
import { subscribeToPushNotifications } from '@/actions/requests';
import { Bell, BellRing, CheckCircle2, X } from 'lucide-react';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BFjdw5B__5724ShiRwAyNrzhp_B0Ob0UAtD9YZJQ5QYvoZvC7KmaNUTVZNR3F4AzNUZTLWi88SB-nDtC2e_2aHk';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationSubscriber() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Periksa dukungan Service Worker & Notification API
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }

    const currentPerm = Notification.permission;
    setPermission(currentPerm);

    // Daftarkan service worker
    navigator.serviceWorker
      .register('/sw.js')
      .then(async (registration) => {
        // Jika izin sudah diberikan sebelumnya, pastikan subscription terdaftar dan terupdate di server
        if (currentPerm === 'granted') {
          try {
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
              const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey,
              });
            }
            if (subscription) {
              await subscribeToPushNotifications(subscription.toJSON(), navigator.userAgent);
            }
          } catch (err) {
            console.error('Push subscription sync error:', err);
          }
        } else if (currentPerm === 'default') {
          // Cek apakah user pernah menutup prompt dalam 1 hari terakhir
          const dismissed = localStorage.getItem('ourem_push_prompt_dismissed');
          if (!dismissed || Date.now() - Number(dismissed) > 24 * 60 * 60 * 1000) {
            // Tampilkan banner ramah untuk mengaktifkan notifikasi
            setShowPrompt(true);
          }
        }
      })
      .catch((err) => {
        console.error('Service worker registration failed:', err);
      });
  }, []);

  const handleEnablePush = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    try {
      setIsSubscribing(true);
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey,
          });
        }

        if (subscription) {
          await subscribeToPushNotifications(subscription.toJSON(), navigator.userAgent);
        }

        setShowPrompt(false);
        setSuccessToast(true);

        // Uji coba notifikasi selamat datang langsung di HP
        try {
          await registration.showNotification('Notifikasi Ourem Aktif 🔔', {
            body: 'Notifikasi siap berbunyi di layar kunci (lockscreen) & saat aplikasi berada di latar belakang.',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            vibrate: [250, 100, 250, 100, 250],
            tag: 'ourem-welcome',
          } as any);
        } catch {}

        setTimeout(() => setSuccessToast(false), 4500);
      } else {
        setShowPrompt(false);
      }
    } catch (err) {
      console.error('Error enabling push notification:', err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    try {
      localStorage.setItem('ourem_push_prompt_dismissed', Date.now().toString());
    } catch {}
  };

  if (permission === 'unsupported' || permission === 'denied') {
    return null;
  }

  return (
    <>
      {/* Toast Sukses Notifikasi Aktif */}
      {successToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-md bg-emerald-950/95 border border-emerald-500/50 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white">Notifikasi Android Aktif!</p>
            <p className="text-[11px] text-emerald-200/90 leading-tight">
              Pemberitahuan klaim & pencairan akan masuk ke lockscreen Anda.
            </p>
          </div>
        </div>
      )}

      {/* Banner / Floating Card Aktifkan Notifikasi Android (hanya jika belum diizinkan) */}
      {showPrompt && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[94%] max-w-md bg-slate-900/95 border border-orange-500/40 backdrop-blur-md rounded-2xl p-4 shadow-2xl shadow-orange-950/40 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
              <BellRing className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Aktifkan Notifikasi HP</span>
                </h4>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                  aria-label="Tutup"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug mt-1">
                Dapatkan pemberitahuan otomatis saat berada di luar aplikasi, layar terkunci (lockscreen), atau HP dalam keadaan sleep.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={isSubscribing}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-md shadow-orange-900/30 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{isSubscribing ? 'Mengaktifkan...' : 'Aktifkan Notifikasi'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  Nanti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
