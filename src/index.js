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
async function unregisterAllServiceWorkers() {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length) {
        console.log(`Found ${registrations.length} service worker(s). Unregistering...`);
        for (const registration of registrations) {
          await registration.unregister();
          console.log(`Service worker for scope ${registration.scope} unregistered.`);
        }
      } else {
        console.log('No service workers found to unregister.');
      }
    } catch (error) {
      console.error('Error while unregistering service workers:', error);
    }
  }
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await unregisterAllServiceWorkers();
      console.log('Attempting to register a new service worker...');
      const registration = await navigator.serviceWorker.register('/service-worker.js');
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
    } catch (registrationError) {
      console.error('Service Worker registration failed:', registrationError);
      if (registrationError instanceof TypeError) {
        console.error('This might be due to a content security policy (CSP) or network error.');
      } else if (registrationError instanceof DOMException) {
        console.error(`DOMException: ${registrationError.name} - ${registrationError.message}. This could be due to an insecure origin (non-HTTPS) or invalid script.`);
      }
    }
  } else {
    console.warn('Service Worker is not supported by this browser.');
  }
}

registerServiceWorker();
