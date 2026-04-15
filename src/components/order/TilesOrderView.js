import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, ChevronRight, ChevronLeft, Plus, Minus, ShoppingCart, Trash2, Save } from 'lucide-react';
import { api } from '../../api';
import { saveOrderOfflineFirst } from '../../data/repository';
import { useNotification } from '../../contexts/NotificationContext';

const TilesOrderView = ({ currentOrder, setCurrentOrder, user, setDirty }) => {
    const [categories, setCategories] = useState({});
    const [activeCategory, setActiveCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [cart, setCart] = useState(currentOrder.items || []);
    const [customerName, setCustomerName] = useState(currentOrder.customerName || '');
    const { showNotification } = useNotification();

    const fetchCategorizedProducts = useCallback(async (query = '') => {
        setIsLoading(true);
        try {
            const data = await api.searchProducts(query, false, true); // categorized=true
            setCategories(data);
            if (!activeCategory || !data[activeCategory]) {
                setActiveCategory(Object.keys(data)[0]);
            }
        } catch (error) {
            showNotification('Błąd pobierania produktów.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [activeCategory, showNotification]);

    useEffect(() => {
        fetchCategorizedProducts();
    }, []);

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        // Debounce search in a real app, here we just filter if already loaded
    };

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item._id === product._id);
            let newCart;
            if (existing) {
                newCart = prev.map(item => item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item);
            } else {
                newCart = [...prev, { ...product, quantity: 1 }];
            }
            updateParentState(newCart);
            return newCart;
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => {
            const newCart = prev.filter(item => item._id !== productId);
            updateParentState(newCart);
            return newCart;
        });
    };

    const updateQuantity = (productId, delta) => {
        setCart(prev => {
            const newCart = prev.map(item => {
                if (item._id === productId) {
                    const newQty = Math.max(0, item.quantity + delta);
                    return { ...item, quantity: newQty };
                }
                return item;
            }).filter(item => item.quantity > 0);
            updateParentState(newCart);
            return newCart;
        });
    };

    const updateParentState = (newItems) => {
        const updatedOrder = { ...currentOrder, items: newItems, customerName, isDirty: true };
        setTimeout(() => {
            setCurrentOrder(updatedOrder);
            localStorage.setItem('draftOrder', JSON.stringify(updatedOrder));
            setDirty(true);
        }, 0);
    };

    const handleSaveOrder = async () => {
        if (!customerName) {
            showNotification('Proszę podać nazwę klienta.', 'error');
            return;
        }
        try {
            const orderToSave = { ...currentOrder, items: cart, customerName };
            const saved = await saveOrderOfflineFirst(orderToSave, user);
            setCurrentOrder(saved);
            setDirty(false);
            showNotification('Zamówienie zapisane!', 'success');
        } catch (error) {
            showNotification('Błąd zapisu.', 'error');
        }
    };

    const filteredCategories = useMemo(() => {
        if (!searchQuery) return categories;
        const result = {};
        Object.entries(categories).forEach(([cat, products]) => {
            const matches = products.filter(p =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.polish_name && p.polish_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                p.product_code.includes(searchQuery)
            );
            if (matches.length > 0) result[cat] = matches;
        });
        return result;
    }, [categories, searchQuery]);

    const totalValue = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <div className="flex h-full bg-gray-100 dark:bg-gray-900 overflow-hidden">
            {/* Sidebar with Categories */}
            <div className="w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col">
                <div className="p-4 font-bold border-b dark:border-gray-700">Kategorie</div>
                <div className="flex-1 overflow-y-auto">
                    {Object.keys(filteredCategories).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`w-full text-left p-4 hover:bg-indigo-50 dark:hover:bg-gray-700 border-b dark:border-gray-700 flex justify-between items-center ${activeCategory === cat ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200' : ''}`}
                        >
                            <span className="truncate">{cat}</span>
                            <span className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-xs">{filteredCategories[cat].length}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content - Tiles */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex gap-4 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Szukaj produktu..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            value={searchQuery}
                            onChange={handleSearch}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">Ładowanie...</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {(filteredCategories[activeCategory] || []).map(product => (
                                <div key={product._id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-transparent hover:border-indigo-300">
                                    <div>
                                        <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.polish_name || product.name}</h3>
                                        <p className="text-xs text-gray-500 mb-2">{product.product_code}</p>
                                    </div>
                                    <div className="flex justify-between items-center mt-auto">
                                        <span className="font-bold text-indigo-600">{product.price.toFixed(2)} zł</span>
                                        <button
                                            onClick={() => addToCart(product)}
                                            className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar - Mini Cart */}
            <div className="w-80 bg-white dark:bg-gray-800 border-l dark:border-gray-700 flex flex-col">
                <div className="p-4 font-bold border-b dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2"><ShoppingCart size={20} /> Koszyk</div>
                    <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">{cart.length}</span>
                </div>
                <div className="p-4 border-b dark:border-gray-700">
                    <input
                        type="text"
                        placeholder="Nazwa klienta..."
                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                        value={customerName}
                        onChange={(e) => {
                            setCustomerName(e.target.value);
                            updateParentState(cart);
                        }}
                    />
                </div>
                <div className="flex-1 overflow-y-auto">
                    {cart.map(item => (
                        <div key={item._id} className="p-4 border-b dark:border-gray-700 text-sm">
                            <div className="flex justify-between mb-2">
                                <span className="font-medium line-clamp-1">{item.polish_name || item.name}</span>
                                <button onClick={() => removeFromCart(item._id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 border dark:border-gray-600 rounded">
                                    <button onClick={() => updateQuantity(item._id, -1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700"><Minus size={14}/></button>
                                    <span className="w-8 text-center">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item._id, 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700"><Plus size={14}/></button>
                                </div>
                                <span className="font-bold">{(item.price * item.quantity).toFixed(2)} zł</span>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && <div className="p-8 text-center text-gray-500">Koszyk jest pusty</div>}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700">
                    <div className="flex justify-between font-bold text-lg mb-4">
                        <span>Suma:</span>
                        <span>{totalValue.toFixed(2)} zł</span>
                    </div>
                    <button
                        onClick={handleSaveOrder}
                        disabled={cart.length === 0}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                        <Save size={20} /> Zapisz Zamówienie
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TilesOrderView;
