import Dexie from 'dexie';

export const db = new Dexie('EdekorPWA');

db.version(1).stores({
  products: '&_id, name, product_code, *barcodes', // Klucz główny to _id, indeksujemy name, product_code i barcodes (multi-entry)
  contacts: '&_id, name, company', // Klucz główny to _id, indeksujemy name i company
  syncStatus: 'tableName' // Tabela do przechowywania informacji o ostatniej synchronizacji dla każdej z tabel
});