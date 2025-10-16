import { db } from '../db';
import { api } from '../api';

/**
 * Wyszukuje produkty, preferując lokalną bazę danych.
 * W przypadku błędu lub braku danych, może (opcjonalnie) odwołać się do API.
 */
export async function searchProducts(searchTerm, filterByQuantity = false) {
    try {
        const searchRegex = new RegExp(searchTerm, 'i');
        let collection = db.products.where('name').equalsIgnoreCase(searchTerm)
                                  .or('product_code').equalsIgnoreCase(searchTerm)
                                  .or('barcodes').equalsIgnoreCase(searchTerm);

        if (filterByQuantity) {
            collection = collection.and(product => product.quantity > 0);
        }

        let results = await collection.limit(20).toArray();

        // Jeśli wyszukiwanie po indeksach nic nie dało, spróbuj regex na nazwie
        if (results.length === 0 && searchTerm.length > 2) {
             results = await db.products.filter(product => {
                const nameMatch = searchRegex.test(product.name);
                const quantityMatch = !filterByQuantity || product.quantity > 0;
                return nameMatch && quantityMatch;
            }).limit(20).toArray();
        }

        // Jeśli lokalnie nic nie znaleziono, spróbuj przez sieć
        if (results.length === 0) {
            console.log("Nie znaleziono lokalnie, próba przez API...");
            return await api.searchProducts(searchTerm, filterByQuantity);
        }

        return results;
    } catch (error) {
        console.error("Błąd wyszukiwania w repozytorium, powrót do API sieciowego:", error);
        return await api.searchProducts(searchTerm, filterByQuantity);
    }
}

/**
 * Wyszukuje kontakty, preferując lokalną bazę danych.
 */
export async function searchContacts(term) {
    try {
        if (!term) return [];
        const searchRegex = new RegExp(term, 'i');
        const results = await db.contacts
            .filter(contact => searchRegex.test(contact.name) || searchRegex.test(contact.company))
            .limit(10)
            .toArray();

        if (results.length === 0) {
            console.log("Nie znaleziono lokalnie, próba przez API...");
            return await api.searchContacts(term);
        }

        return results;
    } catch (error) {
        console.error("Błąd wyszukiwania kontaktów w repozytorium, powrót do API sieciowego:", error);
        return await api.searchContacts(term);
    }
}