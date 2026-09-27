/* Jodi Sync Service Worker - Offline, PWA Caching & Instant Auto-Update */
const CACHE_NAME = 'jodi-v5.0-robust-net';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/style.css',
  './js/words.js',
  './js/two-minds.js',
  './js/audio.js',
  './js/network.js',
  './js/race-audio.js',
  './js/race-track.js',
  './js/race-models.js',
  './js/race.js',
  './js/scribble.js',
  './js/two-minds-ui.js',
  './js/tictactoe.js',
  './js/tictactoe-fx.js',
  './js/tictactoe-ui.js',
  './js/reaction-duel.js',
  './js/reaction-duel-fx.js',
  './js/reaction-duel-ui.js',
  './js/rps-battle.js',
  './js/rps-battle-fx.js',
  './js/rps-battle-ui.js',
  './js/solo-arcade.js',
  './js/lobby.js',
  './js/modals.js',
  './js/app.js',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Network first strategy: always get latest code, fall back to cache when offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          var responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
