/* eslint-disable no-restricted-globals */

console.log('Service Worker loading...');

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  // Skip waiting to force activation of the new service worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  // Take control of all clients immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Do nothing for fetch events for now
});

self.addEventListener('push', event => {
  console.log('Push event received.');
  const data = event.data ? event.data.json() : { title: 'Default Title', body: 'Default Body' };
  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/logo.png'
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
