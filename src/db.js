import { openDB } from 'idb';

const DB_NAME = 'pwa-orders-db';
const DB_VERSION = 1;
const STORE_NAME = 'outbox';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      // Używamy 'id' jako klucza, który będziemy dostarczać ręcznie
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  },
});

export const getDb = async () => {
  return await dbPromise;
};

/**
 * Dodaje lub aktualizuje zamówienie w skrzynce nadawczej (outbox).
 * Jeśli element nie ma ID lub ID nie jest w formacie offline, tworzy nowe.
 * W przeciwnym razie aktualizuje istniejący wpis.
 */
export const putInOutbox = async (item) => {
  const db = await dbPromise;
  // Jeśli to nowe zamówienie offline, nadaj mu unikalne ID
  if (!item.id || !String(item.id).startsWith('offline_')) {
    const newItem = { ...item, id: `offline_${Date.now()}` };
    await db.put(STORE_NAME, newItem);
    return newItem;
  }
  // W przeciwnym razie, zaktualizuj istniejące
  await db.put(STORE_NAME, item);
  return item;
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