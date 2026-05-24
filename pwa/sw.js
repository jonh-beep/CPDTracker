// CPD Tracker Service Worker
const CACHE_NAME = 'cpd-tracker-v3';
const CACHE_URLS = [
  '/CPDTracker/',
  '/CPDTracker/index.html',
  '/CPDTracker/manifest.json',
  '/CPDTracker/icon-180.png',
  '/CPDTracker/icon-192.png',
  '/CPDTracker/icon-512.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // Only cache same-origin requests (the wrapper files)
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request);
      })
    );
  }
});
