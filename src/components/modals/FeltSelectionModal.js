import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { getFeltProductsWithDetails } from '../../data/feltColors';
import { ShoppingCart, Search } from 'lucide-react';

const FeltSelectionModal = ({ isOpen, onClose, onAddProducts, readOnly = false }) => {
    const [feltItems, setFeltItems] = useState([]);
    const [quantities, setQuantities] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [filterQuery, setFilterQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            setQuantities({});
            setFilterQuery('');
            getFeltProductsWithDetails()
                .then(items => {
                    setFeltItems(items);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [isOpen]);

    const handleQuantityChange = (code, val) => {
        const num = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
        setQuantities(prev => ({
            ...prev,
            [code]: num
        }));
    };

    const handleAddAll = () => {
        const toAdd = [];
        feltItems.forEach(item => {
            const qty = Number(quantities[item.code]);
            if (!isNaN(qty) && qty > 0) {
                toAdd.push({
                    product: item.product,
                    quantity: qty
                });
            }
        });

        if (toAdd.length > 0 && onAddProducts) {
            onAddProducts(toAdd);
        }
        onClose();
    };

    const filteredItems = feltItems.filter(item => {
        if (!filterQuery.trim()) return true;
        const q = filterQuery.toLowerCase();
        return (
            item.code.toLowerCase().includes(q) ||
            item.hex.toLowerCase().includes(q) ||
            (item.product.name && item.product.name.toLowerCase().includes(q))
        );
    });

    const totalSelectedCount = Object.values(quantities).reduce((acc, curr) => {
        const val = Number(curr);
        return acc + (!isNaN(val) && val > 0 ? val : 0);
    }, 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={readOnly ? 'Podgląd kolorów filców' : 'Wybór filcu'}
            maxWidth="4xl"
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2 border dark:border-gray-600 shadow-inner">
                    <Search className="w-5 h-5 text-gray-400 mr-2" />
                    <input
                        type="text"
                        value={filterQuery}
                        onChange={e => setFilterQuery(e.target.value)}
                        placeholder="Filtruj filce wg kodu lub nazwy..."
                        className="w-full bg-transparent focus:outline-none text-gray-900 dark:text-white"
                    />
                </div>

                {isLoading ? (
                    <div className="py-16 text-center text-gray-500 font-medium">Ładowanie palety filców...</div>
                ) : (
                    <div className="overflow-y-auto max-h-[60vh] p-1">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                            {filteredItems.map(item => {
                                const qty = Number(quantities[item.code]) || 0;
                                const isSelected = qty > 0;
                                const priceFormatted = typeof item.product.price === 'number' ? item.product.price.toFixed(2) : '0.00';

                                return (
                                    <div
                                        key={item.code}
                                        className={`rounded-xl border p-3 flex flex-col justify-between transition-all duration-200 shadow-sm ${
                                            isSelected
                                                ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500'
                                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow'
                                        }`}
                                    >
                                        <div>
                                            <div
                                                className="w-full h-14 rounded-lg border border-gray-300 dark:border-gray-600 shadow-inner mb-2 flex items-center justify-center relative overflow-hidden"
                                                style={{ backgroundColor: item.hex }}
                                                title={`${item.code} (${item.hex})`}
                                            />
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">{item.code}</span>
                                                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                                    {priceFormatted} PLN
                                                </span>
                                            </div>
                                            <p
                                                className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2 min-h-[2rem] leading-snug font-medium"
                                                title={item.product.name}
                                            >
                                                {item.product.name}
                                            </p>
                                        </div>

                                        {!readOnly && (
                                            <div className="flex items-center justify-between gap-1 mt-3 pt-2 border-t dark:border-gray-700">
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuantityChange(item.code, Math.max(0, qty - 1))}
                                                    className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold text-base flex items-center justify-center transition"
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={quantities[item.code] ?? ''}
                                                    onChange={e => handleQuantityChange(item.code, e.target.value)}
                                                    onFocus={e => e.target.select()}
                                                    placeholder="0"
                                                    className="w-12 h-7 text-center bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-lg font-bold text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuantityChange(item.code, qty + 1)}
                                                    className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900 hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-200 font-bold text-base flex items-center justify-center transition"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {!readOnly && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t dark:border-gray-700 mt-1">
                        <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                            Wybrano łącznie sztuk: <span className="text-indigo-600 dark:text-indigo-400 font-bold text-base">{totalSelectedCount}</span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 sm:flex-initial px-4 py-2 border rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            >
                                Anuluj
                            </button>
                            <button
                                type="button"
                                onClick={handleAddAll}
                                disabled={totalSelectedCount === 0}
                                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-400 font-semibold shadow"
                            >
                                <ShoppingCart className="w-5 h-5" />
                                Dodaj do zamówienia
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default FeltSelectionModal;
