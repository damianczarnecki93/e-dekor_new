import { db } from '../db';
import { api } from '../api';

/**
 * Wyszukuje produkty, preferując lokalną bazę danych.
 * W przypadku błędu lub braku danych, może (opcjonalnie) odwołać się do API.
 */
export async function searchProducts(searchTerm, filterByQuantity = false) {
    let results = [];
    try {
        const searchRegex = new RegExp(searchTerm, 'i');
        let collection = db.products.where('name').equalsIgnoreCase(searchTerm)
                                  .or('product_code').equalsIgnoreCase(searchTerm)
                                  .or('barcodes').equalsIgnoreCase(searchTerm);

        if (filterByQuantity) {
            collection = collection.and(product => product.quantity > 0);
        }

        results = await collection.limit(20).toArray();

        // Jeśli wyszukiwanie po indeksach nic nie dało, spróbuj regex na nazwie
        if (results.length === 0 && searchTerm.length > 2) {
             results = await db.products.filter(product => {
                const nameMatch = searchRegex.test(product.name);
                const quantityMatch = !filterByQuantity || product.quantity > 0;
                return nameMatch && quantityMatch;
            }).limit(20).toArray();
        }

        // Jeśli lokalnie nic nie znaleziono, spróbuj przez sieć (tylko jeśli online)
        if (results.length === 0 && navigator.onLine) {
            try {
                console.log("Nie znaleziono lokalnie, próba przez API...");
                return await api.searchProducts(searchTerm, filterByQuantity);
            } catch (apiError) {
                console.warn("Błąd API podczas wyszukiwania produktów, zwracam puste wyniki.", apiError);
                return [];
            }
        }

        return results;
    } catch (error) {
        console.error("Błąd wyszukiwania w repozytorium:", error);
        // W przypadku błędu (np. offline), spróbuj mimo wszystko odwołać się do API,
        // ale obsłuż błąd sieciowy.
        if (navigator.onLine) {
            try {
                return await api.searchProducts(searchTerm, filterByQuantity);
            } catch (apiError) {
                console.warn("Błąd API po błędzie repozytorium, zwracam puste wyniki.", apiError);
            }
        }
        // Jeśli jesteśmy offline lub API zawiodło, zwróć puste wyniki
        return [];
    }
}

/**
 * Wyszukuje kontakty, preferując lokalną bazę danych.
 */
export async function searchContacts(term) {
    let results = [];
    try {
        if (!term) return [];
        const searchRegex = new RegExp(term, 'i');
        results = await db.contacts
            .filter(contact => searchRegex.test(contact.name) || searchRegex.test(contact.company))
            .limit(10)
            .toArray();

        if (results.length === 0 && navigator.onLine) {
            try {
                console.log("Nie znaleziono lokalnie, próba przez API...");
                return await api.searchContacts(term);
            } catch (apiError) {
                console.warn("Błąd API podczas wyszukiwania kontaktów, zwracam puste wyniki.", apiError);
                return [];
            }
        }

        return results;
    } catch (error) {
        console.error("Błąd wyszukiwania kontaktów w repozytorium:", error);
        if (navigator.onLine) {
            try {
                return await api.searchContacts(term);
            } catch (apiError) {
                console.warn("Błąd API po błędzie repozytorium, zwracam puste wyniki.", apiError);
            }
        }
        return [];
    }
}


/**
 * Zapisuje zamówienie, stosując strategię "offline-first".
 * Najpierw zapisuje w lokalnej bazie, a potem próbuje wysłać na serwer.
 */
export async function saveOrderOfflineFirst(order, user) {
    // Przygotuj obiekt zamówienia do zapisu
    const orderToSave = {
        ...order,
        author: user.username,
        statusSync: 'pending_sync', // Dodajemy status synchronizacji
        updatedAt: new Date()
    };

    // Jeśli zamówienie nie ma lokalnego ID, to znaczy, że jest nowe.
    if (!orderToSave.localId) {
        // Zapisz w lokalnej bazie i uzyskaj lokalne ID
        const localId = await db.orders.put(orderToSave);
        orderToSave.localId = localId;
    } else {
        // Zaktualizuj istniejące zamówienie w lokalnej bazie
        await db.orders.put(orderToSave);
    }

    try {
        // Spróbuj wysłać na serwer
        const { order: savedOrder } = await api.saveOrder(orderToSave);

        // Jeśli się udało, zaktualizuj lokalne zamówienie o ID z serwera i status
        await db.orders.update(orderToSave.localId, {
            _id: savedOrder._id,
            statusSync: 'synced',
            items: savedOrder.items // Użyj itemów zwróconych z serwera
        });

        return { ...savedOrder, localId: orderToSave.localId };
    } catch (error) {
        // Jeśli wystąpił błąd sieciowy, service worker powinien przejąć żądanie.
        // Zwracamy zamówienie z lokalnym ID, aby UI mogło się zaktualizować.
        console.warn('Nie udało się zapisać zamówienia na serwerze, przechodzę w tryb offline.', error.message);
        return orderToSave;
    }
}
