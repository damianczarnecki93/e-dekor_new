import { api } from './api';

/**
 * Konwertuje klucz publiczny VAPID z base64 na Uint8Array.
 * Jest to wymagane przez API przeglądarki.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Prosi użytkownika o zgodę i subskrybuje go do powiadomień push.
 */
export async function subscribeUser() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Powiadomienia push nie są wspierane w tej przeglądarce.');
  }

  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker timeout')), 5000));
  const registration = await Promise.race([navigator.serviceWorker.ready, timeout]);

  let subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    console.log('Użytkownik jest już zasubskrybowany. Synchronizuję subskrypcję z serwerem...');
  } else {
    console.log('Użytkownik nie jest zasubskrybowany. Prośba o nową subskrypcję...');

  try {
    const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
        throw new Error("REACT_APP_VAPID_PUBLIC_KEY is not defined");
    }
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    });
  }

  console.log('Zapisywanie subskrypcji na serwerze...');
  await api.subscribeToPush(subscription);
  console.log('Subskrypcja zapisana pomyślnie.');

  } catch (error) {
    console.error('Nie udało się zasubskrybować użytkownika: ', error);
  }
}
