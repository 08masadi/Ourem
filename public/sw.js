// Ourem Gen 2 - Service Worker for Android PWA Background & Lockscreen Push Notifications
const CACHE_NAME = 'ourem-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listener untuk Push Notification dari server (berfungsi saat sleep, lockscreen, atau app ditutup)
self.addEventListener('push', (event) => {
  let data = {
    title: 'Notifikasi Ourem',
    body: 'Ada pembaruan status pengajuan di Ourem.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    url: '/',
    tag: 'ourem-notification',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || `ourem-${Date.now()}`,
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
    },
    // Pengaturan penting untuk Android & Layar Kunci / Sleep:
    vibrate: [250, 100, 250, 100, 250],
    requireInteraction: true, // Notifikasi tidak langsung hilang di status bar/lockscreen
    renotify: true,
    silent: false,
    actions: [
      {
        action: 'open',
        title: 'Lihat Detail',
      },
      {
        action: 'close',
        title: 'Tutup',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// Listener saat notifikasi disentuh/diklik di layar HP Android (lockscreen maupun status bar)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Jika ada tab/window Ourem yang sudah terbuka, fokuskan dan navigasikan
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            if ('navigate' in client) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        // Jika belum ada yang terbuka, buka jendela baru
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// Listener pesan langsung dari foreground/background client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [250, 100, 250, 100, 250],
      requireInteraction: true,
      renotify: true,
      ...options,
    });
  }
});
