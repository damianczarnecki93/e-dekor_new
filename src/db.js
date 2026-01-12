import { openDB } from 'idb';

const DB_NAME = 'e-dekor-pwa-db';
const DB_VERSION = 1;
const OUTBOX_STORE_NAME = 'offline-orders-outbox';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(OUTBOX_STORE_NAME)) {
      db.createObjectStore(OUTBOX_STORE_NAME, { keyPath: 'id', autoIncrement: true });
    }
  },
});

export async function putInOutbox(order) {
  const db = await dbPromise;
  // Dodajemy unikalne ID dla zamówienia offline
  const orderWithId = { ...order, id: `offline_${Date.now()}` };
  return db.put(OUTBOX_STORE_NAME, orderWithId);
}

export async function getAllFromOutbox() {
  const db = await dbPromise;
  return db.getAll(OUTBOX_STORE_NAME);
}

export async function deleteFromOutbox(id) {
  const db = await dbPromise;
  return db.delete(OUTBOX_STORE_NAME, id);
}