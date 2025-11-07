import { db } from '../db';
import { api } from '../api';

// ... (searchProducts i searchContacts bez zmian)

export async function searchProducts(searchTerm, filterByQuantity = false) {
    let results = [];
    try {
        const searchRegex = new RegExp(searchTerm, 'i');
        let collection = db.products.where('name').startsWithIgnoreCase(searchTerm)
                                  .or('product_code').startsWithIgnoreCase(searchTerm)
                                  .or('barcodes').equals(searchTerm);

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

        // Jeśli lokalnie nic nie znaleziono, zawsze próbuj przez sieć.
        // Service worker obsłuży to w trybie offline.
        if (results.length === 0) {
            try {
                console.log("Nie znaleziono lokalnie, próba przez API/Service Worker...");
                return await api.searchProducts(searchTerm, filterByQuantity);
            } catch (apiError) {
                console.warn("Błąd API podczas wyszukiwania produktów, zwracam puste wyniki.", apiError);
                return [];
            }
        }

        return results;
    } catch (error) {
        console.error("Błąd wyszukiwania w repozytorium:", error);
        // Po błędzie lokalnym, zawsze próbuj przez API/SW
        try {
            return await api.searchProducts(searchTerm, filterByQuantity);
        } catch (apiError) {
            console.warn("Błąd API po błędzie repozytorium, zwracam puste wyniki.", apiError);
            return [];
        }
    }
}

export async function searchContacts(term) {
    let results = [];
    try {
        if (!term) return [];
        const searchRegex = new RegExp(term, 'i');
        results = await db.contacts
            .filter(contact => searchRegex.test(contact.name) || searchRegex.test(contact.company))
            .limit(10)
            .toArray();

        if (results.length === 0) {
            try {
                console.log("Nie znaleziono lokalnie, próba przez API/Service Worker...");
                return await api.searchContacts(term);
            } catch (apiError) {
                console.warn("Błąd API podczas wyszukiwania kontaktów, zwracam puste wyniki.", apiError);
                return [];
            }
        }

        return results;
    } catch (error) {
        console.error("Błąd wyszukiwania kontaktów w repozytorium:", error);
        try {
            return await api.searchContacts(term);
        } catch (apiError) {
            console.warn("Błąd API po błędzie repozytorium, zwracam puste wyniki.", apiError);
            return [];
        }
    }
}

/**
 * Zapisuje zamówienie, stosując strategię "offline-first".
 */
export async function saveOrderOfflineFirst(order, user) {
    const orderToSave = {
        ...order,
        author: user.username,
        statusSync: 'pending_sync',
        updatedAt: new Date()
    };

    // Zawsze zapisuj/aktualizuj w lokalnej bazie
    const localId = await db.orders.put(orderToSave);
    orderToSave.localId = localId;

    // Jeśli jesteśmy online, od razu spróbuj wysłać
    if (navigator.onLine) {
        try {
            const { order: savedOrder } = await api.saveOrder(orderToSave);
            await db.orders.update(localId, {
                _id: savedOrder._id,
                statusSync: 'synced',
                items: savedOrder.items
            });
            return { ...savedOrder, localId };
        } catch (error) {
            console.warn('Nie udało się zapisać zamówienia na serwerze, zostanie zsynchronizowane później.', error.message);
            // Zwracamy wersję lokalną, synchronizacja nastąpi później
            return orderToSave;
        }
    }

    // Jeśli jesteśmy offline, po prostu zwróć wersję lokalną
    return orderToSave;
}


/**
 * Synchronizuje wszystkie zamówienia oczekujące na wysłanie.
 */
export async function syncPendingOrders() {
    const pendingOrders = await db.orders.where('statusSync').equals('pending_sync').toArray();
    if (pendingOrders.length === 0) {
        return;
    }

    console.log(`Znaleziono ${pendingOrders.length} zamówień do synchronizacji.`);

    for (const order of pendingOrders) {
        try {
            const { order: savedOrder } = await api.saveOrder(order);
            await db.orders.update(order.localId, {
                _id: savedOrder._id,
                statusSync: 'synced',
                items: savedOrder.items
            });
            console.log(`Zamówienie ${order.localId} zsynchronizowane.`);
        } catch (error) {
            console.error(`Nie udało się zsynchronizować zamówienia ${order.localId}:`, error);
            // Nie przerywamy pętli, próbujemy zsynchronizować kolejne
        }
    }
}
