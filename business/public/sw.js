// Cozy Moments — Business/Admin Service Worker
const CACHE_NAME = 'cozy-moments-admin-v6';
const RUNTIME_IMAGE_CACHE = 'cozy-moments-admin-screensaver-v1';
const OFFLINE_URL = '/';

function isSupabaseScreensaverAsset(url) {
  return url.pathname.includes('/storage/v1/object/public/screensaver-assets/');
}

// Assets to pre-cache
const PRE_CACHE = [
  '/',
  '/cozylogo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/cozy1.jpg',
  '/cozy2.png',
  '/cozy3.png',
  '/cozy4.webp',
  '/cozy5.png',
  '/cozy6.png',
  '/cozy7.png',
  '/cozy8.png',
  '/cozy9.png',
  '/cozy10.jpg',
  '/cozy11.jpg',
  '/cozy12.jpg',
  '/cozy13.jpg',
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
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  if (isSupabaseScreensaverAsset(requestUrl)) {
    event.respondWith(
      caches.open(RUNTIME_IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request, { ignoreSearch: false });
        const fetched = fetch(event.request).then((response) => {
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached);

        return cached || fetched;
      })
    );
    return;
  }

  if (!event.request.url.startsWith(self.location.origin)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Stale-while-revalidate for assets
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
