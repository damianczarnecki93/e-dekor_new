import React, { useState, useEffect, useRef } from 'react';
import { Save } from 'lucide-react';
import { api } from '../../api';
import { searchProducts } from '../../data/repository';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';
import CustomProductForm from './CustomProductForm';

const PinnedInputBar = ({ onProductAdd, onSave, isDirty, currentItems, totalValue, totalValueWithDiscount, discount, onDiscountChange }) => {
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
                const results = await searchProducts(query);
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
                const results = await searchProducts(query.trim());
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
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] z-40 p-4 px-6 md:px-12">
                <div className="w-full relative">
                    {suggestions.length > 0 && (
                        <ul className="absolute bottom-full mb-2 w-full md:max-w-xl bg-white dark:bg-gray-700 border rounded-lg shadow-xl max-h-60 overflow-y-auto z-30">
                            {suggestions.map(p => (
                                <li key={p._id} onClick={() => handleAdd(p)} className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-b last:border-b-0">
                                    <p className="font-semibold">{p.name}</p>
                                    <p className="text-sm text-gray-500">{p.product_code}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="flex items-center gap-2 sm:gap-4">
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
                            <div className="flex items-center gap-6">
                                <div className="hidden lg:flex items-center gap-4 border-r dark:border-gray-700 pr-6 mr-2">
                                    <div className="flex flex-col">
                                        <label htmlFor="pinned-discount" className="text-[10px] uppercase font-bold text-gray-400">Rabat (%)</label>
                                        <input
                                            id="pinned-discount"
                                            type="number"
                                            value={discount || '0'}
                                            onChange={onDiscountChange}
                                            onFocus={(e) => e.target.select()}
                                            className="w-16 p-1 text-center bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-md font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex flex-col items-end min-w-[120px]">
                                        {totalValue !== totalValueWithDiscount && (
                                            <span className="text-xs text-gray-400 line-through leading-tight">
                                                {totalValue?.toFixed(2)} PLN
                                            </span>
                                        )}
                                        <span className="text-xl font-bold text-indigo-600 leading-tight whitespace-nowrap">
                                            {totalValueWithDiscount?.toFixed(2)} PLN
                                        </span>
                                    </div>
                                </div>
                                <button onClick={onSave} className="flex items-center justify-center px-4 md:px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg disabled:bg-blue-400" disabled={!isDirty}>
                                    <Save className="w-5 h-5"/>
                                    <span className="hidden sm:inline ml-2 font-bold">{isDirty ? 'Zapisz Zamówienie' : 'Zapisano'}</span>
                                </button>
                            </div>
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