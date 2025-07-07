import React, { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } from 'react';
import { Search, List, Wrench, User, Sun, Moon, LogOut, FileDown, Printer, Save, CheckCircle, AlertTriangle, Upload, Trash2, XCircle, UserPlus, KeyRound, PlusCircle, MessageSquare, Archive, Edit, Home, Menu, Filter, RotateCcw, FileUp, GitMerge, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

// --- Komponent Granicy Błędu (Error Boundary) ---
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("DIAGNOSTYKA (ErrorBoundary): Nieprzechwycony błąd:", error, errorInfo);
        this.setState({ error: error, errorInfo: errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-red-50 text-red-800 p-4">
                    <AlertTriangle className="w-16 h-16 mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Wystąpił błąd aplikacji</h1>
                    <p className="text-center mb-4">Coś poszło nie tak. Spróbuj odświeżyć stronę lub kliknij przycisk poniżej.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                        Odśwież stronę
                    </button>
                    <details className="mt-6 text-left bg-red-100 p-4 rounded-lg w-full max-w-2xl">
                        <summary className="cursor-pointer font-semibold">Szczegóły błędu</summary>
                        <pre className="mt-2 text-sm whitespace-pre-wrap break-words">
                            {this.state.error && this.state.error.toString()}
                            <br />
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}


// --- Kontekst Powiadomień ---
const NotificationContext = createContext();
const NotificationProvider = ({ children }) => {
    const [notification, setNotification] = useState(null);
    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
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

// --- API Client ---
const API_BASE_URL = 'https://dekor.onrender.com';

const fetchWithAuth = async (url, options = {}) => {
    console.log(`DIAGNOSTYKA: Rozpoczynam fetchWithAuth do: ${url}`, options);
    const token = localStorage.getItem('userToken');
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
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
    searchProducts: async (searchTerm, filterByQuantity = false) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/products?search=${encodeURIComponent(searchTerm)}&filterByQuantity=${filterByQuantity}`);
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd wyszukiwania produktów'); }
        return await response.json();
    },
    importOrderFromCsv: async (file) => {
        const formData = new FormData();
        formData.append('orderFile', file);
        const response = await fetchWithAuth(`${API_BASE_URL}/api/orders/import-csv`, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd importu pliku');
        return data;
    },
    saveOrder: async (order) => {
        const url = order._id ? `${API_BASE_URL}/api/orders/${order._id}` : `${API_BASE_URL}/api/orders`;
        const method = order._id ? 'PUT' : 'POST';
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(order) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd zapisywania zamówienia'); }
        return await response.json();
    },
    getOrders: async (filters = {}) => {
        const params = new URLSearchParams(filters);
        for (const [key, value] of params.entries()) {
            if (!value) {
                params.delete(key);
            }
        }
        const url = `${API_BASE_URL}/api/orders?${params.toString()}`;
        const response = await fetchWithAuth(url);
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd pobierania zamówień'); }
        return await response.json();
    },
    getOrderById: async (id) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/orders/${id}`);
        if (!response.ok) throw new Error('Nie znaleziono zamówienia');
        return await response.json();
    },
    deleteOrder: async (id) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/orders/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Błąd usuwania zamówienia');
        return await response.json();
    },
    completeOrder: async (orderId, pickedItems) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/orders/${orderId}/complete`, { method: 'POST', body: JSON.stringify({ pickedItems }) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd podczas kompletacji zamówienia'); }
        return await response.json();
    },
    uploadProductsFile: async (file, mode) => {
        const formData = new FormData();
        formData.append('productsFile', file);
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/upload-products?mode=${mode}`, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd wgrywania pliku');
        return data;
    },
    getDashboardStats: async () => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/dashboard-stats`);
        if (!response.ok) throw new Error('Błąd pobierania statystyk');
        return await response.json();
    },
    mergeProducts: async () => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/merge-products`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd łączenia produktów');
        return data;
    },
    saveInventory: async (inventory) => {
        const url = inventory._id ? `${API_BASE_URL}/api/inventories/${inventory._id}` : `${API_BASE_URL}/api/inventories`;
        const method = inventory._id ? 'PUT' : 'POST';
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(inventory) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd zapisywania inwentaryzacji'); }
        return await response.json();
    },
    getInventories: async () => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/inventories`);
        if (!response.ok) throw new Error('Błąd pobierania inwentaryzacji');
        return await response.json();
    },
    getInventoryById: async (id) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/inventories/${id}`);
        if (!response.ok) throw new Error('Nie znaleziono inwentaryzacji');
        return await response.json();
    },
    deleteInventory: async (id) => {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/inventories/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Błąd usuwania inwentaryzacji');
        return await response.json();
    },
    importInventorySheet: async (file) => {
        const formData = new FormData();
        formData.append('sheetFile', file);
        const response = await fetchWithAuth(`${API_BASE_URL}/api/inventories/import-sheet`, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd importu arkusza');
        return data;
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
};

// --- Komponenty UI ---
const Tooltip = ({ children, text }) => ( <div className="relative flex items-center group">{children}<div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">{text}</div></div>);
const Modal = ({ isOpen, onClose, title, children, maxWidth = 'md' }) => {
    if (!isOpen) return null;
    const maxWidthClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl' }[maxWidth];
    return (<div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"><div className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full m-4 ${maxWidthClass}`}><div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700"><h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3><button onClick={onClose} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm p-1.5"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg></button></div><div className="p-6">{children}</div></div></div>);
};
const ProductDetailsCard = ({ product }) => (
    <div className="mt-6 max-w-4xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in">
        <h2 className="text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">{product.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
            <div><strong>Kod produktu:</strong> {product.product_code}</div>
            <div><strong>Kody EAN:</strong> {(product.barcodes || []).join(', ')}</div>
            <div><strong>Cena:</strong> {product.price.toFixed(2)} PLN</div>
            <div><strong>Ilość na stanie:</strong> {product.quantity}</div>
        </div>
    </div>
);

// --- Główne Widoki (Moduły) ---

const MainSearchView = () => {
    const [selectedProduct, setSelectedProduct] = useState(null);
    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Szybkie Wyszukiwanie</h1>
            <SearchView onProductSelect={setSelectedProduct} />
            {selectedProduct && <ProductDetailsCard product={selectedProduct} />}
        </div>
    );
};

const SearchView = ({ onProductSelect }) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filterByQuantity, setFilterByQuantity] = useState(false);
    const { showNotification } = useNotification();

    useEffect(() => {
        if (query.length < 2) { setSuggestions([]); return; }
        const handler = setTimeout(async () => {
            setIsLoading(true);
            try {
                const results = await api.searchProducts(query, filterByQuantity);
                setSuggestions(results);
            } catch (error) { showNotification(error.message, 'error'); }
            finally { setIsLoading(false); }
        }, 300);
        return () => clearTimeout(handler);
    }, [query, filterByQuantity, showNotification]);

    const handleSelect = (product) => {
        onProductSelect(product);
        setSuggestions([]);
        setQuery('');
    };

    return (
        <div className="relative max-w-2xl mx-auto">
            <div className="flex items-center bg-white dark:bg-gray-700 rounded-full shadow-lg">
                <Search className="h-6 w-6 ml-4 text-gray-400" />
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Wpisz kod EAN, kod produktu lub nazwę..." className="w-full p-4 bg-transparent focus:outline-none text-gray-900 dark:text-white" />
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
                <ul className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl">{suggestions.map(p => (<li key={p._id} onClick={() => handleSelect(p)} className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-b dark:border-gray-600 last:border-b-0"><p className="font-semibold text-gray-800 dark:text-gray-100">{p.name}</p><p className="text-sm text-gray-500 dark:text-gray-400">{p.product_code}</p></li>))}</ul>
            )}
        </div>
    );
};

const OrderView = ({ currentOrder, setCurrentOrder, user }) => {
    const [order, setOrder] = useState(currentOrder);
    const [noteModal, setNoteModal] = useState({ isOpen: false, itemIndex: null, text: '' });
    const listEndRef = useRef(null);
    const printRef = useRef(null);
    const importFileRef = useRef(null);
    const { showNotification } = useNotification();

    useEffect(() => { setOrder(currentOrder); }, [currentOrder]);
    const scrollToBottom = () => listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(scrollToBottom, [order.items]);

    const updateOrder = (updatedOrder) => {
        setOrder(updatedOrder);
        setCurrentOrder(updatedOrder);
    };

    const addProductToOrder = (product) => {
        const newItems = [...(order.items || [])];
        const existingItemIndex = newItems.findIndex(item => item._id === product._id);
        if (existingItemIndex > -1) { newItems[existingItemIndex].quantity += 1; }
        else { newItems.push({ ...product, quantity: 1, note: '' }); }
        updateOrder({ ...order, items: newItems });
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

    const totalValue = useMemo(() => (order.items || []).reduce((sum, item) => sum + item.price * item.quantity, 0), [order.items]);

    const handleSaveOrder = async () => {
        if (!order.customerName) { showNotification('Proszę podać nazwę klienta.', 'error'); return; }
        try {
            const orderToSave = { ...order, author: user.username };
            const { message, order: savedOrder } = await api.saveOrder(orderToSave);
            showNotification(message, 'success');
            updateOrder(savedOrder);
        } catch (error) { showNotification(error.message, 'error'); }
    };

    const handleNewOrder = async () => {
        if (order._id && (order.customerName || (order.items && order.items.length > 0))) { await handleSaveOrder(); }
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
        const headers = ["Nazwa", "Kod produktu", "Kody EAN", "Cena", "Ilość", "Wartość", "Notatka"];
        const data = (order.items || []).map(item => [`"${item.name.replace(/"/g, '""')}"`, item.product_code, `"${(item.barcodes || []).join(',')}"`, item.price.toFixed(2), item.quantity, (item.price * item.quantity).toFixed(2), `"${(item.note || '').replace(/"/g, '""')}"`]);
        const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
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

    const handleFileImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const { items, notFound } = await api.importOrderFromCsv(file);
            updateOrder({ ...order, items: items });
            showNotification(`Zaimportowano ${items.length} pozycji.`, 'success');
            if (notFound.length > 0) {
                showNotification(`Nie znaleziono produktów dla kodów: ${notFound.join(', ')}`, 'error');
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
        event.target.value = null;
    };

    return (
        <>
            <div className="p-4 md:p-8">
                <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{order._id ? `Edycja Zamówienia` : 'Nowe Zamówienie'}</h1>
                    <div className="flex gap-2">
                        <input type="file" ref={importFileRef} onChange={handleFileImport} className="hidden" accept=".csv" />
                        <button onClick={() => importFileRef.current.click()} className="flex items-center justify-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors">
                            <FileUp className="w-5 h-5 mr-2"/> Importuj
                        </button>
                        <button onClick={handleNewOrder} className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            <PlusCircle className="w-5 h-5 mr-2"/> Nowa Lista
                        </button>
                    </div>
                </div>
                <input type="text" value={order.customerName || ''} onChange={(e) => updateOrder({ ...order, customerName: e.target.value })} placeholder="Wprowadź nazwę klienta" className="w-full max-w-lg p-3 mb-6 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                
                <div className="mb-6">
                    <SearchView onProductSelect={addProductToOrder} />
                </div>

                <div ref={printRef} className="flex-grow bg-gray-50 dark:bg-gray-900 p-4 rounded-lg shadow-inner mb-4 mt-6">
                    <div className="print-header hidden p-4"><h2 className="text-2xl font-bold">Zamówienie dla: {order.customerName}</h2><p>Data: {new Date().toLocaleDateString()}</p></div>
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
                <div className="flex flex-wrap justify-end items-center gap-4 mt-4">
                    <span className="text-lg font-bold text-gray-700 dark:text-gray-300">Suma:</span>
                    <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalValue.toFixed(2)} PLN</span>
                </div>
                 <div className="flex flex-wrap justify-end space-x-3 mt-4">
                    <button onClick={handleSaveOrder} className="flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Save className="w-5 h-5 mr-2"/> Zapisz</button>
                    <button onClick={handleExportCsv} className="flex items-center justify-center px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><FileDown className="w-5 h-5 mr-2"/> CSV</button>
                    <button onClick={handlePrint} className="flex items-center justify-center px-5 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"><Printer className="w-5 h-5 mr-2"/> Drukuj</button>
                </div>
            </div>
            <Modal isOpen={noteModal.isOpen} onClose={() => setNoteModal({ isOpen: false, itemIndex: null, text: '' })} title="Dodaj notatkę do pozycji">
                <textarea value={noteModal.text} onChange={(e) => setNoteModal({...noteModal, text: e.target.value})} className="w-full p-2 border rounded-md min-h-[100px] bg-white dark:bg-gray-700"></textarea>
                <div className="flex justify-end gap-4 mt-4"><button onClick={() => setNoteModal({ isOpen: false, itemIndex: null, text: '' })} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={handleNoteSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz notatkę</button></div>
            </Modal>
        </>
    );
};

const OrdersListView = ({ onEdit }) => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState('Zapisane');
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, orderId: null });
    const { showNotification } = useNotification();
    const [filters, setFilters] = useState({ customer: '', author: '', dateFrom: '', dateTo: '' });
    const [showFilters, setShowFilters] = useState(false);

    const fetchOrders = useCallback(async () => {
        console.log(`OrdersListView: Rozpoczynam pobieranie zamówień (status: ${view})...`);
        setIsLoading(true);
        try {
            const queryParams = { status: view, ...filters };
            const fetchedOrders = await api.getOrders(queryParams);
            setOrders(fetchedOrders);
            console.log(`OrdersListView: Pomyślnie pobrano ${fetchedOrders.length} zamówień.`);
        } catch (error) {
            console.error("OrdersListView: Błąd podczas pobierania zamówień:", error);
            showNotification(error.message, 'error');
        } finally {
            console.log("OrdersListView: Zakończono próbę pobierania zamówień.");
            setIsLoading(false);
        }
    }, [view, filters, showNotification]);

    useEffect(() => {
        let isMounted = true;
        if (isMounted) {
            fetchOrders();
        }
        return () => {
            isMounted = false;
        };
    }, [fetchOrders]);
    
    const handleDelete = async () => {
        try {
            await api.deleteOrder(deleteModal.orderId);
            showNotification('Zamówienie usunięte!', 'success');
            setDeleteModal({ isOpen: false, orderId: null });
            fetchOrders();
        } catch (error) { showNotification(error.message, 'error'); }
    };
    
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({...prev, [name]: value}));
    };
    
    const resetFilters = () => {
        setFilters({ customer: '', author: '', dateFrom: '', dateTo: '' });
    };

    return (
        <>
            <div className="p-4 md:p-8">
                <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Zamówienia</h1>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"><Filter className="w-5 h-5 mr-2"/> Filtry</button>
                        <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                            <button onClick={() => setView('Zapisane')} className={`px-4 py-2 text-sm font-semibold rounded-md ${view === 'Zapisane' ? 'bg-white dark:bg-gray-900 text-indigo-600' : 'text-gray-500'}`}>Zapisane</button>
                            <button onClick={() => setView('Skompletowane')} className={`px-4 py-2 text-sm font-semibold rounded-md ${view === 'Skompletowane' ? 'bg-white dark:bg-gray-900 text-indigo-600' : 'text-gray-500'}`}>Skompletowane</button>
                        </div>
                    </div>
                </div>
                {showFilters && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6 shadow-sm animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <input type="text" name="customer" value={filters.customer} onChange={handleFilterChange} placeholder="Klient" className="p-2 border rounded-md bg-white dark:bg-gray-700"/>
                            <input type="text" name="author" value={filters.author} onChange={handleFilterChange} placeholder="Autor" className="p-2 border rounded-md bg-white dark:bg-gray-700"/>
                            <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} className="p-2 border rounded-md bg-white dark:bg-gray-700"/>
                            <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} className="p-2 border rounded-md bg-white dark:bg-gray-700"/>
                        </div>
                        <div className="flex justify-end gap-2 mt-4"><button onClick={resetFilters} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg text-sm">Wyczyść filtry</button></div>
                    </div>
                )}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-4 font-semibold">Klient</th><th className="p-4 font-semibold">Autor</th><th className="p-4 font-semibold">Data</th><th className="p-4 font-semibold text-right">Wartość</th><th className="p-4 font-semibold text-center">Akcje</th></tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {isLoading ? (<tr><td colSpan="5" className="p-8 text-center text-gray-500">Ładowanie...</td></tr>) : orders.length > 0 ? (orders.map(order => (
                                <tr key={order._id}>
                                    <td className="p-4 font-medium">{order.customerName}</td><td className="p-4">{order.author}</td><td className="p-4">{new Date(order.date).toLocaleDateString()}</td><td className="p-4 text-right font-semibold">{(order.total || 0).toFixed(2)} PLN</td>
                                    <td className="p-4 text-center whitespace-nowrap">
                                        <button onClick={() => onEdit(order._id)} className="inline-flex items-center justify-center mx-auto px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 mr-2"><Edit className="w-4 h-4 mr-1" /> {view === 'Skompletowane' ? 'Pokaż' : 'Edytuj'}</button>
                                        <button onClick={() => setDeleteModal({ isOpen: true, orderId: order._id })} className="inline-flex items-center justify-center mx-auto px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"><Trash2 className="w-4 h-4 mr-1" /> Usuń</button>
                                    </td>
                                </tr>
                            ))) : (<tr><td colSpan="5" className="p-8 text-center text-gray-500">Brak zamówień pasujących do kryteriów.</td></tr>)}
                        </tbody>
                    </table>
                </div>
            </div>
            <Modal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false, orderId: null })} title="Potwierdź usunięcie">
                <p>Czy na pewno chcesz usunąć to zamówienie? Tej operacji nie można cofnąć.</p>
                <div className="flex justify-end gap-4 mt-6"><button onClick={() => setDeleteModal({ isOpen: false, orderId: null })} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg">Usuń</button></div>
            </Modal>
        </>
    );
};

const PickingView = () => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [toPickItems, setToPickItems] = useState([]);
    const [pickedItems, setPickedItems] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [pickedQuantity, setPickedQuantity] = useState('');
    const { showNotification } = useNotification();
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const searchInputRef = useRef(null);

    const fetchOrders = useCallback(async () => {
        console.log("PickingView: Rozpoczynam pobieranie zamówień do kompletacji...");
        setIsLoading(true);
        try {
            const fetchedOrders = await api.getOrders({ status: 'Zapisane' });
            setOrders(fetchedOrders);
            console.log(`PickingView: Pomyślnie pobrano ${fetchedOrders.length} zamówień.`);
        } catch (error) { 
            console.error("PickingView: Błąd podczas pobierania zamówień:", error);
            showNotification(error.message, 'error'); 
        } finally { 
            console.log("PickingView: Zakończono próbę pobierania zamówień.");
            setIsLoading(false); 
        }
    }, [showNotification]);
    useEffect(() => {
        let isMounted = true;
        if (isMounted) {
            fetchOrders();
        }
        return () => {
            isMounted = false;
        };
    }, [fetchOrders]);
    useEffect(() => {
        if (!selectedOrder || inputValue.length < 2) { setSuggestions([]); return; }
        const availableSuggestions = toPickItems.filter(item => 
            item.name.toLowerCase().includes(inputValue.toLowerCase()) || 
            (item.product_code && item.product_code.toLowerCase().includes(inputValue.toLowerCase())) ||
            (item.barcodes && item.barcodes.some(b => b.includes(inputValue)))
        );
        setSuggestions(availableSuggestions);
    }, [inputValue, toPickItems, selectedOrder]);

    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
        const itemsWithOriginalQty = order.items.map(item => ({...item, originalQuantity: item.quantity }));
        setToPickItems(itemsWithOriginalQty);
        setPickedItems([]);
        setTimeout(() => searchInputRef.current?.focus(), 100);
    };
    
    const openModal = (item) => {
        setCurrentItem(item);
        setPickedQuantity(String(item.quantity));
        setIsModalOpen(true);
    };

    const handleConfirmPick = () => {
        const quantity = parseInt(pickedQuantity, 10);
        if (isNaN(quantity) || quantity < 0) { showNotification("Proszę wpisać poprawną ilość.", 'error'); return; }
        setPickedItems(prev => [...prev, { ...currentItem, pickedQuantity: quantity }]);
        setToPickItems(prev => prev.filter(item => item._id !== currentItem._id));
        setIsModalOpen(false);
        setCurrentItem(null);
        setPickedQuantity('');
        setInputValue('');
        searchInputRef.current?.focus();
    };

    const handlePickItem = (itemToPick) => {
        openModal(itemToPick);
        setInputValue('');
        setSuggestions([]);
    };
    
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && inputValue.trim() !== '') {
            e.preventDefault();
            if (suggestions.length === 1) { handlePickItem(suggestions[0]); }
        }
    };

    const handleCompleteOrder = async () => {
        try {
            await api.completeOrder(selectedOrder._id, pickedItems);
            showNotification('Zamówienie zostało skompletowane!', 'success');
            setSelectedOrder(null);
            setToPickItems([]);
            setPickedItems([]);
            fetchOrders();
        } catch (error) { showNotification(error.message, 'error'); }
    };
    const exportCompletion = () => {
        const csvData = pickedItems.map(item => `${(item.barcodes && item.barcodes[0]) || ''},${item.pickedQuantity}`).join('\n');
        const blob = new Blob([`\uFEFF${csvData}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `kompletacja_${selectedOrder.id}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleUndoPick = (itemToUndo) => {
        setPickedItems(prev => prev.filter(item => item._id !== itemToUndo._id));
        setToPickItems(prev => [...prev, itemToUndo]);
    };

    const isCompleted = toPickItems.length === 0 && selectedOrder;
    if (isLoading) { return <div className="p-8 text-center">Ładowanie zamówień...</div> }
    if (!selectedOrder) {
        return (
            <div className="p-4 md:p-8">
                <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Kompletacja Zamówień</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {orders.map(order => (
                        <div key={order._id} onClick={() => handleSelectOrder(order)} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md cursor-pointer hover:shadow-lg hover:scale-105 transition-all">
                            <p className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{order.customerName}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Autor: {order.author}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(order.date).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-8">
            <button onClick={() => setSelectedOrder(null)} className="mb-4 text-indigo-600 dark:text-indigo-400 hover:underline">&larr; Powrót do listy zamówień</button>
            <h1 className="text-3xl font-bold mb-2 text-gray-800 dark:text-white">Kompletacja: {selectedOrder.id}</h1>
            <p className="mb-6 text-gray-600 dark:text-gray-400">Klient: {selectedOrder.customerName}</p>
            <div className="relative max-w-xl mb-8">
                <input type="text" ref={searchInputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder="Skanuj lub wyszukaj produkt..." className="w-full p-4 bg-white dark:bg-gray-700 border rounded-lg"/>
                {suggestions.length > 0 && <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border rounded-lg shadow-xl max-h-60 overflow-y-auto">{suggestions.map(p => <li key={p._id} onClick={() => handlePickItem(p)} className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"><p className="font-semibold">{p.name}</p></li>)}</ul>}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-2xl font-semibold mb-4">Do skompletowania ({toPickItems.length})</h2>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3 max-h-96 overflow-y-auto">{toPickItems.map(item => <div key={item._id} onClick={() => openModal(item)} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"><div><p className="font-semibold">{item.name}</p><p className="text-sm text-gray-500">{item.product_code}</p></div><div className="text-lg font-bold px-3 py-1 bg-blue-100 text-blue-800 rounded-full">{item.quantity}</div></div>)} {toPickItems.length === 0 && <p className="text-center text-gray-500 p-4">Wszystko skompletowane.</p>}</div>
                </div>
                <div>
                    <h2 className="text-2xl font-semibold mb-4">Skompletowano ({pickedItems.length})</h2>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3 max-h-96 overflow-y-auto">{pickedItems.map(item => { const isMismatch = item.pickedQuantity !== item.originalQuantity; return (<div key={item._id} className={`flex justify-between items-center p-3 rounded-lg ${isMismatch ? 'bg-red-50' : 'bg-green-50'}`}><div><p className="font-semibold">{item.name}</p><p className="text-sm text-gray-500">{item.product_code}</p></div><div className="flex items-center gap-2"><Tooltip text="Cofnij"><button onClick={() => handleUndoPick(item)} className="p-1 text-gray-500 hover:text-blue-600"><RotateCcw className="w-4 h-4" /></button></Tooltip><div className={`text-lg font-bold px-3 py-1 rounded-full flex items-center gap-2 ${isMismatch ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{isMismatch && <AlertTriangle className="w-4 h-4" />} {item.pickedQuantity} / {item.originalQuantity}</div></div></div>);})} {pickedItems.length === 0 && <p className="text-center text-gray-500 p-4">Brak pozycji.</p>}</div>
                </div>
            </div>
            {isCompleted && <div className="mt-8 text-center p-6 bg-green-100 rounded-lg"><CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" /><h3 className="text-2xl font-bold text-green-800">Zamówienie skompletowane!</h3><div className="mt-4 flex justify-center gap-4"><button onClick={handleCompleteOrder} className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg">Zatwierdź</button><button onClick={exportCompletion} className="flex items-center justify-center px-5 py-2.5 bg-green-600 text-white rounded-lg"><FileDown className="w-5 h-5 mr-2"/> Eksportuj</button></div></div>}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Wpisz ilość">{currentItem && (<div><p className="mb-4 text-lg font-semibold">{currentItem.name}</p><input type="number" value={pickedQuantity} onChange={(e) => setPickedQuantity(e.target.value)} className="w-full p-3 bg-white border rounded-lg text-center text-2xl" autoFocus onKeyPress={(e) => e.key === 'Enter' && handleConfirmPick()}/><button onClick={handleConfirmPick} className="w-full mt-4 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg">Akceptuj</button></div>)}</Modal>
        </div>
    );
};

const InventoryView = ({ user }) => {
    const [view, setView] = useState('list');
    const [inventories, setInventories] = useState([]);
    const [currentInventory, setCurrentInventory] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();

    const fetchInventories = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getInventories();
            setInventories(data);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showNotification]);

    useEffect(() => {
        if (view === 'list') {
            fetchInventories();
        }
    }, [view, fetchInventories]);

    const handleViewDetails = async (id) => {
        try {
            const data = await api.getInventoryById(id);
            setCurrentInventory(data);
            setView('details');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    if (isLoading && view === 'list') {
        return <div className="p-8 text-center">Ładowanie...</div>;
    }

    if (view === 'new') {
        return <NewInventorySheet user={user} onSave={() => setView('list')} />;
    }

    if (view === 'details' && currentInventory) {
        return <InventoryDetails inventory={currentInventory} onBack={() => setView('list')} />;
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Zapisane inwentaryzacje</h1>
                <button onClick={() => setView('new')} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <PlusCircle className="w-5 h-5 mr-2"/> Nowa inwentaryzacja
                </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-4">Nazwa</th><th className="p-4">Autor</th><th className="p-4">Data</th><th className="p-4">Pozycje</th><th className="p-4">Sztuki</th><th className="p-4">Akcje</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {inventories.map(inv => (
                            <tr key={inv._id}>
                                <td className="p-4 font-medium">{inv.name}</td>
                                <td className="p-4">{inv.author}</td>
                                <td className="p-4">{format(new Date(inv.date), 'd MMM yy, HH:mm', { locale: pl })}</td>
                                <td className="p-4">{inv.totalItems}</td>
                                <td className="p-4">{inv.totalQuantity}</td>
                                <td className="p-4"><button onClick={() => handleViewDetails(inv._id)} className="p-2 text-blue-500 hover:text-blue-700"><Eye className="w-5 h-5"/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const NewInventorySheet = ({ user, onSave }) => {
    const [listName, setListName] = useState('');
    const [inventoryItems, setInventoryItems] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const { showNotification } = useNotification();
    const listEndRef = useRef(null);

    const scrollToBottom = () => listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(scrollToBottom, [inventoryItems]);

    useEffect(() => {
        if (inputValue.length < 2) { setSuggestions([]); return; }
        const handler = setTimeout(async () => {
            try {
                const results = await api.searchProducts(inputValue);
                setSuggestions(results);
            } catch (error) { console.error('Błąd wyszukiwania w Inwentaryzacji', error); }
        }, 300);
        return () => clearTimeout(handler);
    }, [inputValue]);

    const addProductToInventory = (product) => {
        const existingItem = inventoryItems.find(item => item._id === product._id);
        if (existingItem) {
            setInventoryItems(inventoryItems.map(item => item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setInventoryItems([...inventoryItems, { ...product, quantity: 1, isCustom: false }]);
        }
        setInputValue('');
        setSuggestions([]);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && inputValue.trim() !== '') {
            e.preventDefault();
            if (suggestions.length > 0) { addProductToInventory(suggestions[0]); }
            else {
                const customItem = { _id: `custom-${Date.now()}`, name: inputValue, product_code: 'N/A', barcodes: [], quantity: 1, isCustom: true };
                setInventoryItems([...inventoryItems, customItem]);
                setInputValue('');
                setSuggestions([]);
            }
        }
    };

    const updateQuantity = (id, newQuantity) => {
        const quant = parseInt(newQuantity, 10);
        if (!isNaN(quant) && quant >= 0) {
            setInventoryItems(inventoryItems.map(item => item._id === id ? {...item, quantity: quant} : item));
        }
    };

    const removeItem = (id) => setInventoryItems(inventoryItems.filter(item => item._id !== id));
    
    const handleSave = async () => {
        if (!listName) {
            showNotification('Proszę podać nazwę inwentaryzacji.', 'error');
            return;
        }
        if (inventoryItems.length === 0) {
            showNotification('Lista inwentaryzacyjna jest pusta.', 'error');
            return;
        }
        try {
            await api.saveInventory({ name: listName, items: inventoryItems });
            showNotification('Inwentaryzacja została pomyślnie zapisana.', 'success');
            onSave();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleExport = () => {
        const csvData = inventoryItems.map(item => `${(item.barcodes && item.barcodes[0]) || ''},${item.quantity}`).join('\n');
        const blob = new Blob([`\uFEFF${csvData}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `inwentaryzacja_${listName.replace(/\s/g, '_') || 'lista'}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (<div className="h-full flex flex-col"><div className="p-4 md:p-8 pb-36"><div className="flex-shrink-0"><h1 className="text-3xl font-bold mb-4">Nowa Inwentaryzacja</h1><input type="text" value={listName} onChange={(e) => setListName(e.target.value)} placeholder="Wprowadź nazwę listy spisowej" className="w-full max-w-lg p-3 mb-6 bg-white dark:bg-gray-700 border rounded-lg"/></div><div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 rounded-lg shadow-inner mb-4">{inventoryItems.length > 0 ? <table className="w-full text-left"><thead><tr className="border-b"><th className="p-3">Nazwa</th><th className="p-3">Kod produktu</th><th className="p-3 text-center">Ilość</th><th className="p-3 text-center">Akcje</th></tr></thead><tbody>{inventoryItems.map(item => <tr key={item._id} className={`border-b last:border-0 ${item.isCustom ? 'text-red-500' : ''}`}><td className="p-2 font-medium">{item.name}</td><td className="p-2">{item.product_code}</td><td className="p-2 text-center"><input type="number" value={item.quantity} onChange={(e) => updateQuantity(item._id, e.target.value)} className="w-20 text-center bg-transparent border rounded-md p-1"/></td><td className="p-2 text-center"><button onClick={() => removeItem(item._id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-5 h-5" /></button></td></tr>)}</tbody></table> : <p className="text-center text-gray-500">Brak pozycji na liście.</p>}<div ref={listEndRef} /></div><div className="flex gap-4"><button onClick={handleSave} className="flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Save className="w-5 h-5 mr-2"/> Zapisz inwentaryzację</button><button onClick={handleExport} className="flex items-center justify-center px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"><FileDown className="w-5 h-5 mr-2"/> Eksportuj (EAN, Ilość)</button></div></div><div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 bg-white dark:bg-gray-800 border-t z-20"><div className="max-w-4xl mx-auto relative"><input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder="Dodaj produkt (zatwierdź Enterem)" className="w-full p-4 bg-gray-100 dark:bg-gray-700 border rounded-lg"/>{suggestions.length > 0 && <ul className="absolute bottom-full mb-2 w-full bg-white dark:bg-gray-700 border rounded-lg shadow-xl max-h-60 overflow-y-auto z-30">{suggestions.map(p => <li key={p._id} onClick={() => addProductToInventory(p)} className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-b"><p className="font-semibold">{p.name}</p><p className="text-sm text-gray-500">{p.product_code}</p></li>)}</ul>}</div></div></div>);
};

const InventoryDetails = ({ inventory, onBack }) => {
    return (
        <div className="p-4 md:p-8">
            <button onClick={onBack} className="mb-4 text-indigo-600 hover:underline">&larr; Powrót do listy</button>
            <h1 className="text-3xl font-bold">{inventory.name}</h1>
            <p className="text-gray-500">Autor: {inventory.author} | Data: {format(new Date(inventory.date), 'd MMM Indyjski, HH:mm', { locale: pl })}</p>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto mt-6">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-4">Nazwa</th><th className="p-4">Kod produktu</th><th className="p-4">Kody EAN</th><th className="p-4 text-center">Ilość</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {inventory.items.map((item, index) => (
                            <tr key={item._id || index}>
                                <td className="p-4">{item.name}</td>
                                <td className="p-4">{item.product_code}</td>
                                <td className="p-4">{(item.barcodes || []).join(', ')}</td>
                                <td className="p-4 text-center">{item.quantity}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AdminView = ({ user }) => {
    const [users, setUsers] = useState([]);
    const { showNotification } = useNotification();
    const [modalState, setModalState] = useState({ isOpen: false, user: null, type: '' });
    const [newPassword, setNewPassword] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [importMode, setImportMode] = useState('append');

    const fetchUsers = useCallback(async () => {
        try {
            const userList = await api.getUsers();
            setUsers(userList);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }, [showNotification]);
    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleApproveUser = async (userId) => {
        try { await api.approveUser(userId); showNotification('Użytkownik został zaakceptowany!', 'success'); fetchUsers(); }
        catch (error) { showNotification(error.message, 'error'); }
    };
    
    const handleRoleChange = async (userId, newRole) => {
        try { await api.changeUserRole(userId, newRole); showNotification('Rola użytkownika została zmieniona!', 'success'); fetchUsers(); }
        catch (error) { showNotification(error.message, 'error'); }
    };

    const handleDeleteUser = async (userId) => {
        try { await api.deleteUser(userId); showNotification('Użytkownik został usunięty!', 'success'); setModalState({ isOpen: false, user: null, type: '' }); fetchUsers(); }
        catch (error) { showNotification(error.message, 'error'); }
    };

    const handleChangePassword = async () => {
        if (newPassword.length < 6) { showNotification('Nowe hasło musi mieć co najmniej 6 znaków.', 'error'); return; }
        try { await api.changePassword(modalState.user._id, newPassword); showNotification('Hasło zostało zmienione!', 'success'); setModalState({ isOpen: false, user: null, type: '' }); setNewPassword(''); }
        catch (error) { showNotification(error.message, 'error'); }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const result = await api.uploadProductsFile(file, importMode);
            showNotification(result.message, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsUploading(false);
            e.target.value = null;
        }
    };

    const handleMergeProducts = async () => {
        if (window.confirm("Czy na pewno chcesz połączyć produkty? Ta operacja jest nieodwracalna i może znacząco zmienić bazę danych produktów.")) {
            setIsMerging(true);
            try {
                const result = await api.mergeProducts();
                showNotification(result.message, 'success');
            } catch (error) {
                showNotification(error.message, 'error');
            } finally {
                setIsMerging(false);
            }
        }
    };

    return (
        <>
            <div className="p-4 md:p-8">
                <h1 className="text-3xl font-bold mb-6">Panel Administratora</h1>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <h2 className="text-2xl font-semibold mb-4">Zarządzanie Użytkownikami</h2>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-4 font-semibold">Użytkownik</th><th className="p-4 font-semibold">Status</th><th className="p-4 font-semibold">Rola</th><th className="p-4 font-semibold text-right">Akcje</th></tr></thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {users.map(u => (
                                        <tr key={u._id}>
                                            <td className="p-4 font-medium">{u.username}</td>
                                            <td className="p-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${u.status === 'oczekujący' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{u.status}</span></td>
                                            <td className="p-4">
                                                <select value={u.role} onChange={(e) => handleRoleChange(u._id, e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" disabled={user.id === u._id}><option value="user">Użytkownik</option><option value="administrator">Administrator</option></select>
                                            </td>
                                            <td className="p-4 text-right whitespace-nowrap">
                                                {u.status === 'oczekujący' && (<button onClick={() => handleApproveUser(u._id)} className="px-3 py-1 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 mr-2">Akceptuj</button>)}
                                                <Tooltip text="Zmień hasło"><button onClick={() => setModalState({ isOpen: true, user: u, type: 'password' })} className="p-2 text-gray-500 hover:text-blue-500"><KeyRound className="w-5 h-5" /></button></Tooltip>
                                                {user.id !== u._id && (<Tooltip text="Usuń użytkownika"><button onClick={() => setModalState({ isOpen: true, user: u, type: 'delete' })} className="p-2 text-gray-500 hover:text-red-500"><Trash2 className="w-5 h-5" /></button></Tooltip>)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold mb-4">Zarządzanie Bazą Danych</h2>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
                            <div className="border border-dashed p-6 rounded-lg text-center">
                                <h3 className="text-lg font-medium mb-2">Import produktów z CSV</h3>
                                <p className="text-sm text-gray-500 mb-4">Kolumny: barcode, name, price, product_code, quantity, availability</p>
                                <div className="flex justify-center gap-4 mb-4">
                                    <label className="flex items-center"><input type="radio" name="importMode" value="append" checked={importMode === 'append'} onChange={() => setImportMode('append')} className="mr-2"/>Dopisz / Zaktualizuj</label>
                                    <label className="flex items-center"><input type="radio" name="importMode" value="overwrite" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} className="mr-2"/>Nadpisz wszystko</label>
                                </div>
                                <label className={`cursor-pointer px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 inline-flex items-center ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <Upload className={`w-4 h-4 mr-2 ${isUploading ? 'animate-spin' : ''}`}/> {isUploading ? 'Przetwarzanie...' : 'Wybierz plik'}
                                    <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={isUploading} />
                                </label>
                            </div>
                            <div className="border border-dashed p-6 rounded-lg text-center">
                                <h3 className="text-lg font-medium mb-2">Operacje na danych</h3>
                                <p className="text-sm text-gray-500 mb-4">Połącz produkty z tym samym kodem produktu w jedną pozycję.</p>
                                <button onClick={handleMergeProducts} disabled={isMerging} className="flex items-center justify-center mx-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400">
                                    <GitMerge className={`w-5 h-5 mr-2 ${isMerging ? 'animate-spin' : ''}`} />
                                    {isMerging ? 'Przetwarzanie...' : 'Połącz produkty'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Modal isOpen={modalState.isOpen && modalState.type === 'delete'} onClose={() => setModalState({isOpen: false, user: null, type: ''})} title="Potwierdź usunięcie"><p>Czy na pewno chcesz usunąć użytkownika <strong>{modalState.user?.username}</strong>? Tej operacji nie można cofnąć.</p><div className="flex justify-end gap-4 mt-6"><button onClick={() => setModalState({isOpen: false, user: null, type: ''})} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={() => handleDeleteUser(modalState.user._id)} className="px-4 py-2 bg-red-600 text-white rounded-lg">Usuń</button></div></Modal>
            <Modal isOpen={modalState.isOpen && modalState.type === 'password'} onClose={() => setModalState({isOpen: false, user: null, type: ''})} title={`Zmień hasło dla ${modalState.user?.username}`}><div><label className="block mb-2 text-sm font-medium">Nowe hasło</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"/></div><div className="flex justify-end gap-4 mt-6"><button onClick={() => setModalState({isOpen: false, user: null, type: ''})} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={handleChangePassword} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zmień hasło</button></div></Modal>
        </>
    );
};

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

const HomeView = ({ user, setActiveView }) => {
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchStats = async () => {
            console.log("HomeView: Rozpoczynam pobieranie statystyk...");
            setIsLoading(true);
            try {
                const data = await api.getDashboardStats();
                if (isMounted) {
                    setStats(data);
                    console.log("HomeView: Statystyki pobrane pomyślnie.", data);
                }
            } catch (error) {
                if (isMounted) {
                    console.error("HomeView: Błąd podczas pobierania statystyk:", error);
                    showNotification(error.message, 'error');
                }
            } finally {
                if (isMounted) {
                    console.log("HomeView: Zakończono próbę pobierania statystyk.");
                    setIsLoading(false);
                }
            }
        };
        fetchStats();
        return () => { isMounted = false; }
    }, [showNotification]);

    const StatCard = ({ title, value, icon, color, onClick }) => (
        <div onClick={onClick} className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex items-center text-left transition-all hover:shadow-xl hover:scale-105 ${onClick ? 'cursor-pointer' : ''}`}>
            <div className={`p-4 ${color} rounded-full`}>{icon}</div>
            <div className="ml-4">
                <p className="text-3xl font-bold">{isLoading ? '...' : value}</p>
                <p className="text-gray-500">{title}</p>
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl md:text-4xl font-bold">Witaj, {user.username}!</h1>
            <p className="mt-2 text-lg text-gray-500">{format(time, 'eeee, d MMMMurupani, HH:mm:ss', { locale: pl })}</p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Zamówień do skompletowania" value={stats?.pendingOrders} icon={<List className="h-8 w-8 text-orange-600" />} color="bg-orange-100" onClick={() => setActiveView('picking')} />
                <StatCard title="Skompletowane zamówienia" value={stats?.completedOrders} icon={<CheckCircle className="h-8 w-8 text-green-600" />} color="bg-green-100" onClick={() => setActiveView('orders')} />
            </div>
            <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4">Aktywność użytkowników</h2>
                {isLoading ? <p>Ładowanie statystyk...</p> : (
                    <ul className="space-y-2">
                        {(stats?.ordersByAuthor || []).map(authorStat => (
                            <li key={authorStat._id} className="flex justify-between items-center p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                                <span className="font-medium">{authorStat._id}</span>
                                <span className="font-bold text-lg">{authorStat.count} zam.</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

// --- Główny Komponent Aplikacji ---
function App() {
    const [user, setUser] = useState(null);
    const [activeView, setActiveView] = useState('home');
    const [currentOrder, setCurrentOrder] = useState({ customerName: '', items: [] });
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isNavOpen, setIsNavOpen] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') setIsDarkMode(true);
    }, []);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        setUser(null);
        setIsLoading(false);
        setActiveView('home');
    }, []);

    const handleLogin = useCallback((data) => {
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        setUser(data.user);
        setIsLoading(false);
        setActiveView('home');
    }, []);

    useEffect(() => {
        console.log("APP START: Sprawdzanie tokenu...");
        const token = localStorage.getItem('userToken');
        const userData = localStorage.getItem('userData');
        if (token && userData) {
            console.log("APP START: Znaleziono token i dane użytkownika.");
            try {
                const user = JSON.parse(userData);
                if (user && user.id) {
                    console.log("APP START: Dane użytkownika poprawne. Logowanie...");
                    handleLogin({ token, user });
                } else {
                    console.error("APP START: Dane użytkownika w localStorage są niekompletne.");
                    handleLogout();
                }
            } catch (e) {
                console.error("APP START: Błąd parsowania danych użytkownika z localStorage:", e);
                handleLogout();
            }
        } else {
            console.log("APP START: Brak tokenu lub danych użytkownika. Przejście do logowania.");
            setIsLoading(false);
        }
    }, [handleLogin, handleLogout]);
    
    const loadOrderForEditing = async (orderId) => {
        try {
            const order = await api.getOrderById(orderId);
            setCurrentOrder(order);
            setActiveView('order');
        } catch (error) {
            console.error("Błąd ładowania zamówienia", error);
        }
    };

    if (isLoading) { return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">Ładowanie...</div> }
    if (!user) { return <AuthPage onLogin={handleLogin} />; }

    const navItems = [
        { id: 'home', label: 'Panel Główny', icon: Home, roles: ['user', 'administrator'] },
        { id: 'search', label: 'Wyszukiwarka', icon: Search, roles: ['user', 'administrator'] },
        { id: 'order', label: 'Nowe Zamówienie', icon: PlusCircle, roles: ['user', 'administrator'], action: () => { setCurrentOrder({ customerName: '', items: [] }); setActiveView('order'); } },
        { id: 'orders', label: 'Zamówienia', icon: Archive, roles: ['user', 'administrator'] },
        { id: 'picking', label: 'Kompletacja', icon: List, roles: ['user', 'administrator'] },
        { id: 'inventory', label: 'Inwentaryzacja', icon: Wrench, roles: ['user', 'administrator'] },
        { id: 'admin', label: 'Panel Admina', icon: User, roles: ['administrator'] },
    ];
    
    const availableNavItems = navItems.filter(item => item.roles.includes(user.role));

    const renderView = () => {
        switch (activeView) {
            case 'home': return <HomeView user={user} setActiveView={setActiveView} />;
            case 'search': return <MainSearchView />;
            case 'order': return <OrderView currentOrder={currentOrder} setCurrentOrder={setCurrentOrder} user={user} />;
            case 'orders': return <OrdersListView onEdit={loadOrderForEditing} />;
            case 'picking': return <PickingView />;
            case 'inventory': return <InventoryView user={user} />;
            case 'admin': return <AdminView user={user} />;
            default: return <HomeView user={user} setActiveView={setActiveView} />;
        }
    };

    return (
        <>
            <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
                <nav className={`w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out z-40 fixed lg:static h-full ${isNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
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
                        <button onClick={() => setIsNavOpen(!isNavOpen)} className="p-2 rounded-md"><Menu className="h-6 w-6" /></button>
                    </div>
                    <div className="flex-1 overflow-x-hidden overflow-y-auto">{renderView()}</div>
                </main>
            </div>
            <UserChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
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
        if (newPassword.length < 6) { setError('Nowe hasło musi mieć co najmniej 6 znaków.'); return; }
        try {
            await api.userChangeOwnPassword(currentPassword, newPassword);
            showNotification('Hasło zostało zmienione pomyślnie!', 'success');
            onClose();
        } catch (err) { setError(err.message); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Zmień swoje hasło">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block mb-2 text-sm font-medium">Aktualne hasło</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" required /></div>
                <div><label className="block mb-2 text-sm font-medium">Nowe hasło</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" required /></div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zmień hasło</button></div>
            </form>
        </Modal>
    );
};

export default function AppWrapper() {
    return (
        <ErrorBoundary>
            <NotificationProvider>
                <App />
            </NotificationProvider>
        </ErrorBoundary>
    );
}
