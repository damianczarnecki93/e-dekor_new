import { openDB } from 'idb';

const DB_NAME = 'pwa-orders-db';
const DB_VERSION = 1;
const STORE_NAME = 'outbox';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    }
  },
});

export const getDb = async () => {
  return await dbPromise;
};

export const addToOutbox = async (item) => {
  const db = await dbPromise;
  // Upewnijmy się, że każdy dodawany obiekt ma unikalny tymczasowy ID
  const itemToStore = { ...item, id: `offline_${Date.now()}` };
  await db.add(STORE_NAME, itemToStore);
  return itemToStore;
};

export const getAllFromOutbox = async () => {
  const db = await dbPromise;
  return await db.getAll(STORE_NAME);
};

export const deleteFromOutbox = async (id) => {
  const db = await dbPromise;
  await db.delete(STORE_NAME, id);
};

export const clearOutbox = async () => {
    const db = await dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.objectStore(STORE_NAME).clear();
    await tx.done;
};