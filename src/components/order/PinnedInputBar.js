import React, { useState, useEffect, useRef } from 'react';
import { Save } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';
import CustomProductForm from './CustomProductForm';

const PinnedInputBar = ({ onProductAdd, onSave, isDirty, currentItems }) => {
    const [query, setQuery] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { showNotification } = useNotification();
    const inputRef = useRef(null);
    const [customProductModal, setCustomProductModal] = useState({ isOpen: false, ean: '' });

    useEffect(() => {
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }
        const handler = setTimeout(async () => {
            setIsLoading(true);
            try {
                const results = await api.searchProducts(query);
                const isBarcode = /^\d{8,}$/.test(query.trim());

                if (isBarcode) {
                    if (results.length > 0) {
                        onProductAdd(results[0], 1);
                        setQuery('');
                        setQuantity(1);
                        setSuggestions([]);
                        inputRef.current?.focus();
                    } else {
                        const existingCustomItem = currentItems.find(item => item.barcodes && item.barcodes.includes(query.trim()));
                        if (existingCustomItem) {
                            onProductAdd(existingCustomItem, 1);
                            setQuery('');
                            setQuantity(1);
                            inputRef.current?.focus();
                        } else {
                            setCustomProductModal({ isOpen: true, ean: query.trim() });
                        }
                        setSuggestions([]);
                    }
                } else {
                    setSuggestions(results);
                }
            } catch (error) {
                showNotification(error.message, 'error');
            } finally {
                setIsLoading(false);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [query, showNotification, onProductAdd]);

    const handleAdd = (product) => {
        const qty = Number(quantity);
        if (isNaN(qty) || qty <= 0) {
            showNotification('Wprowadź poprawną ilość.', 'error');
            return;
        }
        onProductAdd(product, qty);
        setSuggestions([]);
        setQuery('');
        setQuantity(1);
        inputRef.current?.focus();
    };

	 const handleQueryChange = (e) => {
        const value = e.target.value;
        setQuery(value);
    };

    const handleKeyDown = async (e) => {
        if (e.key === 'Enter' && query.trim() !== '') {
            e.preventDefault();
            setIsLoading(true);
            setSuggestions([]); // Hide suggestions while processing
            try {
                const results = await api.searchProducts(query.trim());
                if (results.length > 0) {
                    onProductAdd(results[0], 1); // Add first match with quantity 1
                    setQuery(''); // Clear input for next scan
                    setQuantity(1); // Reset quantity field
                    inputRef.current?.focus();
                } else {
                    // No product found, open modal to add custom product
                    setCustomProductModal({ isOpen: true, ean: query.trim() });
                }
            } catch (error) {
                showNotification(error.message, 'error');
                setQuery(''); // Clear input on error
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleCustomSubmit = ({ name, price }) => {
        const customItem = {
            _id: `custom-${Date.now()}`,
            name: name,
            product_code: customProductModal.ean,
            barcodes: [customProductModal.ean],
            price: price,
            isCustom: true,
        };
        onProductAdd(customItem, 1);
        setCustomProductModal({ isOpen: false, ean: '' });
        setQuery('');
        inputRef.current?.focus();
    };

    const handleCustomSkip = () => {
        const customItem = {
            _id: `custom-${Date.now()}`,
            name: 'produkt spoza listy',
            product_code: customProductModal.ean,
            barcodes: [customProductModal.ean],
            price: 0,
            isCustom: true,
        };
        onProductAdd(customItem, 1);
        setCustomProductModal({ isOpen: false, ean: '' });
        setQuery('');
        inputRef.current?.focus();
    };

    return (
        <>
            <div className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-top z-20 p-4 w-full">
                <div className="relative w-full px-2">
                    {suggestions.length > 0 && (
                        <ul className="absolute bottom-full left-2 right-2 mb-2 bg-white dark:bg-gray-700 border rounded-lg shadow-xl max-h-60 overflow-y-auto z-30">
                            {suggestions.map(p => (
                                <li key={p._id} onClick={() => handleAdd(p)} className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-b last:border-b-0">
                                    <p className="font-semibold">{p.name}</p>
                                    <p className="text-sm text-gray-500">{p.product_code}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="flex items-center gap-2 sm:gap-4 w-full">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={handleQueryChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Wyszukaj lub zeskanuj produkt..."
                            className="w-full p-3 bg-gray-100 dark:bg-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                            type="number"
                            value={quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setQuantity(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-16 sm:w-24 p-3 text-center bg-gray-100 dark:bg-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {onSave && (
                            <button onClick={onSave} className="flex items-center justify-center px-3 sm:px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400" disabled={!isDirty}>
                                <Save className="w-5 h-5"/>
                                <span className="hidden sm:inline ml-2">{isDirty ? 'Zapisz' : 'Zapisano'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <Modal
                isOpen={customProductModal.isOpen}
                onClose={() => {
                    setCustomProductModal({ isOpen: false, ean: '' });
                    setQuery('');
                    inputRef.current?.focus();
                }}
                title="Dodaj produkt spoza listy"
            >
                <CustomProductForm
                    ean={customProductModal.ean}
                    onSubmit={handleCustomSubmit}
                    onSkip={handleCustomSkip}
                />
            </Modal>
        </>
    );
};

export default PinnedInputBar;