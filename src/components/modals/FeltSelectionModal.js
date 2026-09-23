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
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 border dark:border-gray-600">
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
                    <div className="py-12 text-center text-gray-500">Ładowanie listy filców...</div>
                ) : (
                    <div className="overflow-x-auto max-h-[55vh] border rounded-lg dark:border-gray-700">
                        <table className="w-full text-left text-sm text-gray-700 dark:text-gray-200">
                            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 w-16 text-center">Kolor</th>
                                    <th className="p-3">Kod</th>
                                    <th className="p-3">Nazwa w bazie</th>
                                    <th className="p-3 text-right">Cena</th>
                                    {!readOnly && <th className="p-3 w-32 text-center">Ilość</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredItems.map(item => {
                                    const price = typeof item.product.price === 'number' ? item.product.price.toFixed(2) : '0.00';
                                    return (
                                        <tr key={item.code} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <td className="p-3 text-center">
                                                <div
                                                    className="w-8 h-8 rounded-full border border-gray-300 shadow-sm mx-auto"
                                                    style={{ backgroundColor: item.hex }}
                                                    title={`${item.code} (${item.hex})`}
                                                />
                                            </td>
                                            <td className="p-3 font-semibold whitespace-nowrap">{item.code}</td>
                                            <td className="p-3 font-medium">{item.product.name}</td>
                                            <td className="p-3 text-right font-semibold whitespace-nowrap">{price} PLN</td>
                                            {!readOnly && (
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={quantities[item.code] ?? ''}
                                                        onChange={e => handleQuantityChange(item.code, e.target.value)}
                                                        onFocus={e => e.target.select()}
                                                        placeholder="0"
                                                        className="w-20 p-1.5 text-center bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-md font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {!readOnly && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t dark:border-gray-700 mt-2">
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
