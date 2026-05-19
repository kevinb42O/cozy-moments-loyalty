// Cozy Moments — Customer Service Worker
const CACHE_NAME = 'cozy-moments-customer-v3';
const OFFLINE_URL = '/';

// Assets to pre-cache
const PRE_CACHE = [
  '/',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// Install — cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET and cross-origin
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // For navigation requests, network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // For assets: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || fetched;
    })
  );
});

function parsePushPayload(event) {
  if (!event.data) {
    return {};
  }

  try {
    return event.data.json();
  } catch {
    return { title: 'Cozy Moments', body: event.data.text() };
  }
}

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event);
  const title = payload.title || 'Cozy Moments';
  const options = {
    body: payload.body || 'Er staat iets klaar in je Cozy spaarkaart.',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || payload.campaignId || 'cozy-moments',
    renotify: false,
    data: {
      campaignId: payload.campaignId || null,
      customerId: payload.customerId || null,
      deeplink: payload.deeplink || '/dashboard',
      trackingUrl: payload.trackingUrl || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

async function trackNotificationClick(data, openedPath) {
  if (!data?.trackingUrl || !data?.campaignId) {
    return;
  }

  try {
    await fetch(data.trackingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: data.campaignId,
        customerId: data.customerId,
        openedPath,
      }),
    });
  } catch {
    // Click tracking should never block opening the app.
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const deeplink = typeof data.deeplink === 'string' && data.deeplink.startsWith('/') ? data.deeplink : '/dashboard';
  const targetUrl = new URL(deeplink, self.location.origin).href;

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOriginClient = windowClients.find((client) => client.url.startsWith(self.location.origin));

    await trackNotificationClick(data, deeplink);

    if (sameOriginClient) {
      await sameOriginClient.focus();
      sameOriginClient.navigate(targetUrl);
      return;
    }

    await clients.openWindow(targetUrl);
  })());
});
