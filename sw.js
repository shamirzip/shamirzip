const CACHE_NAME = 'secret-sharing-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.js',
  '/lib/secrets/secrets.js',
  '/lib/qrcode/qrcode.min.js',
  '/lib/pako/pako.js',
  '/lib/bech32/bech32-browser.js',
  '/lib/bootstrap/css/bootstrap.min.css',
  '/lib/bootstrap/js/bootstrap.bundle.min.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
