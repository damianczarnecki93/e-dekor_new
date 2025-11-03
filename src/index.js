import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppWrapper from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);

// Rejestrujemy nasz niestandardowy service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log('Attempting to register service worker...');
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered successfully with scope:', registration.scope);

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            console.log('A new service worker is being installed:', installingWorker);
            installingWorker.onstatechange = () => {
              console.log(`Service worker state changed to: ${installingWorker.state}`);
            };
          }
        };
      })
      .catch(registrationError => {
        console.error('Service Worker registration failed:', registrationError);
        if (registrationError instanceof TypeError) {
          console.error('This might be due to a content security policy (CSP) or network error.');
        } else if (registrationError instanceof DOMException) {
          console.error(`DOMException: ${registrationError.name} - ${registrationError.message}. This could be due to an insecure origin (non-HTTPS) or invalid script.`);
        }
      });
  });
} else {
  console.warn('Service Worker is not supported by this browser.');
}
