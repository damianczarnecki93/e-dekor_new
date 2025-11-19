import Dexie from 'dexie';

export const db = new Dexie('EdekorPWA');

// Definiujemy JEDEN, KOMPLETNY schemat dla najnowszej wersji bazy danych.
// Dexie.js automatycznie zajmie się migracją od starszych wersji.
// To rozwiązuje problem, gdzie kolejne wersje nadpisywały (usuwały)
// definicje tabel z poprzednich wersji.
db.version(4).stores({
  products: '&_id, name, product_code, *barcodes',
  contacts: '&_id, name, company',
  syncStatus: 'tableName',
  orders: '++localId, _id, status, statusSync'
});
