/**
 * Service Worker for Physics MCQ Tracker PWA
 * Caches app shell for offline usage
 */

const CACHE_NAME = 'physics-tracker-v1';
const APP_SHELL = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './logo.png',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'
];

// Install: cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL);
        })
    );
    self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip Firebase/Google API requests — always fetch from network
    if (
        event.request.url.includes('firebaseio.com') ||
        event.request.url.includes('googleapis.com/google.firestore') ||
        event.request.url.includes('identitytoolkit.googleapis.com') ||
        event.request.url.includes('securetoken.googleapis.com')
    ) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // Cache new responses for CDN assets
                if (
                    networkResponse.ok &&
                    (event.request.url.includes('cdn.jsdelivr.net') ||
                     event.request.url.includes('gstatic.com/firebasejs'))
                ) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // If both cache and network fail, return cached index.html
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
