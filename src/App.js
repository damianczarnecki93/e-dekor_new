import React, { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } from 'react';
import { Search, Package, List, Wrench, User, Sun, Moon, LogOut, FileDown, Printer, Save, CheckCircle, AlertTriangle, Upload, Trash2, XCircle, UserPlus, KeyRound, PlusCircle, MessageSquare, ChevronDown, Archive, History } from 'lucide-react';

// --- Kontekst Powiadomień ---
const NotificationContext = createContext();

const NotificationProvider = ({ children }) => {
    const [notification, setNotification] = useState(null);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => {
            setNotification(null);
        }, 5000);
    };

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            {notification && (
                <div className={`fixed top-5 right-5 z-[100] p-4 rounded-lg shadow-lg text-white animate-fade-in-out ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    <div className="flex items-center">
                        {notification.type === 'success' ? <CheckCircle className="mr-2" /> : <XCircle className="mr-2" />}
                        <span>{notification.message}</span>
                    </div>
                </div>
            )}
        </NotificationContext.Provider>
    );
};

const useNotification = () => useContext(NotificationContext);


// --- API Client (Komunikacja z serwerem Node.js) ---
const API_BASE_URL = 'https://dekor.onrender.com';

const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('userToken');
    const headers = { ...options.headers };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        window.location.reload();
        throw new Error('Sesja wygasła. Proszę zalogować się ponownie.');
    }
    return response;
};


const api = {
    searchProducts: async (searchTerm) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/products?search=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd wyszukiwania produktów'); }
        return await response.json();
    },
    saveOrder: async (order) => {
        const url = order._id ? `${API_BASE_URL}/api/orders/${order._id}` : `${API_BASE_URL}/api/orders`;
        const method = order._id ? 'PUT' : 'POST';
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(order) });
        if (!response.ok) throw new Error('Błąd zapisywania zamówienia');
        return await response.json();
    },
    getOrders: async (status) => {
        const url = status ? `${API_BASE_URL}/api/orders?status=${status}` : `${API_BASE_URL}/api/orders`;
        const response = await fetchWithAuth(url);
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd pobierania zamówień'); }
        return await response.json();
    },
    getOrderById: async (id) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/orders/${id}`);
        if (!response.ok) throw new Error('Nie znaleziono zamówienia');
        return await response.json();
    },
    completeOrder: async (orderId, pickedItems) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/orders/${orderId}/complete`, { method: 'POST', body: JSON.stringify({ pickedItems }) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd podczas kompletacji zamówienia'); }
        return await response.json();
    },
    login: async (username, password) => {
        const response = await fetch(`${API_BASE_URL}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || `Błąd serwera: ${response.status}`);
        return data;
    },
    register: async (username, password) => {
        const response = await fetch(`${API_BASE_URL}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        return data;
    },
    getUsers: async () => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users`);
        if (!response.ok) throw new Error('Błąd pobierania użytkowników');
        return await response.json();
    },
    approveUser: async (userId) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${userId}/approve`, { method: 'POST' });
        if (!response.ok) throw new Error('Błąd akceptacji użytkownika');
        return await response.json();
    },
    changeUserRole: async (userId, role) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${userId}/role`, { method: 'POST', body: JSON.stringify({ role }) });
        if (!response.ok) throw new Error('Błąd zmiany roli użytkownika');
        return await response.json();
    },
    deleteUser: async (userId) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${userId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Błąd usuwania użytkownika');
        return await response.json();
    },
    changePassword: async (userId, password) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${userId}/password`, { method: 'POST', body: JSON.stringify({ password }) });
        if (!response.ok) throw new Error('Błąd zmiany hasła');
        return await response.json();
    },
    userChangeOwnPassword: async (currentPassword, newPassword) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/user/password`, { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd zmiany hasła'); }
        return await response.json();
    },
    uploadProductsFile: async (file) => {
        const formData = new FormData();
        formData.append('productsFile', file);
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/upload-products`, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd wgrywania pliku');
        return data;
    }
};

// --- Komponenty UI ---
const Tooltip = ({ children, text }) => ( <div className="relative flex items-center group">{children}<div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">{text}</div></div>);
const Modal = ({ isOpen, onClose, title, children }) => { if (!isOpen) return null; return (<div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"><div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md m-4"><div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700"><h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3><button onClick={onClose} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm p-1.5"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg></button></div><div className="p-6">{children}</div></div></div>);};

// --- Główne Widoki (Moduły) ---
const SearchView = () => { const [query, setQuery] = useState(''); const [suggestions, setSuggestions] = useState([]); const [selectedProduct, setSelectedProduct] = useState(null); const [isLoading, setIsLoading] = useState(false); const { showNotification } = useNotification(); useEffect(() => { if (query.length < 2) { setSuggestions([]); return; } const handler = setTimeout(async () => { setIsLoading(true); try { const results = await api.searchProducts(query); setSuggestions(results); } catch (error) { showNotification(error.message, 'error'); } finally { setIsLoading(false); } }, 300); return () => clearTimeout(handler); }, [query, showNotification]); const handleSelect = (product) => { setSelectedProduct(product); setSuggestions([]); setQuery(''); }; return (<div className="p-4 md:p-8"><h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Szybkie Wyszukiwanie</h1><div className="relative max-w-2xl mx-auto"><div className="flex items-center bg-white dark:bg-gray-700 rounded-full shadow-lg"><Search className="h-6 w-6 ml-4 text-gray-400"/><input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Wpisz kod kreskowy, kod produktu lub nazwę..." className="w-full p-4 bg-transparent focus:outline-none text-gray-900 dark:text-white"/></div>{isLoading && <div className="absolute w-full mt-2 text-center text-gray-500">Szukam...</div>}{suggestions.length > 0 && (<ul className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl">{suggestions.map(p => (<li key={p._id} onClick={() => handleSelect(p)} className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-b dark:border-gray-600 last:border-b-0"><p className="font-semibold text-gray-800 dark:text-gray-100">{p.name}</p><p className="text-sm text-gray-500 dark:text-gray-400">{p.product_code}</p></li>))}</ul>)}</div>{selectedProduct && (<div className="mt-10 max-w-2xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in"><h2 className="text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">{selectedProduct.name}</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300"><div><strong>Kod produktu:</strong> {selectedProduct.product_code}</div><div><strong>Kod kreskowy:</strong> {selectedProduct.barcode}</div><div><strong>Cena:</strong> {selectedProduct.price.toFixed(2)} PLN</div><div><strong>Ilość na stanie:</strong> {selectedProduct.quantity}</div><div><strong>Dostępność:</strong><span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${selectedProduct.availability ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>{selectedProduct.availability ? 'Dostępny' : 'Niedostępny'}</span></div></div></div>)}</div>);};

const OrderView = ({ currentOrder, setCurrentOrder, setActiveView }) => {
    const [order, setOrder] = useState(currentOrder);
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [noteModal, setNoteModal] = useState({ isOpen: false, itemIndex: null, text: '' });
    const listEndRef = useRef(null);
    const printRef = useRef();
    const { showNotification } = useNotification();

    useEffect(() => {
        setOrder(currentOrder);
    }, [currentOrder]);

    const scrollToBottom = () => listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(scrollToBottom, [order.items]);

    useEffect(() => {
        if (inputValue.length < 2) {
            setSuggestions([]);
            return;
        }
        const handler = setTimeout(async () => {
            try {
                const results = await api.searchProducts(inputValue);
                setSuggestions(results);
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [inputValue, showNotification]);

    const updateOrder = (updatedOrder) => {
        setOrder(updatedOrder);
        setCurrentOrder(updatedOrder);
    };

    const addProductToOrder = (product) => {
        const newItems = [...(order.items || [])];
        const existingItemIndex = newItems.findIndex(item => item._id === product._id);
        if (existingItemIndex > -1) {
            newItems[existingItemIndex].quantity += 1;
        } else {
            newItems.push({ ...product, quantity: 1, note: '' });
        }
        updateOrder({ ...order, items: newItems });
        setInputValue('');
        setSuggestions([]);
    };

    const removeItemFromOrder = (itemIndex) => {
        const newItems = [...order.items];
        newItems.splice(itemIndex, 1);
        updateOrder({ ...order, items: newItems });
    };

    const handleNoteSave = () => {
        const newItems = [...order.items];
        newItems[noteModal.itemIndex].note = noteModal.text;
        updateOrder({ ...order, items: newItems });
        setNoteModal({ isOpen: false, itemIndex: null, text: '' });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && inputValue.trim() !== '') {
            e.preventDefault();
            if (suggestions.length > 0) {
                addProductToOrder(suggestions[0]);
            } else {
                const newItems = [...(order.items || [])];
                newItems.push({ _id: `custom-${Date.now()}`, name: inputValue, product_code: 'N/A', price: 0.00, quantity: 1, isCustom: true, note: '' });
                updateOrder({ ...order, items: newItems });
                setInputValue('');
                setSuggestions([]);
            }
        }
    };

    const totalValue = useMemo(() => (order.items || []).reduce((sum, item) => sum + item.price * item.quantity, 0), [order.items]);

    const handleSaveOrder = async () => {
        if (!order.customerName) {
            showNotification('Proszę podać nazwę klienta.', 'error');
            return;
        }
        try {
            const { message, order: savedOrder } = await api.saveOrder(order);
            showNotification(message, 'success');
            updateOrder(savedOrder);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleNewOrder = async () => {
        if (order.customerName || (order.items && order.items.length > 0)) {
            await handleSaveOrder();
        }
        setCurrentOrder({ customerName: '', items: [] });
    };

    const handlePrint = () => {
        const content = printRef.current;
        if (content) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write('<html><head><title>Wydruk Zamówienia</title><script src="https://cdn.tailwindcss.com"></script><style>.print-header { display: block !important; } body { padding: 2rem; }</style></head><body>');
            printWindow.document.write(content.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
        }
    };

    const handleExportCsv = () => {
        const headers = ["Nazwa", "Kod produktu", "Cena", "Ilość", "Wartość", "Notatka"];
        const data = (order.items || []).map(item => [`"${item.name.replace(/"/g, '""')}"`, item.product_code, item.price.toFixed(2), item.quantity, (item.price * item.quantity).toFixed(2), `"${(item.note || '').replace(/"/g, '""')}"`]);
        const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        const filename = `Zamowienie-${order.customerName.replace(/\s/g, '_') || 'nowe'}.csv`;
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <div className="h-full flex flex-col">
                <div className="p-4 md:p-8 pb-48">
                    <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                            {order._id ? `Edycja Zamówienia ${order.id}` : 'Nowe Zamówienie'}
                        </h1>
                        <button onClick={handleNewOrder} className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            <PlusCircle className="w-5 h-5 mr-2"/> Nowa Lista
                        </button>
                    </div>
                    <input type="text" value={order.customerName || ''} onChange={(e) => updateOrder({ ...order, customerName: e.target.value })} placeholder="Wprowadź nazwę klienta" className="w-full max-w-lg p-3 mb-6 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />

                    <div ref={printRef} className="flex-grow bg-gray-50 dark:bg-gray-900 p-4 rounded-lg shadow-inner mb-4">
                        <div className="print-header hidden p-4">
                            <h2 className="text-2xl font-bold">Zamówienie dla: {order.customerName}</h2>
                            <p>Data: {new Date().toLocaleDateString()}</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[600px]">
                                <thead><tr className="border-b border-gray-200 dark:border-gray-700"><th className="p-3">Nazwa</th><th className="p-3">Kod produktu</th><th className="p-3 text-right">Cena</th><th className="p-3 text-center">Ilość</th><th className="p-3 text-right">Wartość</th><th className="p-3 text-center">Akcje</th></tr></thead>
                                <tbody>
                                    {(order.items || []).map((item, index) => (
                                        <tr key={item._id || index} className={`border-b border-gray-200 dark:border-gray-700 last:border-0 ${item.isCustom ? 'text-red-500' : ''}`}>
                                            <td className="p-3 font-medium">{item.name}{item.note && <p className="text-xs text-gray-400 mt-1">Notatka: {item.note}</p>}</td>
                                            <td className="p-3">{item.product_code}</td>
                                            <td className="p-3 text-right">{item.price.toFixed(2)} PLN</td>
                                            <td className="p-3 text-center">{item.quantity}</td>
                                            <td className="p-3 text-right font-semibold">{(item.price * item.quantity).toFixed(2)} PLN</td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <Tooltip text="Dodaj notatkę"><button onClick={() => setNoteModal({ isOpen: true, itemIndex: index, text: item.note || '' })} className="p-2 text-gray-500 hover:text-blue-500"><MessageSquare className="w-5 h-5"/></button></Tooltip>
                                                <Tooltip text="Usuń pozycję"><button onClick={() => removeItemFromOrder(index)} className="p-2 text-gray-500 hover:text-red-500"><Trash2 className="w-5 h-5"/></button></Tooltip>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {(!order.items || order.items.length === 0) && <p className="text-center text-gray-500 py-8">Brak pozycji na zamówieniu.</p>}
                        <div ref={listEndRef} />
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-top z-20">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex flex-wrap justify-end items-center mb-4 gap-4">
                            <span className="text-lg font-bold text-gray-700 dark:text-gray-300">Suma:</span>
                            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalValue.toFixed(2)} PLN</span>
                        </div>
                        <div className="relative">
                            <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder="Dodaj produkt (zatwierdź Enterem)" className="w-full p-4 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                            {suggestions.length > 0 && <ul className="absolute bottom-full mb-2 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto z-30">{suggestions.map(p => <li key={p._id} onClick={() => addProductToOrder(p)} className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-b dark:border-gray-600 last:border-b-0"><p className="font-semibold text-gray-800 dark:text-gray-100">{p.name}</p><p className="text-sm text-gray-500 dark:text-gray-400">{p.product_code}</p></li>)}</ul>}
                        </div>
                        <div className="flex flex-wrap justify-end space-x-3 mt-4">
                            <button onClick={handleSaveOrder} className="flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Save className="w-5 h-5 mr-2"/> Zapisz</button>
                            <button onClick={handleExportCsv} className="flex items-center justify-center px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><FileDown className="w-5 h-5 mr-2"/> CSV</button>
                            <button onClick={handlePrint} className="flex items-center justify-center px-5 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"><Printer className="w-5 h-5 mr-2"/> Drukuj</button>
                        </div>
                    </div>
                </div>
            </div>
            <Modal isOpen={noteModal.isOpen} onClose={() => setNoteModal({ isOpen: false, itemIndex: null, text: '' })} title="Dodaj notatkę do pozycji">
                <textarea value={noteModal.text} onChange={(e) => setNoteModal({...noteModal, text: e.target.value})} className="w-full p-2 border rounded-md min-h-[100px] bg-white dark:bg-gray-700"></textarea>
                <div className="flex justify-end gap-4 mt-4">
                    <button onClick={() => setNoteModal({ isOpen: false, itemIndex: null, text: '' })} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button>
                    <button onClick={handleNoteSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz notatkę</button>
                </div>
            </Modal>
        </>
    );
};

// --- Pozostałe komponenty (bez większych zmian) ---

// --- Główny Komponent Aplikacji ---
function App() {
    const [user, setUser] = useState(null);
    const [activeView, setActiveView] = useState('order');
    const [currentOrder, setCurrentOrder] = useState({ customerName: '', items: [] });
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isNavOpen, setIsNavOpen] = useState(false);

    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    const handleLogin = useCallback((data) => {
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        setUser(data.user);
        setIsLoading(false);
        setActiveView(data.user.role === 'administrator' ? 'admin' : 'order');
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        setUser(null);
        setActiveView('order');
    };
    
    useEffect(() => {
        const token = localStorage.getItem('userToken');
        const userData = localStorage.getItem('userData');
        if (token && userData) {
            const user = JSON.parse(userData);
            handleLogin({ token, user });
        } else {
            setIsLoading(false);
        }
    }, [handleLogin]);
    
    const loadOrderForEditing = async (orderId) => {
        try {
            const order = await api.getOrderById(orderId);
            setCurrentOrder(order);
            setActiveView('order');
        } catch (error) {
            console.error("Błąd ładowania zamówienia", error);
        }
    };

    if (isLoading) {
      return <div className="flex items-center justify-center h-screen">Ładowanie...</div>
    }

    if (!user) {
        return <AuthPage onLogin={handleLogin} />;
    }

    const navItems = [
        { id: 'search', label: 'Wyszukiwarka', icon: Search, roles: ['user', 'administrator'] },
        { id: 'order', label: 'Nowe Zamówienie', icon: PlusCircle, roles: ['user', 'administrator'], action: () => { setCurrentOrder({ customerName: '', items: [] }); setActiveView('order'); } },
        { id: 'savedOrders', label: 'Zapisane Zamówienia', icon: Archive, roles: ['user', 'administrator'], action: () => setActiveView('savedOrders') },
        { id: 'completedOrders', label: 'Skompletowane', icon: History, roles: ['user', 'administrator'], action: () => setActiveView('completedOrders') },
        { id: 'picking', label: 'Kompletacja', icon: List, roles: ['user', 'administrator'] },
        { id: 'inventory', label: 'Inwentaryzacja', icon: Wrench, roles: ['user', 'administrator'] },
        { id: 'admin', label: 'Admin', icon: User, roles: ['administrator'] },
    ];
    
    const availableNavItems = navItems.filter(item => item.roles.includes(user.role));

    const renderView = () => {
        switch (activeView) {
            case 'search': return <SearchView />;
            case 'order': return <OrderView currentOrder={currentOrder} setCurrentOrder={setCurrentOrder} setActiveView={setActiveView} />;
            case 'savedOrders': return <OrdersListView status="Zapisane" title="Zapisane Zamówienia" onEdit={loadOrderForEditing} />;
            case 'completedOrders': return <OrdersListView status="Skompletowane" title="Skompletowane Zamówienia" onEdit={loadOrderForEditing} />;
            case 'picking': return <PickingView user={user} />;
            case 'inventory': return <InventoryView />;
            case 'admin': return <AdminView user={user} />;
            default: return <OrderView currentOrder={currentOrder} setCurrentOrder={setCurrentOrder} setActiveView={setActiveView} />;
        }
    };

    return (
        <>
            <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
                <nav className={`w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out z-40 lg:translate-x-0 ${isNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="flex items-center justify-center h-20 border-b border-gray-200 dark:border-gray-700">
                         <img src={isDarkMode ? "/logo-dark.png" : "/logo.png"} onError={(e) => { e.currentTarget.src = 'https://placehold.co/120x40/4f46e5/ffffff?text=Logo'; }} alt="Logo" className="h-10" />
                    </div>
                    <ul className="flex-grow">
                        {availableNavItems.map(item => (
                            <li key={item.id}>
                                <button onClick={() => { item.action ? item.action() : setActiveView(item.id); setIsNavOpen(false); }} className={`w-full flex items-center justify-start h-14 px-6 text-lg transition-colors duration-200 text-left ${activeView === item.id ? 'bg-indigo-50 dark:bg-gray-700 text-indigo-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                    <item.icon className="h-6 w-6" />
                                    <span className="ml-4">{item.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <div><p className="font-semibold">{user.username}</p><p className="text-sm text-gray-500">{user.role}</p></div>
                             <div className="flex items-center">
                                <Tooltip text="Zmień hasło"><button onClick={() => setIsPasswordModalOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><KeyRound className="h-6 w-6 text-gray-500" /></button></Tooltip>
                                <Tooltip text="Wyloguj"><button onClick={handleLogout} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><LogOut className="h-6 w-6 text-gray-500" /></button></Tooltip>
                             </div>
                        </div>
                        <Tooltip text="Zmień motyw"><button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex justify-center p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">{isDarkMode ? <Sun className="h-6 w-6 text-yellow-400" /> : <Moon className="h-6 w-6 text-indigo-500" />}</button></Tooltip>
                    </div>
                </nav>
                <main className="flex-1 flex flex-col overflow-hidden">
                    <div className="lg:hidden p-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                        <button onClick={() => setIsNavOpen(!isNavOpen)} className="p-2 rounded-md">
                            <Search className="h-6 w-6" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-x-hidden overflow-y-auto">{renderView()}</div>
                </main>
            </div>
            <UserChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
        </>
    );
}
const AuthPage = ({ onLogin }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
            {isLoginView ? <LoginView onLogin={onLogin} showRegister={() => setIsLoginView(false)} /> : <RegisterView showLogin={() => setIsLoginView(true)} />}
        </div>
    );
};

const LoginView = ({ onLogin, showRegister }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const data = await api.login(username, password);
            onLogin(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <div className="text-center"><img src="/logo.png" onError={(e) => { e.currentTarget.src = 'https://placehold.co/150x50/4f46e5/ffffff?text=Logo'; }} alt="Logo" className="mx-auto mb-4 h-12" /><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Zaloguj się do systemu</h2></div>
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div><label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Nazwa użytkownika</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required/></div>
                <div><label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Hasło</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required/></div>
                {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                <div><button type="submit" disabled={isLoading} className="w-full px-4 py-3 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400">{isLoading ? 'Logowanie...' : 'Zaloguj się'}</button></div>
            </form>
            <div className="text-center"><button onClick={showRegister} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Nie masz konta? Zarejestruj się</button></div>
        </div>
    );
};

const RegisterView = ({ showLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { showNotification } = useNotification();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password.length < 6) {
            setError('Hasło musi mieć co najmniej 6 znaków.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const data = await api.register(username, password);
            showNotification(data.message, 'success');
            showLogin();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <div className="text-center"><UserPlus className="mx-auto h-12 w-12 text-indigo-500" /><h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Stwórz nowe konto</h2></div>
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div><label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Nazwa użytkownika</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required/></div>
                <div><label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Hasło</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required/></div>
                {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                <div><button type="submit" disabled={isLoading} className="w-full px-4 py-3 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400">{isLoading ? 'Rejestracja...' : 'Zarejestruj się'}</button></div>
            </form>
            <div className="text-center"><button onClick={showLogin} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Masz już konto? Zaloguj się</button></div>
        </div>
    );
};

// --- Główny Komponent Aplikacji ---
function App() {
    const [user, setUser] = useState(null);
    const [activeView, setActiveView] = useState('search');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    const handleLogin = useCallback((data) => {
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        setUser(data.user);
        setIsLoading(false);
        setActiveView(data.user.role === 'administrator' ? 'admin' : 'order');
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        setUser(null);
        setActiveView('search');
    };
    
    useEffect(() => {
        const token = localStorage.getItem('userToken');
        const userData = localStorage.getItem('userData');
        if (token && userData) {
            const user = JSON.parse(userData);
            handleLogin({ token, user });
        } else {
            setIsLoading(false);
        }
    }, [handleLogin]);

    if (isLoading) {
      return <div className="flex items-center justify-center h-screen">Ładowanie...</div>
    }

    if (!user) {
        return <AuthPage onLogin={handleLogin} />;
    }

    const navItems = [
        { id: 'search', label: 'Wyszukiwarka', icon: Search, roles: ['user', 'administrator'] },
        { id: 'order', label: 'Zamówienie', icon: Package, roles: ['user', 'administrator'] },
        { id: 'picking', label: 'Kompletacja', icon: List, roles: ['user', 'administrator'] },
        { id: 'inventory', label: 'Inwentaryzacja', icon: Wrench, roles: ['user', 'administrator'] },
        { id: 'admin', label: 'Admin', icon: User, roles: ['administrator'] },
    ];
    
    const availableNavItems = navItems.filter(item => item.roles.includes(user.role));

    const renderView = () => {
        switch (activeView) {
            case 'search': return <SearchView />;
            case 'order': return <OrderView user={user} />;
            case 'picking': return <PickingView user={user} />;
            case 'inventory': return <InventoryView />;
            case 'admin': return <AdminView user={user} />;
            default: return <SearchView />;
        }
    };

    return (
        <>
            <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
                <nav className="w-20 lg:w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col flex-shrink-0">
                    <div className="flex items-center justify-center h-20 border-b border-gray-200 dark:border-gray-700">
                         <img src={isDarkMode ? "/logo-dark.png" : "/logo.png"} onError={(e) => { e.currentTarget.src = 'https://placehold.co/120x40/4f46e5/ffffff?text=Logo'; }} alt="Logo" className="h-10 hidden lg:block" />
                         <Package className="h-8 w-8 text-indigo-500 lg:hidden" />
                    </div>
                    <ul className="flex-grow">
                        {availableNavItems.map(item => (
                            <li key={item.id}>
                                <button
                                    onClick={() => setActiveView(item.id)}
                                    className={`w-full flex items-center justify-center lg:justify-start h-16 px-6 text-lg transition-colors duration-200 text-left ${activeView === item.id ? 'bg-indigo-50 dark:bg-gray-700 text-indigo-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                >
                                    <item.icon className="h-6 w-6" />
                                    <span className="ml-4 hidden lg:block">{item.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-center lg:justify-between mb-4">
                            <div className="hidden lg:block"><p className="font-semibold">{user.username}</p><p className="text-sm text-gray-500">{user.role}</p></div>
                             <div className="flex items-center">
                                <Tooltip text="Zmień hasło">
                                    <button onClick={() => setIsPasswordModalOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                                        <KeyRound className="h-6 w-6 text-gray-500" />
                                    </button>
                                </Tooltip>
                                <Tooltip text="Wyloguj">
                                    <button onClick={handleLogout} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                                        <LogOut className="h-6 w-6 text-gray-500" />
                                    </button>
                                </Tooltip>
                             </div>
                        </div>
                        <Tooltip text="Zmień motyw">
                            <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex justify-center p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">
                                {isDarkMode ? <Sun className="h-6 w-6 text-yellow-400" /> : <Moon className="h-6 w-6 text-indigo-500" />}
                            </button>
                        </Tooltip>
                    </div>
                </nav>
                <main className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-x-hidden overflow-y-auto">{renderView()}</div>
                </main>
            </div>
            <UserChangePasswordModal 
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
            />
        </>
    );
}

const UserChangePasswordModal = ({ isOpen, onClose }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const { showNotification } = useNotification();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (newPassword.length < 6) {
            setError('Nowe hasło musi mieć co najmniej 6 znaków.');
            return;
        }
        try {
            await api.userChangeOwnPassword(currentPassword, newPassword);
            showNotification('Hasło zostało zmienione pomyślnie!', 'success');
            onClose();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Zmień swoje hasło">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block mb-2 text-sm font-medium">Aktualne hasło</label>
                    <input 
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                        required
                    />
                </div>
                <div>
                    <label className="block mb-2 text-sm font-medium">Nowe hasło</label>
                    <input 
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                        required
                    />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zmień hasło</button>
                </div>
            </form>
        </Modal>
    );
};


// Główny punkt wejścia aplikacji z dostawcą powiadomień
export default function AppWrapper() {
    return (
        <NotificationProvider>
            <App />
        </NotificationProvider>
    );
}
