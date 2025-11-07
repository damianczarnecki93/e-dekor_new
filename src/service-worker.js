// A minimalist service worker for diagnostic purposes.

self.addEventListener('install', event => {
  console.log('Minimal Service Worker: Install event received.');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Minimal Service Worker: Activate event received.');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  // This service worker doesn't handle fetch events.
  // We're only using it to test the registration process.
});

console.log('Minimal service worker script loaded.');
