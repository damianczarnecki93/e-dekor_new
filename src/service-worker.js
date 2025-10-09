// Service Worker "Kamikadze"
// Jego jedynym celem jest wyrejestrowanie samego siebie i odświeżenie strony.

import { precacheAndRoute } from 'workbox-precaching';

// Ta linijka jest wymagana przez workbox-cli w trybie injectManifest.
// Zostanie ona wypełniona listą plików do buforowania, ale nie wpłynie
// na naszą główną logikę samounicestwienia w sekcji 'activate'.
precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('install', (event) => {
  // Wymusza natychmiastową aktywację nowego service workera.
  self.skipWaiting();
  console.log('SW Kamikadze: Instalacja...');
});

self.addEventListener('activate', (event) => {
  console.log('SW Kamikadze: Aktywacja i samounicestwienie...');

  // Wyrejestrowuje samego siebie.
  self.registration.unregister()
    .then(() => {
      console.log('SW Kamikadze: Pomyślnie wyrejestrowano.');
      // Przejmuje kontrolę nad wszystkimi otwartymi klientami (zakładkami).
      return self.clients.matchAll();
    })
    .then((clients) => {
      console.log('SW Kamikadze: Odświeżanie klientów...');
      // Odświeża każdego klienta, aby zmusić go do załadowania strony bez service workera.
      clients.forEach((client) => client.navigate(client.url));
    })
    .catch((error) => {
      console.error('SW Kamikadze: Błąd podczas samounicestwienia:', error);
    });
});