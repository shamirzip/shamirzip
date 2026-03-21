const CACHE_NAME = 'secret-sharing-v8';

// Get the base path from the service worker location
const getBasePath = () => {
  const swUrl = new URL(self.location.href);
  return swUrl.pathname.substring(0, swUrl.pathname.lastIndexOf('/') + 1);
};

const basePath = getBasePath();
const urlsToCache = [
  basePath,
  `${basePath}index.html`,
  `${basePath}manifest.json`,
  `${basePath}app.js`,
  `${basePath}icon-192.png`,
  `${basePath}icon-512.png`,
  `${basePath}lib/secrets/secrets.js`,
  `${basePath}lib/qrcode/qrcode.min.js`,
  `${basePath}lib/pako/pako.js`,
  `${basePath}lib/bech32/bech32-browser.js`,
  `${basePath}lib/jsqr/jsQR.js`,
  `${basePath}lib/bootstrap/css/bootstrap.min.css`,
  `${basePath}lib/bootstrap/js/bootstrap.bundle.min.js`
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
