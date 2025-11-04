import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';

const SearchView = ({ onProductSelect }) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filterByQuantity, setFilterByQuantity] = useState(false);
    const { showNotification } = useNotification();
    const searchInputRef = useRef(null);

    const handleSearch = useCallback(async (searchQuery) => {
        setIsLoading(true);
        setSuggestions([]);
        try {
            const results = await api.searchProducts(searchQuery, filterByQuantity);
            const isEanLike = /^\d{8,13}$/.test(searchQuery.trim());

            if (isEanLike && results.length > 0) {
                const matchedProduct = results.find(p => p.barcodes.includes(searchQuery.trim()));
                if (matchedProduct) {
                    onProductSelect(matchedProduct);
                    setQuery('');
                    setIsLoading(false);
                    return;
                }
            }
            setSuggestions(results);

        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [filterByQuantity, onProductSelect, showNotification]);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (query.trim().length > 2) {
                handleSearch(query);
            } else {
                setSuggestions([]);
            }
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [query, handleSearch]);

    const handleSelectSuggestion = (product) => {
        onProductSelect(product);
        setQuery('');
        setSuggestions([]);
    };

    return (
        <div className="relative max-w-2xl mx-auto">
            <div className="flex items-center bg-white dark:bg-gray-700 rounded-full shadow-lg">
                <Search className="h-6 w-6 ml-4 text-gray-400" />
                <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Zeskanuj kod EAN lub wpisz nazwę produktu..."
                    className="w-full p-4 bg-transparent focus:outline-none text-gray-900 dark:text-white"
                />
            </div>
            <div className="flex items-center justify-center mt-4">
                <label className="flex items-center cursor-pointer">
                    <div className="relative">
                        <input type="checkbox" checked={filterByQuantity} onChange={() => setFilterByQuantity(!filterByQuantity)} className="sr-only" />
                        <div className="block bg-gray-200 dark:bg-gray-600 w-14 h-8 rounded-full"></div>
                        <div className={`absolute left-1 top-1 bg-white dark:bg-gray-400 w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${filterByQuantity ? 'transform translate-x-full bg-green-500' : ''}`}></div>
                    </div>
                    <div className="ml-3 text-gray-700 dark:text-gray-300 font-medium">Pokazuj z ilością > 0</div>
                </label>
            </div>
            {isLoading && <div className="absolute w-full mt-2 text-center text-gray-500">Szukam...</div>}
            {suggestions.length > 0 && (
                <ul className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl">
                    {suggestions.map(p => (
                        <li key={p._id} onClick={() => handleSelectSuggestion(p)} className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-b dark:border-gray-600 last:border-b-0">
                            <p className="font-semibold text-gray-800 dark:text-gray-100">{p.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{p.product_code}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SearchView;