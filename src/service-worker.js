/* eslint-disable no-restricted-globals */

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';

// This is a required placeholder for the Create React App build process.
// It will be replaced with the list of files to precache.
precacheAndRoute(self.__WB_MANIFEST);

// Claim clients immediately so the latest service worker takes control.
clientsClaim();

// Set up App Shell-style routing, so that all navigation requests
// are fulfilled with '/index.html' (the shell).
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  ({ request, url }) => {
    if (request.mode !== 'navigate') {
      return false;
    }
    if (url.pathname.startsWith('/_')) {
      return false;
    }
    if (url.pathname.match(fileExtensionRegexp)) {
      return false;
    }
    return true;
  },
  createHandlerBoundToURL('/index.html')
);

// Caching strategy for images: Cache First.
// Images are served from the cache first, falling back to the network.
// The cache is limited to 50 entries and a 30-day expiration.
registerRoute(
  ({ url }) => url.origin === self.location.origin && /\.(jpe?g|png|svg|ico)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30 Days
    ],
  })
);

// Caching strategy for API GET requests: Stale While Revalidate.
// This strategy provides a fast response from the cache while updating
// the cache in the background with a fresh response from the network.
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 1 Day
      }),
    ],
  })
);

// Event listener for push notifications.
self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/logo.png',
    badge: '/logo.png',
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
