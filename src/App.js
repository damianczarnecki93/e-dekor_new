import React, { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } from 'react';
import { Search, Package, List, Wrench, User, Sun, Moon, LogOut, FileDown, Printer, Save, CheckCircle, AlertTriangle, Upload, Trash2, XCircle } from 'lucide-react';

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
                <div className={`fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg text-white animate-fade-in-out ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
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
const api = {
    getProducts: async () => {
        try {
            // UWAGA: Przed wdrożeniem produkcyjnym zmień ten adres na URL Twojego backendu na Render.com
            // const response = await fetch('https://twoj-backend.onrender.com/api/products');
            const response = await fetch('https://dekor.onrender.com/api/products');
            if (!response.ok) throw new Error('Błąd pobierania produktów');
            return await response.json();
        } catch (error) {
            console.error("API Error getProducts:", error);
            throw error;
        }
    },
    saveOrder: async (order, token) => {
        try {
            const response = await fetch('https://dekor.onrender.com/api/orders', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(order),
            });
            if (!response.ok) throw new Error('Błąd zapisywania zamówienia');
            return await response.json();
        } catch (error) {
            console.error("API Error saveOrder:", error);
            throw error;
        }
    },
    getOrders: async (token) => {
        try {
            const response = await fetch('https://dekor.onrender.com/api/orders', {
                 headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Błąd pobierania zamówień');
            return await response.json();
        } catch (error) {
            console.error("API Error getOrders:", error);
            throw error;
        }
    },
    login: async (username, password) => {
        try {
            const response = await fetch('https://dekor.onrender.com/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            
            if (response.ok) {
                return await response.json();
            } else {
                // POPRAWKA: Bezpieczne parsowanie odpowiedzi błędu
                const errorText = await response.text();
                try {
                    // Spróbuj sparsować tekst jako JSON
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.message || `Błąd serwera: ${response.status}`);
                } catch (e) {
                    // Jeśli parsowanie się nie uda (np. pusty tekst), rzuć ogólny błąd
                    throw new Error(`Błąd logowania: ${response.status} ${response.statusText}`);
                }
            }
        } catch (error) {
            console.error("API Error login:", error);
            throw error;
        }
    },
    uploadProducts: async (file, token) => {
        const formData = new FormData();
        formData.append('products', file);

        try {
            const response = await fetch('https://dekor.onrender.com/api/admin/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            if (!response.ok) throw new Error('Błąd wgrywania pliku');
            return await response.json();
        } catch (error) {
            console.error("API Error uploadProducts:", error);
            throw error;
        }
    }
};

// --- Komponenty UI ---

const Tooltip = ({ children, text }) => (
  <div className="relative flex items-center group">
    {children}
    <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
      {text}
    </div>
  </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md m-4">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm p-1.5">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};


// --- Główne Widoki (Moduły) ---

const SearchView = ({ allProducts }) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);

    useEffect(() => {
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }
        const lowerCaseQuery = query.toLowerCase();
        const results = allProducts.filter(p =>
            p.name.toLowerCase().includes(lowerCaseQuery) ||
            p.product_code.toLowerCase().includes(lowerCaseQuery) ||
            p.barcode.toLowerCase().includes(lowerCaseQuery)
        );
        setSuggestions(results);
    }, [query, allProducts]);

    const handleSelect = (product) => {
        setSelectedProduct(product);
        setSuggestions([]);
        setQuery('');
    };

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Szybkie Wyszukiwanie</h1>
            <div className="relative max-w-2xl mx-auto">
                <div className="flex items-center bg-white dark:bg-gray-700 rounded-full shadow-lg">
                    <Search className="h-6 w-6 ml-4 text-gray-400"/>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Wpisz kod kreskowy, kod produktu lub nazwę..."
                        className="w-full p-4 bg-transparent focus:outline-none text-gray-900 dark:text-white"
                    />
                </div>
                {suggestions.length > 0 && (
                    <ul className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl">
                        {suggestions.map(p => (
                            <li key={p.id} onClick={() => handleSelect(p)} className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-b dark:border-gray-600 last:border-b-0">
                                <p className="font-semibold text-gray-800 dark:text-gray-100">{p.name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{p.product_code}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {selectedProduct && (
                <div className="mt-10 max-w-2xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in">
                    <h2 className="text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">{selectedProduct.name}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
                        <div><strong>Kod produktu:</strong> {selectedProduct.product_code}</div>
                        <div><strong>Kod kreskowy:</strong> {selectedProduct.barcode}</div>
                        <div><strong>Cena:</strong> {selectedProduct.price.toFixed(2)} PLN</div>
                        <div><strong>Ilość na stanie:</strong> {selectedProduct.quantity}</div>
                        <div><strong>Dostępność:</strong>
                            <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${selectedProduct.availability ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                {selectedProduct.availability ? 'Dostępny' : 'Niedostępny'}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const OrderView = ({ allProducts, user }) => {
    const [customerName, setCustomerName] = useState('');
    const [orderItems, setOrderItems] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const listEndRef = useRef(null);
    const printRef = useRef();
    const { showNotification } = useNotification();

    const scrollToBottom = () => listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(scrollToBottom, [orderItems]);

    const handleInputChange = (e) => {
        const query = e.target.value;
        setInputValue(query);
        if (query.length > 1) {
            const lowerCaseQuery = query.toLowerCase();
            const results = allProducts.filter(p =>
                p.name.toLowerCase().includes(lowerCaseQuery) ||
                p.product_code.toLowerCase().includes(lowerCaseQuery) ||
                p.barcode.toLowerCase().includes(lowerCaseQuery)
            );
            setSuggestions(results);
        } else {
            setSuggestions([]);
        }
    };

    const addProductToOrder = (product) => {
        const existingItem = orderItems.find(item => item.id === product.id);
        if (existingItem) {
            setOrderItems(orderItems.map(item =>
                item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            ));
        } else {
            setOrderItems([...orderItems, { ...product, quantity: 1, isCustom: false }]);
        }
        setInputValue('');
        setSuggestions([]);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && inputValue.trim() !== '') {
            e.preventDefault();
            if (suggestions.length > 0) {
                addProductToOrder(suggestions[0]);
            } else {
                const customItem = { id: `custom-${Date.now()}`, name: inputValue, product_code: 'N/A', price: 0.00, quantity: 1, isCustom: true };
                setOrderItems([...orderItems, customItem]);
                setInputValue('');
                setSuggestions([]);
            }
        }
    };

    const totalValue = useMemo(() => orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [orderItems]);

    const handleSaveOrder = async () => {
        if (!customerName) {
            showNotification('Proszę podać nazwę klienta.', 'error');
            return;
        }
        if (orderItems.length === 0) {
            showNotification('Zamówienie jest puste.', 'error');
            return;
        }
        try {
            const orderData = { customerName, items: orderItems, total: totalValue.toFixed(2) };
            const result = await api.saveOrder(orderData, user.token);
            showNotification(`Zamówienie ${result.order.id} zostało zapisane!`, 'success');
            setCustomerName('');
            setOrderItems([]);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
    
    const handlePrint = () => {
        const content = printRef.current;
        if (content) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write('<html><head><title>Wydruk Zamówienia</title>');
            printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
            printWindow.document.write('<style>.print-header { display: block !important; } body { padding: 2rem; }</style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(content.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    const handleExportCsv = () => {
        const headers = ["Nazwa", "Kod produktu", "Cena", "Ilość", "Wartość"];
        const data = orderItems.map(item => [
            `"${item.name.replace(/"/g, '""')}"`,
            item.product_code,
            item.price.toFixed(2),
            item.quantity,
            (item.price * item.quantity).toFixed(2)
        ]);
        
        const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        const filename = `Zamowienie-${customerName.replace(/\s/g, '_') || 'nowe'}.csv`;
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 md:p-8 pb-48">
                <div className="flex-shrink-0">
                    <h1 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white">Nowe Zamówienie</h1>
                    <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Wprowadź nazwę klienta" className="w-full max-w-lg p-3 mb-6 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <div ref={printRef} className="flex-grow bg-gray-50 dark:bg-gray-900 p-4 rounded-lg shadow-inner mb-4">
                    <div className="print-header hidden p-4">
                        <h2 className="text-2xl font-bold">Zamówienie dla: {customerName}</h2>
                        <p>Data: {new Date().toLocaleDateString()}</p>
                    </div>
                    {orderItems.length === 0 ? <p className="text-center text-gray-500">Brak pozycji na zamówieniu.</p> : (
                        <table className="w-full text-left">
                            <thead><tr className="border-b border-gray-200 dark:border-gray-700"><th className="p-3">Nazwa</th><th className="p-3">Kod produktu</th><th className="p-3 text-right">Cena</th><th className="p-3 text-center">Ilość</th><th className="p-3 text-right">Wartość</th></tr></thead>
                            <tbody>{orderItems.map(item => <tr key={item.id} className={`border-b border-gray-200 dark:border-gray-700 last:border-0 ${item.isCustom ? 'text-red-500' : ''}`}><td className="p-3 font-medium">{item.name}</td><td className="p-3">{item.product_code}</td><td className="p-3 text-right">{item.price.toFixed(2)} PLN</td><td className="p-3 text-center">{item.quantity}</td><td className="p-3 text-right font-semibold">{(item.price * item.quantity).toFixed(2)} PLN</td></tr>)}</tbody>
                        </table>
                    )}
                    <div ref={listEndRef} />
                </div>
            </div>

            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-top z-20">
                <div className="max-w-5xl mx-auto">
                    <div className="flex justify-end items-center mb-4">
                        <span className="text-lg font-bold text-gray-700 dark:text-gray-300">Suma:</span>
                        <span className="text-2xl font-bold ml-4 text-indigo-600 dark:text-indigo-400">{totalValue.toFixed(2)} PLN</span>
                    </div>
                    <div className="relative">
                        <input type="text" value={inputValue} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Dodaj produkt (zatwierdź Enterem)" className="w-full p-4 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                        {suggestions.length > 0 && <ul className="absolute bottom-full mb-2 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto z-30">{suggestions.map(p => <li key={p.id} onClick={() => addProductToOrder(p)} className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-b dark:border-gray-600 last:border-b-0"><p className="font-semibold text-gray-800 dark:text-gray-100">{p.name}</p><p className="text-sm text-gray-500 dark:text-gray-400">{p.product_code}</p></li>)}</ul>}
                    </div>
                    <div className="flex justify-end space-x-3 mt-4">
                        <button onClick={handleSaveOrder} className="flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><Save className="w-5 h-5 mr-2"/> Zapisz</button>
                        <button onClick={handleExportCsv} className="flex items-center justify-center px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><FileDown className="w-5 h-5 mr-2"/> CSV</button>
                        <button onClick={handlePrint} className="flex items-center justify-center px-5 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"><Printer className="w-5 h-5 mr-2"/> Drukuj</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PickingView = ({ user }) => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [toPickItems, setToPickItems] = useState([]);
    const [pickedItems, setPickedItems] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [pickedQuantity, setPickedQuantity] = useState('');
    const { showNotification } = useNotification();

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const fetchedOrders = await api.getOrders(user.token);
                setOrders(fetchedOrders.filter(o => o.status === 'Do kompletacji' || o.status === 'Zapisane'));
            } catch (error) {
                showNotification(error.message, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, [user.token, showNotification]);

    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
        setToPickItems(order.items.map(item => ({...item, originalQuantity: item.quantity})));
        setPickedItems([]);
    };

    const openModal = (item) => {
        setCurrentItem(item);
        setPickedQuantity(item.quantity);
        setIsModalOpen(true);
    };

    const handleConfirmPick = () => {
        const quantity = parseInt(pickedQuantity, 10);
        if (isNaN(quantity) || quantity < 0) {
            showNotification("Proszę wpisać poprawną ilość.", 'error');
            return;
        }

        const pickedItem = { ...currentItem, pickedQuantity: quantity };
        setPickedItems([...pickedItems, pickedItem]);
        
        const remainingQuantity = currentItem.quantity - quantity;
        if (remainingQuantity > 0) {
            setToPickItems(toPickItems.map(item => item.id === currentItem.id ? { ...item, quantity: remainingQuantity } : item));
        } else {
            setToPickItems(toPickItems.filter(item => item.id !== currentItem.id));
        }

        setIsModalOpen(false);
        setCurrentItem(null);
        setPickedQuantity('');
    };
    
    const isCompleted = toPickItems.length === 0 && selectedOrder;

    const exportCompletion = () => {
      const csvData = pickedItems.map(item => `${item.barcode},${item.pickedQuantity}`).join('\n');
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `kompletacja_${selectedOrder.id}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (isLoading) {
        return <div className="p-8 text-center">Ładowanie zamówień...</div>
    }

    if (!selectedOrder) {
        return (
            <div className="p-4 md:p-8">
                <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Kompletacja Zamówień</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {orders.map(order => (
                        <div key={order.id} onClick={() => handleSelectOrder(order)} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md cursor-pointer hover:shadow-lg hover:scale-105 transition-all">
                            <p className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{order.id}</p>
                            <p className="text-gray-700 dark:text-gray-300">{order.customerName}</p>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-white">Do skompletowania</h2>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">{toPickItems.map(item => <div key={item.id} onClick={() => openModal(item)} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"><div><p className="font-semibold">{item.name}</p><p className="text-sm text-gray-500 dark:text-gray-400">{item.product_code}</p></div><div className="text-lg font-bold px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">{item.quantity}</div></div>)} {toPickItems.length === 0 && <p className="text-gray-500 text-center p-4">Wszystko skompletowane.</p>}</div>
                </div>
                <div>
                    <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-white">Skompletowano</h2>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">{pickedItems.map(item => { const isMismatch = item.pickedQuantity !== item.originalQuantity; return (<div key={item.id} className={`flex justify-between items-center p-3 rounded-lg ${isMismatch ? 'bg-red-50 dark:bg-red-900/50' : 'bg-green-50 dark:bg-green-900/50'}`}><div><p className="font-semibold">{item.name}</p><p className="text-sm text-gray-500 dark:text-gray-400">{item.product_code}</p></div><div className={`text-lg font-bold px-3 py-1 rounded-full flex items-center gap-2 ${isMismatch ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{isMismatch && <AlertTriangle className="w-4 h-4" />} {item.pickedQuantity} / {item.originalQuantity}</div></div>);})} {pickedItems.length === 0 && <p className="text-gray-500 text-center p-4">Brak pozycji.</p>}</div>
                </div>
            </div>
            {isCompleted && <div className="mt-8 text-center p-6 bg-green-100 dark:bg-green-900/50 rounded-lg"><CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" /><h3 className="text-2xl font-bold text-green-800 dark:text-green-200">Zamówienie skompletowane!</h3><div className="mt-4 flex justify-center gap-4"><button className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors">Zatwierdź</button><button onClick={exportCompletion} className="flex items-center justify-center px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><FileDown className="w-5 h-5 mr-2"/> Eksportuj</button></div></div>}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Wpisz ilość">
                {currentItem && (
                    <div>
                        <p className="mb-4 text-lg font-semibold text-gray-800 dark:text-white">{currentItem.name}</p>
                        <input
                            type="number"
                            value={pickedQuantity}
                            onChange={(e) => setPickedQuantity(e.target.value)}
                            className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center text-2xl"
                            autoFocus
                            onKeyPress={(e) => e.key === 'Enter' && handleConfirmPick()}
                        />
                        <button onClick={handleConfirmPick} className="w-full mt-4 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors">
                            Akceptuj
                        </button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

const InventoryView = ({ allProducts }) => {
    const [listName, setListName] = useState('');
    const [inventoryItems, setInventoryItems] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const listEndRef = useRef(null);

    const scrollToBottom = () => listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(scrollToBottom, [inventoryItems]);

    const handleInputChange = (e) => {
        const query = e.target.value;
        setInputValue(query);
        if (query.length > 1) {
            const lowerCaseQuery = query.toLowerCase();
            const results = allProducts.filter(p =>
                p.name.toLowerCase().includes(lowerCaseQuery) ||
                p.product_code.toLowerCase().includes(lowerCaseQuery) ||
                p.barcode.toLowerCase().includes(lowerCaseQuery)
            );
            setSuggestions(results);
        } else {
            setSuggestions([]);
        }
    };

    const addProductToInventory = (product) => {
        const existingItem = inventoryItems.find(item => item.id === product.id);
        if (existingItem) {
            setInventoryItems(inventoryItems.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setInventoryItems([...inventoryItems, { ...product, quantity: 1, isCustom: false }]);
        }
        setInputValue('');
        setSuggestions([]);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && inputValue.trim() !== '') {
            e.preventDefault();
            if (suggestions.length > 0) {
                addProductToInventory(suggestions[0]);
            } else {
                const customItem = { id: `custom-${Date.now()}`, name: inputValue, product_code: 'N/A', quantity: 1, isCustom: true };
                setInventoryItems([...inventoryItems, customItem]);
                setInputValue('');
                setSuggestions([]);
            }
        }
    };
    
    const updateQuantity = (id, newQuantity) => {
      const quant = parseInt(newQuantity, 10);
      if (quant > 0) setInventoryItems(inventoryItems.map(item => item.id === id ? {...item, quantity: quant} : item));
    };
    
    const removeItem = (id) => setInventoryItems(inventoryItems.filter(item => item.id !== id));

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 md:p-8 pb-24">
                <div className="flex-shrink-0">
                    <h1 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white">Inwentaryzacja</h1>
                    <input type="text" value={listName} onChange={(e) => setListName(e.target.value)} placeholder="Wprowadź nazwę listy spisowej" className="w-full max-w-lg p-3 mb-6 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div className="flex-grow overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 rounded-lg shadow-inner mb-4">
                    {inventoryItems.length > 0 ? <table className="w-full text-left"><thead><tr className="border-b border-gray-200 dark:border-gray-700"><th className="p-3">Nazwa</th><th className="p-3">Kod produktu</th><th className="p-3 text-center">Ilość</th><th className="p-3 text-center">Akcje</th></tr></thead><tbody>{inventoryItems.map(item => <tr key={item.id} className={`border-b border-gray-200 dark:border-gray-700 last:border-0 ${item.isCustom ? 'text-red-500' : ''}`}><td className="p-2 font-medium">{item.name}</td><td className="p-2">{item.product_code}</td><td className="p-2 text-center"><input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.id, e.target.value)} className="w-20 text-center bg-transparent border rounded-md p-1"/></td><td className="p-2 text-center"><button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-5 h-5" /></button></td></tr>)}</tbody></table> : <p className="text-center text-gray-500">Brak pozycji na liście.</p>}
                    <div ref={listEndRef} />
                </div>
            </div>
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-top z-20">
                <div className="max-w-4xl mx-auto relative">
                    <input type="text" value={inputValue} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Dodaj produkt (zatwierdź Enterem)" className="w-full p-4 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                    {suggestions.length > 0 && <ul className="absolute bottom-full mb-2 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto z-30">{suggestions.map(p => <li key={p.id} onClick={() => addProductToInventory(p)} className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-b dark:border-gray-600 last:border-b-0"><p className="font-semibold text-gray-800 dark:text-gray-100">{p.name}</p><p className="text-sm text-gray-500 dark:text-gray-400">{p.product_code}</p></li>)}</ul>}
                </div>
            </div>
        </div>
    );
};

const AdminView = ({ user }) => {
    // eslint-disable-next-line no-unused-vars
    const [users, setUsers] = useState([]); // Dane będą pobierane z API
    const { showNotification } = useNotification();

    // TODO: Dodać funkcję pobierającą użytkowników z /api/admin/users
    
    // eslint-disable-next-line no-unused-vars
    const handleApproveUser = (userId) => {
        // API CALL: POST /api/admin/users/approve { userId }
        showNotification(`Akceptowanie użytkownika ${userId}...`, 'success');
    };
    
    const handleFileUpload = async (e, fileType) => {
      const file = e.target.files[0];
      if (file) {
        try {
            const result = await api.uploadProducts(file, user.token);
            showNotification(result.message || `Plik ${file.name} został wgrany.`, 'success');
        } catch(error) {
            showNotification(error.message, 'error');
        }
      }
    };

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Panel Administratora</h1>
            <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-white">Zarządzanie Użytkownikami</h2>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"><p className="text-gray-500">Moduł zarządzania użytkownikami wymaga implementacji API.</p></div>
            </div>
            <div>
                <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-white">Zarządzanie Bazą Danych</h2>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                        <h3 className="text-lg font-medium mb-2">Baza produktów (produkty.csv)</h3>
                        <label className="cursor-pointer px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 inline-flex items-center"><Upload className="w-4 h-4 mr-2"/> Zmień plik<input type="file" className="hidden" accept=".csv" onChange={(e) => handleFileUpload(e, 'produkty.csv')} /></label>
                    </div>
                    <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                        <h3 className="text-lg font-medium mb-2">Baza produktów 2 (produkty2.csv)</h3>
                        <label className="cursor-pointer px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 inline-flex items-center"><Upload className="w-4 h-4 mr-2"/> Zmień plik<input type="file" className="hidden" accept=".csv" onChange={(e) => handleFileUpload(e, 'produkty2.csv')} /></label>
                    </div>
                </div>
                 <div className="mt-4 text-sm text-gray-500 dark:text-gray-400"><p><AlertTriangle className="inline w-4 h-4 mr-1"/> <strong>Uwaga:</strong> Wgranie nowego pliku nadpisze istniejące dane produktów na serwerze.</p></div>
            </div>
        </div>
    );
};

const LoginView = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const { user, token } = await api.login(username, password);
            onLogin({ ...user, token });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <div className="text-center">
                    <img src="/logo.png" onError={(e) => { e.currentTarget.src = 'https://placehold.co/150x50/4f46e5/ffffff?text=Logo'; }} alt="Logo" className="mx-auto mb-4 h-12" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Zaloguj się do systemu</h2>
                </div>
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div><label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Nazwa użytkownika</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required/></div>
                    <div><label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Hasło</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required/></div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <div><button type="submit" disabled={isLoading} className="w-full px-4 py-3 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400">{isLoading ? 'Logowanie...' : 'Zaloguj się'}</button></div>
                </form>
            </div>
        </div>
    );
};


// --- Główny Komponent Aplikacji ---

function App() {
    const [user, setUser] = useState(null);
    const [activeView, setActiveView] = useState('search');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();

    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    const handleLogin = useCallback((loggedInUser) => {
        localStorage.setItem('userToken', loggedInUser.token);
        localStorage.setItem('userData', JSON.stringify(loggedInUser));
        setUser(loggedInUser);
        
        api.getProducts()
            .then(data => setProducts(data))
            .catch(err => showNotification(err.message, 'error'))
            .finally(() => setIsLoading(false));

        setActiveView(loggedInUser.role === 'administrator' ? 'admin' : 'order');
    }, [showNotification]);

    const handleLogout = () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        setUser(null);
        setProducts([]);
        setActiveView('search');
    };
    
    useEffect(() => {
        const token = localStorage.getItem('userToken');
        const userData = localStorage.getItem('userData');
        if (token && userData) {
            handleLogin(JSON.parse(userData));
        } else {
            setIsLoading(false);
        }
    }, [handleLogin]);

    if (isLoading && !user) {
      return <div className="flex items-center justify-center h-screen">Ładowanie...</div>
    }

    if (!user) {
        return <LoginView onLogin={handleLogin} />;
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
            case 'search': return <SearchView allProducts={products} />;
            case 'order': return <OrderView allProducts={products} user={user} />;
            case 'picking': return <PickingView user={user} />;
            case 'inventory': return <InventoryView allProducts={products} />;
            case 'admin': return <AdminView user={user} />;
            default: return <SearchView allProducts={products} />;
        }
    };

    return (
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
                         <Tooltip text="Wyloguj"><button onClick={handleLogout} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><LogOut className="h-6 w-6 text-gray-500" /></button></Tooltip>
                    </div>
                    <Tooltip text="Zmień motyw"><button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex justify-center p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">{isDarkMode ? <Sun className="h-6 w-6 text-yellow-400" /> : <Moon className="h-6 w-6 text-indigo-500" />}</button></Tooltip>
                </div>
            </nav>
            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-x-hidden overflow-y-auto">{renderView()}</div>
            </main>
        </div>
    );
}

// Główny punkt wejścia aplikacji z dostawcą powiadomień
export default function AppWrapper() {
    return (
        <NotificationProvider>
            <App />
        </NotificationProvider>
    );
}
