// A minimalist, build-compliant service worker for diagnostic purposes.
import { precacheAndRoute } from 'workbox-precaching';

console.log('Build-compliant minimal service worker script loaded.');

self.addEventListener('install', event => {
  console.log('Build-compliant SW: Install event received.');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Build-compliant SW: Activate event received.');
  event.waitUntil(self.clients.claim());
});

// This line is required by the Create React App build process.
precacheAndRoute(self.__WB_MANIFEST);
