import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Info, Palette } from 'lucide-react';
import { searchProducts } from '../../data/repository';
import { useNotification } from '../../contexts/NotificationContext';
import ProductImage from '../common/ProductImage';
import ProductDetailsModal from '../common/ProductDetailsModal';
import FeltSelectionModal from '../modals/FeltSelectionModal';

const SearchView = ({ onProductSelect }) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filterByQuantity, setFilterByQuantity] = useState(false);
    const [modalProduct, setModalProduct] = useState(null);
    const [isFeltModalOpen, setIsFeltModalOpen] = useState(false);
    const { showNotification } = useNotification();
    const searchInputRef = useRef(null);

    const showFeltOption = query.toLowerCase().includes('filc');

    const handleSearch = useCallback(async (searchQuery) => {
        setIsLoading(true);
        setSuggestions([]);
        try {
            const results = await searchProducts(searchQuery, filterByQuantity);
            const isEanLike = /^\d{8,13}$/.test(searchQuery.trim());

            if (isEanLike && results.length > 0) {
                const matchedProduct = results.find(p => p.barcodes.includes(searchQuery.trim()));
                if (matchedProduct && onProductSelect) {
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
        if (onProductSelect) {
            onProductSelect(product);
        }
        setQuery('');
        setSuggestions([]);
    };

    const handleInfoClick = (e, product) => {
        e.stopPropagation();
        setModalProduct(product);
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
            {(suggestions.length > 0 || showFeltOption) && (
                <ul className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-80 overflow-y-auto divide-y dark:divide-gray-600">
                    {showFeltOption && (
                        <li
                            onClick={() => setIsFeltModalOpen(true)}
                            className="p-3 cursor-pointer bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 flex items-center justify-between gap-3"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 bg-indigo-600 text-white rounded-lg flex-shrink-0">
                                    <Palette className="w-5 h-5" />
                                </div>
                                <div className="truncate">
                                    <p className="font-bold text-indigo-900 dark:text-indigo-200 truncate">Otwórz paletę kolorów filców</p>
                                    <p className="text-xs text-indigo-600 dark:text-indigo-400">Podgląd palety kolorów i kodów filców</p>
                                </div>
                            </div>
                            <span className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-md font-semibold flex-shrink-0">Podgląd</span>
                        </li>
                    )}
                    {suggestions.map(p => (
                        <li
                            key={p._id}
                            onClick={() => handleSelectSuggestion(p)}
                            className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-between gap-3"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <ProductImage src={p.image} alt={p.name} className="w-10 h-10" iconSize={18} />
                                <div className="truncate">
                                    <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">{p.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{p.product_code}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => handleInfoClick(e, p)}
                                title="Szczegóły produktu"
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-500 flex-shrink-0"
                            >
                                <Info className="w-5 h-5" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <ProductDetailsModal
                product={modalProduct}
                isOpen={!!modalProduct}
                onClose={() => setModalProduct(null)}
            />

            <FeltSelectionModal
                isOpen={isFeltModalOpen}
                onClose={() => setIsFeltModalOpen(false)}
                readOnly={true}
            />
        </div>
    );
};

export default SearchView;
