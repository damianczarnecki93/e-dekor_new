import { db } from '../db';
import { api } from '../api';

/**
 * Synchronizuje dane z serwera do lokalnej bazy danych Dexie.
 * Pobiera dane w partiach i raportuje szczegółowy postęp.
 * @param {function} onProgress - Callback do raportowania postępu (np. (statusObject) => {}).
 */
export async function synchronizeData(onProgress) {
  if (!navigator.onLine) {
    console.warn('Synchronizacja pominięta - brak połączenia internetowego.');
    return false;
  }

  console.log('Rozpoczęcie synchronizacji danych...');
  onProgress({ status: 'starting_all' });

  try {
    // Nie czyścimy tabel przed synchronizacją, aby dane były dostępne nawet przy błędzie.
    // bulkPut() w synchronizeTable zajmie się aktualizacją/dodaniem rekordów.

    // Synchronizacja produktów
    await synchronizeTable('products', api.getProductsCount, api.getProductsPage, onProgress);

    // Synchronizacja kontaktów
    await synchronizeTable('contacts', api.getContactsCount, api.getContactsPage, onProgress);

    onProgress({ status: 'finished_all' });
    console.log('Synchronizacja danych zakończona pomyślnie.');
    return true;
  } catch (error) {
    console.error('Błąd podczas synchronizacji danych:', error);
    onProgress({ status: 'failed', error: error.message });
    return false;
  }
}

/**
 * Generyczna funkcja do synchronizacji jednej tabeli.
 */
async function synchronizeTable(tableName, countApiFn, pageApiFn, onProgress) {
  try {
    console.log(`Synchronizacja tabeli: ${tableName}`);
    onProgress({ status: 'fetching_count', table: tableName });
    const { total: count } = await countApiFn(); // API zwraca { total: ... }
    const limit = 1000;
    const totalPages = Math.ceil(count / limit);
    let loadedCount = 0;

    for (let page = 1; page <= totalPages; page++) {
      const response = await pageApiFn(page, limit);
      // Data is wrapped in an object, e.g., { products: [...] }
      const data = response[tableName];
      if (data && data.length > 0) {
        await db[tableName].bulkPut(data);
        loadedCount += data.length;
      }
      onProgress({ status: 'downloading', table: tableName, loaded: loadedCount, total: count });
    }

    await db.syncStatus.put({ tableName, lastSync: new Date() });
    onProgress({ status: 'completed', table: tableName });
    console.log(`Tabela ${tableName} zsynchronizowana.`);
  } catch (error) {
    console.error(`Błąd podczas synchronizacji tabeli ${tableName}:`, error);
    throw error;
  }
}
