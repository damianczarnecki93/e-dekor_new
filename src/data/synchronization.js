import { db } from '../db';
import { api } from '../api';

/**
 * Synchronizuje dane z serwera do lokalnej bazy danych Dexie.
 * Pobiera dane w partiach, aby nie obciążać przeglądarki.
 * @param {function} onProgress - Callback do raportowania postępu (np. (tableName, progress) => {}).
 */
export async function synchronizeData(onProgress) {
  console.log('Rozpoczęcie synchronizacji danych...');

  try {
    // Synchronizacja produktów
    await synchronizeTable('products', api.getProductsCount, api.getProductsPage, onProgress);

    // Synchronizacja kontaktów
    await synchronizeTable('contacts', api.getContactsCount, api.getContactsPage, onProgress);

    console.log('Synchronizacja danych zakończona pomyślnie.');
    return true;
  } catch (error) {
    console.error('Błąd podczas synchronizacji danych:', error);
    return false;
  }
}

/**
 * Generyczna funkcja do synchronizacji jednej tabeli.
 */
async function synchronizeTable(tableName, countApiFn, pageApiFn, onProgress) {
  try {
    console.log(`Synchronizacja tabeli: ${tableName}`);
    const { count } = await countApiFn();
    const limit = 1000; // Pobieramy po 1000 rekordów na raz
    const totalPages = Math.ceil(count / limit);

    if (onProgress) onProgress(tableName, 0);

    for (let page = 1; page <= totalPages; page++) {
      const data = await pageApiFn(page, limit);
      if (data && data.length > 0) {
        await db[tableName].bulkPut(data);
      }
      const progress = Math.round((page / totalPages) * 100);
      if (onProgress) onProgress(tableName, progress);
    }

    // Zapisz czas ostatniej synchronizacji
    await db.syncStatus.put({ tableName, lastSync: new Date() });
    console.log(`Tabela ${tableName} zsynchronizowana.`);
  } catch (error) {
    console.error(`Błąd podczas synchronizacji tabeli ${tableName}:`, error);
    throw error; // Rzuć błąd dalej, aby główna funkcja mogła go obsłużyć
  }
}
