var CACHE_NAME = 'shibaki-cache-v2';
var urlsToCache = ['./index.html', './manifest.json', './template.js'];
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache) { return cache.addAll(urlsToCache); }));
});
self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request).catch(function() { return caches.match(event.request); }));
});
self.addEventListener('activate', function(event) {
  event.waitUntil(caches.keys().then(function(keys) { return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); })); }));
});
