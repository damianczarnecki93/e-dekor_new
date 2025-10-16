import { api } from './api';
import { db } from './db';

const BATCH_SIZE = 1000; // Pobieramy po 1000 rekordów na raz

/**
 * Synchronizuje jedną tabelę danych (np. produkty lub kontakty).
 * @param {string} tableName - Nazwa tabeli w IndexedDB ('products' lub 'contacts').
 * @param {function} countApiFn - Funkcja API do pobierania całkowitej liczby rekordów.
 * @param {function} dataApiFn - Funkcja API do pobierania spaginowanych danych.
 * @param {function} onProgress - Funkcja zwrotna do raportowania postępu.
 */
async function syncTable(tableName, countApiFn, dataApiFn, onProgress) {
  onProgress({ status: 'fetching_count', table: tableName });
  const { total } = await countApiFn();
  const totalPages = Math.ceil(total / BATCH_SIZE);

  onProgress({ status: 'starting', table: tableName, total });

  for (let page = 1; page <= totalPages; page++) {
    onProgress({ status: 'downloading', table: tableName, loaded: (page - 1) * BATCH_SIZE, total });
    const data = await dataApiFn(page, BATCH_SIZE);
    await db[tableName].bulkPut(data);
  }

  await db.syncStatus.put({ tableName, lastSync: new Date() });
  onProgress({ status: 'completed', table: tableName, total });
}

/**
 * Uruchamia pełny proces synchronizacji danych.
 * @param {function} onProgress - Funkcja zwrotna do raportowania ogólnego postępu.
 */
export async function runSynchronization(onProgress) {
  try {
    onProgress({ status: 'starting_all' });

    await syncTable('products', api.getProductsCount, api.getProductsPage, onProgress);
    await syncTable('contacts', api.getContactsCount, api.getContactsPage, onProgress);

    onProgress({ status: 'finished_all' });
    return { success: true };
  } catch (error) {
    console.error('Pełna synchronizacja nie powiodła się:', error);
    onProgress({ status: 'failed', error });
    return { success: false, error };
  }
}

export const getSyncInfo = (tableName) => db.syncStatus.get(tableName);