import React, { useState, useEffect, useCallback, createContext, useContext, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import { Search, List, Wrench, Sun, Moon, LogOut, FileDown, FileText, Printer, Save, CheckCircle, AlertTriangle, Upload, Trash2, XCircle, UserPlus, KeyRound, PlusCircle, MessageSquare, Archive, Edit, Home, Menu, Filter, RotateCcw, FileUp, GitMerge, Eye, Trophy, Crown, BarChart2, Users, Package, StickyNote, Settings, ChevronsUpDown, ChevronUp, ChevronDown, ClipboardList, Plane, ListChecks, Mail, Zap, ClipboardCheck } from 'lucide-react';
import { format, parseISO, eachDayOfInterval, isValid } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { pl } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { GoogleMap, useLoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';

// --- Komponent Granicy Błędu (Error Boundary) ---
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }
    static getDerivedStateFromError(error) { return { hasError: true }; }
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
                    <p className="text-center mb-4">Coś poszło nie tak. Spróbuj odświeżyć stronę lub skontaktuj się z administratorem.</p>
                    <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Odśwież stronę</button>
                    <details className="mt-6 text-left bg-red-100 p-4 rounded-lg w-full max-w-2xl">
                        <summary className="cursor-pointer font-semibold">Szczegóły błędu</summary>
                        <pre className="mt-2 text-sm whitespace-pre-wrap break-words">{this.state.error && this.state.error.toString()}<br />{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
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
const API_BASE_URL = '';

const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('userToken');
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });

    if (response.status === 401) {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        window.dispatchEvent(new Event('auth-error')); // Custom event for auth errors
        throw new Error('Sesja wygasła. Proszę zalogować się ponownie.');
    }
    return response;
};

const api = {
	updateOrderStatus: async (orderId, status) => {
    const response = await fetchWithAuth(`/api/orders/${orderId}/status`, { 
        method: 'PUT', 
        body: JSON.stringify({ status }) 
    });
    if (!response.ok) { 
        const errorData = await response.json(); 
        throw new Error(errorData.message || 'Błąd aktualizacji statusu'); 
    }
    return await response.json();
	},
	getShortageReport: async () => {
		const response = await fetchWithAuth(`/api/reports/shortages`);
		if (!response.ok) throw new Error('Błąd pobierania raportu braków');
		return await response.json();
	},
    searchProducts: async (searchTerm, filterByQuantity = false) => {
        const response = await fetchWithAuth(`/api/products?search=${encodeURIComponent(searchTerm)}&filterByQuantity=${filterByQuantity}`);
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd wyszukiwania produktów'); }
        return await response.json();
    },
    importOrderFromCsv: async (file) => {
        const formData = new FormData();
        formData.append('orderFile', file);
        const response = await fetchWithAuth(`/api/orders/import-csv`, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd importu pliku');
        return data;
    },
    importMultipleOrdersFromCsv: async (files) => {
        const formData = new FormData();
        files.forEach(file => formData.append('orderFiles', file));
        const response = await fetchWithAuth(`/api/orders/import-multiple-csv`, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd importu plików');
        return data;
    },
	testEmailConfig: async () => {
    const response = await fetchWithAuth(`/api/admin/test-email`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Błąd podczas wysyłki testowej');
    return data;
	},
    saveOrder: async (order) => {
        const url = order._id ? `/api/orders/${order._id}` : `/api/orders`;
        const method = order._id ? 'PUT' : 'POST';
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(order) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd zapisywania zamówienia'); }
        return await response.json();
    },
    getOrders: async (filters = {}) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(filters)) {
            if (value) {
                if (Array.isArray(value)) {
                    value.forEach(item => params.append(key, item));
                } else {
                    params.append(key, value);
                }
            }
        }
        const url = `/api/orders?${params.toString()}`;
        const response = await fetchWithAuth(url);
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd pobierania zamówień'); }
        return await response.json();
    },
    getOrderById: async (id) => {
        const response = await fetchWithAuth(`/api/orders/${id}`);
        if (!response.ok) throw new Error('Nie znaleziono zamówienia');
        return await response.json();
    },
    deleteOrder: async (id) => {
        const response = await fetchWithAuth(`/api/orders/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Błąd usuwania zamówienia');
        return await response.json();
    },
    completeOrder: async (orderId, pickedItems) => {
        const response = await fetchWithAuth(`/api/orders/${orderId}/complete`, { method: 'POST', body: JSON.stringify({ pickedItems }) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd podczas kompletacji zamówienia'); }
        return await response.json();
    },
    revertOrderCompletion: async (orderId) => {
        const response = await fetchWithAuth(`/api/orders/${orderId}/revert`, { method: 'POST' });
        if (!response.ok) throw new Error('Błąd przywracania zamówienia');
        return await response.json();
    },
    uploadProductsFile: async (file, mode) => {
        const formData = new FormData();
        formData.append('productsFile', file);
        const response = await fetchWithAuth(`/api/admin/upload-products?mode=${mode}`, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd wgrywania pliku');
        return data;
    },
    getDashboardStats: async () => {
        const response = await fetchWithAuth(`/api/dashboard-stats`);
        if (!response.ok) throw new Error('Błąd pobierania statystyk');
        return await response.json();
    },
    mergeProducts: async () => {
        const response = await fetchWithAuth(`/api/admin/merge-products`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd łączenia produktów');
        return data;
    },
    saveInventory: async (inventory) => {
        const url = inventory._id ? `/api/inventories/${inventory._id}` : `/api/inventories`;
        const method = inventory._id ? 'PUT' : 'POST';
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(inventory) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd zapisywania inwentaryzacji'); }
        return await response.json();
    },
    getInventories: async () => {
        const response = await fetchWithAuth(`/api/inventories`);
        if (!response.ok) throw new Error('Błąd pobierania inwentaryzacji');
        return await response.json();
    },
    getInventoryById: async (id) => {
        const response = await fetchWithAuth(`/api/inventories/${id}`);
        if (!response.ok) throw new Error('Nie znaleziono inwentaryzacji');
        return await response.json();
    },
    deleteInventory: async (id) => {
        const response = await fetchWithAuth(`/api/inventories/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Błąd usuwania inwentaryzacji');
        return await response.json();
    },
    importInventorySheet: async (file) => {
        const formData = new FormData();
        formData.append('sheetFile', file);
        const response = await fetchWithAuth(`/api/inventories/import-sheet`, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd importu arkusza');
        return data;
    },
    importMultipleInventorySheets: async (files) => {
        const formData = new FormData();
        files.forEach(file => formData.append('sheetFiles', file));
        const response = await fetchWithAuth(`/api/inventories/import-multiple-sheets`, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd importu plików');
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
        const response = await fetchWithAuth(`/api/admin/users`);
        if (!response.ok) throw new Error('Błąd pobierania użytkowników');
        return await response.json();
    },
    getUsersList: async () => {
        const response = await fetchWithAuth(`/api/users/list`);
        if (!response.ok) throw new Error('Błąd pobierania listy użytkowników');
        return await response.json();
    },
    approveUser: async (userId) => {
        const response = await fetchWithAuth(`/api/admin/users/${userId}/approve`, { method: 'POST' });
        if (!response.ok) throw new Error('Błąd akceptacji użytkownika');
        return await response.json();
    },
    changeUserRole: async (userId, role) => {
        const response = await fetchWithAuth(`/api/admin/users/${userId}/role`, { method: 'POST', body: JSON.stringify({ role }) });
        if (!response.ok) throw new Error('Błąd zmiany roli użytkownika');
        return await response.json();
    },
       updateUserModules: async (userId, modules) => {
        const response = await fetchWithAuth(`/api/admin/users/${userId}/modules`, { method: 'PUT', body: JSON.stringify({ modules }) });
        if (!response.ok) throw new Error('Błąd aktualizacji modułów użytkownika');
        return await response.json();
    },
	updateUserDashboardLayout: async (layout) => {
		const response = await fetchWithAuth(`/api/user/dashboard-layout`, { method: 'PUT', body: JSON.stringify({ layout }) });
		if (!response.ok) throw new Error('Błąd zapisywania układu pulpitu');
		return await response.json();
},
    deleteUser: async (userId) => {
        const response = await fetchWithAuth(`/api/admin/users/${userId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Błąd usuwania użytkownika');
        return await response.json();
    },
    changePassword: async (userId, password) => {
        const response = await fetchWithAuth(`/api/admin/users/${userId}/password`, { method: 'POST', body: JSON.stringify({ password }) });
        if (!response.ok) throw new Error('Błąd zmiany hasła');
        return await response.json();
    },
    userChangeOwnPassword: async (currentPassword, newPassword) => {
        const response = await fetchWithAuth(`/api/user/password`, { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Błąd zmiany hasła'); }
        return await response.json();
    },
    getAllProducts: async (page = 1, limit = 20, search = '') => {
        const params = new URLSearchParams({ page, limit, search });
        const response = await fetchWithAuth(`/api/admin/all-products?${params.toString()}`);
        if (!response.ok) throw new Error('Błąd pobierania produktów');
        return await response.json();
    },
    setUserGoal: async (goal) => {
        const response = await fetchWithAuth(`/api/user/goal`, { method: 'POST', body: JSON.stringify({ goal }) });
        if (!response.ok) throw new Error('Błąd ustawiania celu');
        return await response.json();
    },
    addManualSales: async (sales) => {
        const response = await fetchWithAuth(`/api/user/manual-sales`, { method: 'POST', body: JSON.stringify({ sales }) });
        if (!response.ok) throw new Error('Błąd dodawania sprzedaży');
        return await response.json();
    },
    getNotes: async () => {
        const response = await fetchWithAuth(`/api/notes`);
        if (!response.ok) throw new Error('Błąd pobierania notatek');
        return await response.json();
    },
    addNote: async (note) => {
        const response = await fetchWithAuth(`/api/notes`, { method: 'POST', body: JSON.stringify(note) });
        if (!response.ok) throw new Error('Błąd dodawania notatki');
        return await response.json();
    },
    deleteNote: async (noteId) => {
        const response = await fetchWithAuth(`/api/notes/${noteId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Błąd usuwania notatki');
        return await response.json();
    },
    getKanbanTasks: async (userId) => {
        const url = userId ? `/api/kanban/tasks?userId=${userId}` : `/api/kanban/tasks`;
        const response = await fetchWithAuth(url);
        if (!response.ok) throw new Error('Błąd pobierania zadań');
        return await response.json();
    },
    addKanbanTask: async (task) => {
        const response = await fetchWithAuth(`/api/kanban/tasks`, { method: 'POST', body: JSON.stringify(task) });
        if (!response.ok) throw new Error('Błąd dodawania zadania');
        return await response.json();
    },
    updateKanbanTask: async (taskId, data) => {
        const response = await fetchWithAuth(`/api/kanban/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) });
        if (!response.ok) throw new Error('Błąd aktualizacji zadania');
        return await response.json();
    },
    deleteKanbanTask: async (taskId) => {
        const response = await fetchWithAuth(`/api/kanban/tasks/${taskId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Błąd usuwania zadania');
        return await response.json();
    },
    getDelegations: async () => {
        const response = await fetchWithAuth(`/api/delegations`);
        if (!response.ok) throw new Error('Błąd pobierania delegacji');
        return await response.json();
    },
    addDelegation: async (delegation) => {
        const response = await fetchWithAuth(`/api/delegations`, { method: 'POST', body: JSON.stringify(delegation) });
        if (!response.ok) throw new Error('Błąd tworzenia delegacji');
        return await response.json();
    },
	saveDelegation: async (delegation) => {
        const url = delegation._id 
            ? `/api/delegations/${delegation._id}` 
            : `/api/delegations`;
        const method = delegation._id ? 'PUT' : 'POST';
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(delegation) });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Błąd zapisywania delegacji');
        }
        return await response.json();
    },
    updateDelegationStatus: async (delegationId, status) => {
        const response = await fetchWithAuth(`/api/delegations/${delegationId}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
        if (!response.ok) throw new Error('Błąd aktualizacji statusu delegacji');
        return await response.json();
    },
    deleteDelegation: async (delegationId) => {
        const response = await fetchWithAuth(`/api/delegations/${delegationId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Błąd usuwania delegacji');
        return await response.json();
    },
	 startDelegation: async (delegationId) => {
        const response = await fetchWithAuth(`/api/delegations/${delegationId}/start`, { method: 'POST' });
        if (!response.ok) throw new Error('Błąd rozpoczęcia delegacji');
        return await response.json();
    },
    endDelegation: async (delegationId) => {
        const response = await fetchWithAuth(`/api/delegations/${delegationId}/end`, { method: 'POST' });
        if (!response.ok) throw new Error('Błąd zakończenia delegacji');
        return await response.json();
    },
    startClientVisit: async (delegationId, clientIndex) => {
        const response = await fetchWithAuth(`/api/delegations/${delegationId}/visits/${clientIndex}/start`, { method: 'POST' });
        if (!response.ok) throw new Error('Błąd rozpoczęcia wizyty');
        return await response.json();
    },
	getEmailConfig: async () => {
        const response = await fetchWithAuth(`/api/admin/email-config`);
        if (!response.ok) throw new Error('Błąd pobierania konfiguracji email');
        return await response.json();
    },
    saveEmailConfig: async (config) => {
        const response = await fetchWithAuth(`/api/admin/email-config`, {
            method: 'POST',
            body: JSON.stringify(config)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd zapisywania konfiguracji');
        return data;
    },
	getContacts: async () => {
        const response = await fetchWithAuth(`/api/crm/contacts`);
        if (!response.ok) throw new Error('Błąd pobierania kontaktów');
        return await response.json();
    },
    addContact: async (contactData) => {
        const response = await fetchWithAuth(`/api/crm/contacts`, { method: 'POST', body: JSON.stringify(contactData) });
        if (!response.ok) throw new Error('Błąd dodawania kontaktu');
        return await response.json();
    },
    updateContact: async (contactId, contactData) => {
        const response = await fetchWithAuth(`/api/crm/contacts/${contactId}`, { method: 'PUT', body: JSON.stringify(contactData) });
        if (!response.ok) throw new Error('Błąd aktualizacji kontaktu');
        return await response.json();
    },
    deleteContact: async (contactId) => {
        const response = await fetchWithAuth(`/api/crm/contacts/${contactId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Błąd usuwania kontaktu');
        return await response.json();
    },
    importContacts: async (file) => {
        const formData = new FormData();
        formData.append('contactsFile', file);
        const response = await fetchWithAuth(`/api/crm/import-contacts`, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Błąd importu pliku');
        return data;
    },
    endClientVisit: async (delegationId, clientIndex, visitData) => {
        const response = await fetchWithAuth(`/api/delegations/${delegationId}/visits/${clientIndex}/end`, { method: 'POST', body: JSON.stringify(visitData) });
        if (!response.ok) throw new Error('Błąd zakończenia wizyty');
        return await response.json();
    },
	processCompletion: async (orderId, pickedItems, allItems) => {
    const response = await fetchWithAuth(`/api/orders/${orderId}/process-completion`, { 
        method: 'POST', 
        body: JSON.stringify({ pickedItems, allItems }) 
    });
    if (!response.ok) { 
        const errorData = await response.json(); 
        throw new Error(errorData.message || 'Błąd podczas przetwarzania kompletacji'); 
    }
    return await response.json();
	},
};

// --- Komponenty Pomocnicze i UI ---
const Tooltip = ({ children, text }) => ( <div className="relative flex items-center group">{children}<div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">{text}</div></div>);
const Modal = ({ isOpen, onClose, title, children, maxWidth = 'md' }) => {
    if (!isOpen) return null;
    const maxWidthClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl', '4xl': 'max-w-4xl' }[maxWidth];
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-2 sm:p-4 animate-fade-in">
            <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full m-4 ${maxWidthClass} flex flex-col max-h-[90vh]`}>
                <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm p-1.5"><XCircle className="w-6 h-6"/></button>
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};
// --- Hook do sortowania ---
const useSortableData = (items, config = null) => {
    const [sortConfig, setSortConfig] = useState(config);

    const sortedItems = useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [items, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    return { items: sortedItems, requestSort, sortConfig };
};


// --- Komponenty Widoków ---

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

const VisitRecapForm = ({ onSubmit }) => {
    const [visitNotes, setVisitNotes] = useState('');
    const [ordered, setOrdered] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ visitNotes, ordered });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium">Podsumowanie wizyty</label>
                <textarea value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} className="w-full p-2 border rounded-md" />
            </div>
            <div className="flex items-center">
                <input type="checkbox" checked={ordered} onChange={(e) => setOrdered(e.target.checked)} id="ordered" className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                <label htmlFor="ordered" className="ml-2 block text-sm">Zrealizowano zamówienie</label>
            </div>
            <div className="flex justify-end pt-4">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zakończ wizytę</button>
            </div>
        </form>
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

const AuthPage = ({ onLogin }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
            {isLoginView ? <LoginView onLogin={onLogin} showRegister={() => setIsLoginView(false)} /> : <RegisterView showLogin={() => setIsLoginView(true)} />}
        </div>
    );
};

const ProductDetailsCard = ({ product }) => (
    <div className="mt-6 max-w-4xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in">
        <h2 className="text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">{product.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
            <div><strong>Kod produktu:</strong> {product.product_code || 'Brak'}</div>
            <div><strong>Kody EAN:</strong> {(product.barcodes || []).join(', ') || 'Brak'}</div>
            <div><strong>Cena:</strong> {product.price?.toFixed(2) || '0.00'} PLN</div>
            <div><strong>Ilość na stanie:</strong> {product.quantity || 0}</div>
        </div>
    </div>
);

const SearchView = ({ onProductSelect }) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filterByQuantity, setFilterByQuantity] = useState(false);
    const { showNotification } = useNotification();

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

const MainSearchView = () => {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const searchInputRef = useRef(null);

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setTimeout(() => searchInputRef.current?.focus(), 0);
    };

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Szybkie Wyszukiwanie</h1>
            <SearchView onProductSelect={handleProductSelect} inputRef={searchInputRef} />
            {selectedProduct && <ProductDetailsCard product={selectedProduct} />}
        </div>
    );
};

const PinnedInputBar = ({ onProductAdd, onSave, isDirty }) => {
    const [query, setQuery] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { showNotification } = useNotification();
    const inputRef = useRef(null);

    // Effect to handle automatic adding for EAN codes
    useEffect(() => {
        const ean = query.trim();
        if (/^\d{13}$/.test(ean)) { // Trigger on 13 digits
            const processEan = async () => {
                setIsLoading(true);
                try {
                    const results = await api.searchProducts(ean);
                    if (results.length > 0) {
                        const matchedProduct = results.find(p => p.barcodes.includes(ean));
                        onProductAdd(matchedProduct || results[0], 1);
                    } else {
                        const customItem = {
                            _id: `custom-${ean}`, name: `EAN: ${ean}`, product_code: 'SPOZA LISTY',
                            barcodes: [ean], price: 0, isCustom: true,
                        };
                        onProductAdd(customItem, 1);
                    }
                } catch (error) {
                    showNotification(error.message, 'error');
                } finally {
                    setQuery('');
                    setSuggestions([]);
                    setIsLoading(false);
                }
            };
            const handler = setTimeout(processEan, 50); // Short delay for fast scanners
            return () => clearTimeout(handler);
        }
    }, [query, onProductAdd, showNotification]);

    // Effect to re-focus the input after an item is added
    useEffect(() => {
        if (query === '' && !isLoading) {
            inputRef.current?.focus();
        }
    }, [query, isLoading]);

    // Effect for showing suggestions for TEXT search
    useEffect(() => {
        const isNumeric = /^\d+$/.test(query.trim());
        if (query.length < 2 || isNumeric) {
            setSuggestions([]);
            return;
        }
        const handler = setTimeout(async () => {
            setIsLoading(true);
            try {
                const results = await api.searchProducts(query);
                setSuggestions(results);
            } catch (error) {
                showNotification(error.message, 'error');
            } finally {
                setIsLoading(false);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [query, showNotification]);


    const handleAddFromSuggestion = (product) => {
        const qty = Number(quantity);
        onProductAdd(product, qty > 0 ? qty : 1);
        setSuggestions([]);
        setQuery('');
        setQuantity(1);
    };
    
    const handleQueryChange = (e) => {
        setQuery(e.target.value);
    };
	
    const handleKeyDown = async (e) => {
        if (e.key === 'Enter' && query.trim() !== '') {
            e.preventDefault();
            if (suggestions.length > 0) {
                handleAddFromSuggestion(suggestions[0]);
                return;
            }
            setIsLoading(true);
            try {
                const results = await api.searchProducts(query.trim());
                if (results.length > 0) {
                    handleAddFromSuggestion(results[0]);
                } else {
                    showNotification('Nie znaleziono produktu.', 'error');
                }
            } catch (error) {
                 showNotification(error.message, 'error');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-top z-20 p-4">
            <div className="max-w-4xl mx-auto relative">
                {suggestions.length > 0 && (
                    <ul className="absolute bottom-full mb-2 w-full bg-white dark:bg-gray-700 border rounded-lg shadow-xl max-h-60 overflow-y-auto z-30">
                        {suggestions.map(p => (
                            <li key={p._id} onClick={() => handleAddFromSuggestion(p)} className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-b last:border-b-0">
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
                        placeholder="Zeskanuj EAN lub wyszukaj produkt..."
                        className="w-full p-3 bg-gray-100 dark:bg-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                        type="number"
                        value={quantity}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setQuantity(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-20 sm:w-24 p-3 text-center bg-gray-100 dark:bg-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
    );
};

const OrderView = ({ currentOrder, setCurrentOrder, user, setDirty }) => {
    const [order, setOrder] = useState(currentOrder);
    const [noteModal, setNoteModal] = useState({ isOpen: false, itemIndex: null, text: '' });
    const listEndRef = useRef(null);
    const printRef = useRef(null);
    const importFileRef = useRef(null);
    const { showNotification } = useNotification();
    const { items: sortedItems, requestSort, sortConfig } = useSortableData(order.items || []);

    const getSortIcon = (name) => {
        if (!sortConfig || sortConfig.key !== name) {
            return <ChevronsUpDown className="w-4 h-4 ml-1 opacity-40" />;
        }
        return sortConfig.direction === 'ascending' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
    };
    
    useEffect(() => {
        setOrder(currentOrder);
    }, [currentOrder]);

    useEffect(() => {
        if (!order._id) {
            try {
                localStorage.setItem('draftOrder', JSON.stringify(order));
            } catch (error) {
                console.error("Błąd zapisu roboczego zamówienia do localStorage:", error);
            }
        }
    }, [order]);
    
    const scrollToBottom = () => listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(scrollToBottom, [order.items]);

    const updateOrder = (updates, isDirtyFlag = true) => {
        const newOrder = { ...order, ...updates, isDirty: isDirtyFlag };
        setOrder(newOrder);
        setCurrentOrder(newOrder);
        setDirty(isDirtyFlag);
    };

    const addProductToOrder = (product, quantity) => {
        const newItems = [...(order.items || [])];
        const uniqueIdentifier = product.isCustom ? `custom-${product.barcodes[0]}` : product._id;

        const existingItemIndex = newItems.findIndex(item => {
            const itemIdentifier = item.isCustom ? `custom-${item.barcodes[0]}` : item._id;
            return itemIdentifier === uniqueIdentifier;
        });

        const isScanOrQuickAdd = !quantity || quantity <= 1;

        if (existingItemIndex > -1) {
            newItems[existingItemIndex].quantity += isScanOrQuickAdd ? 1 : quantity;
        } else {
            newItems.push({ ...product, quantity: isScanOrQuickAdd ? 1 : quantity, note: '' });
        }
        updateOrder({ items: newItems });
    };

    const updateQuantity = (itemIndex, newQuantityStr) => {
        const newItems = [...order.items];
        const newQuantity = parseInt(newQuantityStr, 10);
        const originalItem = sortedItems[itemIndex];
        
        const targetIndex = newItems.findIndex(item => item._id === originalItem._id);

        if (targetIndex !== -1) {
            if (!isNaN(newQuantity) && newQuantity >= 0) {
                newItems[targetIndex].quantity = newQuantity;
            } else if (newQuantityStr === '') {
                newItems[targetIndex].quantity = 0;
            }
            updateOrder({ items: newItems });
        }
    };

    const handleStatusChange = async (newStatus) => {
        try {
            const { message, order: updatedOrder } = await api.updateOrderStatus(order._id, newStatus);
            showNotification(message, 'success');
            updateOrder(updatedOrder, false);
        } catch (error) {
            showNotification(error.message, 'error');
            }
        };

    const removeItemFromOrder = (itemIndex) => {
        const newItems = [...order.items];
        const originalItem = sortedItems[itemIndex];
        const targetIndex = newItems.findIndex(item => item._id === originalItem._id);
        if (targetIndex !== -1) {
            newItems.splice(targetIndex, 1);
            updateOrder({ items: newItems });
        }
    };

    const handleNoteSave = () => {
        const newItems = [...order.items];
        newItems[noteModal.itemIndex].note = noteModal.text;
        updateOrder({ items: newItems });
        setNoteModal({ isOpen: false, itemIndex: null, text: '' });
    };

    const totalValue = useMemo(() => (order.items || []).reduce((sum, item) => sum + item.price * (item.quantity || 0), 0), [order.items]);

    const handleSaveOrder = async () => {
        if (!order.customerName) { 
            showNotification('Proszę podać nazwę klienta.', 'error'); 
            return; 
        }
        try {
            const orderToSave = { ...order, author: user.username };
            const { message, order: savedOrder } = await api.saveOrder(orderToSave);
            showNotification(message, 'success');
            localStorage.removeItem('draftOrder');
            setCurrentOrder(savedOrder);
            setDirty(false);
        } catch (error) { 
            showNotification(error.message, 'error'); 
        }
    };

    
    const handleFileImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const { items, notFound } = await api.importOrderFromCsv(file);
            updateOrder({ items: [...(order.items || []), ...items] });
            showNotification(`Zaimportowano ${items.length} pozycji.`, 'success');
            if (notFound.length > 0) {
                showNotification(`Nie znaleziono produktów dla kodów: ${notFound.join(', ')}`, 'error');
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
        event.target.value = null;
    };
    
	const handleExportCsv = () => {
        if (!order.items || order.items.length === 0) {
            showNotification('Zamówienie jest puste.', 'error');
            return;
        }

        const csvRows = order.items.map(item => {
            const ean = item.barcodes && item.barcodes.length > 0 ? item.barcodes[0] : '';
            const quantity = item.quantity || 0;
            return `${ean};${quantity}`;
        }).join('\n');

        const csvContent = csvRows;

        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        const fileName = `zamowienie_${order.customerName.replace(/\s/g, '_') || 'nowe'}.csv`;
        link.setAttribute("download", fileName);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Plik CSV został wygenerowany.', 'success');
    };
	
   const handleExportPdf = () => {
        const doc = new jsPDF();
		doc.addFont('/Roboto-Regular.ttf', 'Roboto', 'normal');
		doc.setFont('Roboto'); 
        doc.text(`Zamówienie dla: ${order.customerName}`, 14, 15);
        doc.text(`Data: ${new Date().toLocaleDateString()}`, 14, 22);

        doc.autoTable({
        startY: 30,
        head: [['Nazwa', 'Kod produktu', 'Notatka', 'Ilość', 'Cena', 'Wartość']],
        body: order.items.map(item => [
            item.name,
            item.product_code,
			item.note,
            item.quantity,
            `${item.price.toFixed(2)} PLN`,
            `${(item.price * item.quantity).toFixed(2)} PLN`,
            ]),
			styles: {
            font: 'Roboto',
        },
        });
        
        const finalY = doc.lastAutoTable.finalY;
    doc.setFontSize(14);
    doc.text(`Suma: ${totalValue.toFixed(2)} PLN`, 14, finalY + 10);

    doc.save(`Zamowienie-${order.customerName.replace(/\s/g, '_') || 'nowe'}.pdf`);
};

const handlePrint = () => {
    const content = printRef.current;
    if (content) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><meta charset="UTF-8"><title>Wydruk Zamówienia</title><script src="https://cdn.tailwindcss.com"></script><style>.print-header { display: block !important; } body { padding: 2rem; }</style></head><body>');
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
    return (
        <div className="h-full flex flex-col">
            <div className="flex-grow p-4 md:p-8 pb-32">
                <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">{order._id ? `Edycja Zamówienia` : 'Nowe Zamówienie'}</h1>
                    <div className="flex gap-2">
                       <button onClick={handleExportCsv} className="flex items-center justify-center p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            <FileText className="w-5 h-5"/> <span className="hidden sm:inline ml-2">CSV</span>
                        </button>
                        <button onClick={handleExportPdf} className="flex items-center justify-center p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                            <FileDown className="w-5 h-5"/> <span className="hidden sm:inline ml-2">PDF</span>
                        </button>
                        <input type="file" ref={importFileRef} onChange={handleFileImport} className="hidden" accept=".csv" />
                        <button onClick={() => importFileRef.current.click()} className="flex items-center justify-center p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors">
                            <FileUp className="w-5 h-5"/> <span className="hidden sm:inline ml-2">Importuj</span>
                        </button>
                    </div>
                </div>
					<div className="flex flex-wrap items-center gap-4 mb-6">
                    <input 
                        type="text" 
                        value={order.customerName || ''} 
                        onChange={(e) => updateOrder({ customerName: e.target.value })} 
                        placeholder="Wprowadź nazwę klienta" 
                        className="w-full max-w-lg p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {order._id && (
                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <input 
                                type="checkbox"
                                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500"
                                checked={order.status === 'Zakończono'}
                                onChange={(e) => {
                                    const newStatus = e.target.checked ? 'Zakończono' : 'Zapisane';
                                    handleStatusChange(newStatus);
                                }}
                            />
                            <span className="font-medium">Oznacz jako zakończone</span>
                        </label>
                    )}
                </div>
                <div ref={printRef} className="flex-grow bg-gray-50 dark:bg-gray-900 p-2 sm:p-4 rounded-lg shadow-inner mt-6">
                    <div className="print-header hidden p-4"><h2 className="text-2xl font-bold">Zamówienie dla: {order.customerName}</h2><p>Data: {new Date().toLocaleDateString()}</p></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="p-2 cursor-pointer" onClick={() => requestSort('name')}><div className="flex items-center">Nazwa {getSortIcon('name')}</div></th>
                                    <th className="hidden md:table-cell p-2 cursor-pointer" onClick={() => requestSort('product_code')}><div className="flex items-center">Kod produktu {getSortIcon('product_code')}</div></th>
                                    <th className="p-2 text-right cursor-pointer" onClick={() => requestSort('price')}><div className="flex items-center justify-end">Cena {getSortIcon('price')}</div></th>
                                    <th className="p-2 text-center cursor-pointer" onClick={() => requestSort('quantity')}><div className="flex items-center justify-center">Ilość {getSortIcon('quantity')}</div></th>
                                    <th className="p-2 text-right">Wartość</th>
                                    <th className="p-2 text-center">Akcje</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedItems.map((item, index) => (
                                    <tr key={item._id || index} className={`border-b border-gray-200 dark:border-gray-700 last:border-0 ${item.isCustom ? 'text-yellow-500' : ''}`}>
                                        <td className="p-2 font-medium"><span className="truncate block max-w-[15ch] sm:max-w-none">{item.name}</span>{item.note && <p className="text-xs text-gray-400 mt-1">Notatka: {item.note}</p>}</td>
                                        <td className="hidden md:table-cell p-2">{item.product_code}</td>
                                        <td className="p-2 text-right">{item.price.toFixed(2)}</td>
                                        <td className="p-2 text-center">
                                            <input type="number" value={item.quantity || ''} onChange={(e) => updateQuantity(index, e.target.value)} onFocus={(e) => e.target.select()} className="w-16 text-center bg-transparent border rounded-md p-1 focus:ring-2 focus:ring-indigo-500 outline-none"/>
                                        </td>
                                        <td className="p-2 text-right font-semibold">{(item.price * (item.quantity || 0)).toFixed(2)}</td>
                                        <td className="p-2 text-center whitespace-nowrap">
                                            <button onClick={() => setNoteModal({ isOpen: true, itemIndex: index, text: item.note || '' })} className="p-2 text-gray-500 hover:text-blue-500"><MessageSquare className="w-5 h-5"/></button>
                                            <button onClick={() => removeItemFromOrder(index)} className="p-2 text-gray-500 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
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
            </div>
            
            <PinnedInputBar onProductAdd={addProductToOrder} onSave={handleSaveOrder} isDirty={order.isDirty} />

            <Modal isOpen={noteModal.isOpen} onClose={() => setNoteModal({ isOpen: false, itemIndex: null, text: '' })} title="Dodaj notatkę do pozycji">
                <textarea value={noteModal.text} onChange={(e) => setNoteModal({...noteModal, text: e.target.value})} className="w-full p-2 border rounded-md min-h-[100px] bg-white dark:bg-gray-700"></textarea>
                <div className="flex justify-end gap-4 mt-4"><button onClick={() => setNoteModal({ isOpen: false, itemIndex: null, text: '' })} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={handleNoteSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz notatkę</button></div>
            </Modal>
        </div>
    );
};

// ... (Rest of the file remains the same)
// ... (OrdersListView, PickingView, InventoryView, AdminView, etc.)
// ... (Make sure to include the closing part of the App component and the AppWrapper)

const OrdersListView = ({ onEdit }) => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalState, setModalState] = useState({ isOpen: false, orderId: null, type: '' });
    const { showNotification } = useNotification();
    const [filters, setFilters] = useState({ customer: '', author: '', dateFrom: '', dateTo: '' });
    const [showFilters, setShowFilters] = useState(false);
    const importMultipleRef = useRef(null);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedOrders = await api.getOrders(filters);
            setOrders(fetchedOrders);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [filters, showNotification]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const groupedOrders = useMemo(() => {
        const groups = {
            'Braki': [],
            'Zapisane': [],
            'Skompletowane': [],
            'Zakończono': [],
        };
        orders.forEach(order => {
            if (groups[order.status]) {
                groups[order.status].push(order);
            }
        });
        return groups;
    }, [orders]);
    
    const handleDelete = async () => {
        try {
            await api.deleteOrder(modalState.orderId);
            showNotification('Zamówienie usunięte!', 'success');
            setModalState({ isOpen: false, orderId: null, type: '' });
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

    const handleMultipleFileImport = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        try {
            const result = await api.importMultipleOrdersFromCsv(files);
            showNotification(result.message, 'success');
            fetchOrders();
        } catch (error) {
            showNotification(error.message, 'error');
        }
        event.target.value = null;
    };
    
    return (
        <>
            <div className="p-4 md:p-8">
                <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Wszystkie Zamówienia</h1>
                    <div className="flex items-center gap-2 flex-wrap">
                        <input type="file" ref={importMultipleRef} onChange={handleMultipleFileImport} className="hidden" accept=".csv" multiple />
                        <button onClick={() => importMultipleRef.current.click()} className="flex items-center p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"><FileUp className="w-5 h-5"/><span className="hidden sm:inline ml-2">Importuj</span></button>
                        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center p-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"><Filter className="w-5 h-5"/><span className="hidden sm:inline ml-2">Filtry</span></button>
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
                <div className="space-y-6">
                    {Object.entries(groupedOrders).map(([status, orderList]) => (
                        orderList.length > 0 && (
                            <div key={status}>
                                <h2 className="text-xl font-bold mb-3 text-gray-700 dark:text-gray-300">{status} ({orderList.length})</h2>
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="p-3">Klient</th>
                                                <th className="p-3 hidden md:table-cell">Autor</th>
                                                <th className="p-3 hidden sm:table-cell">Data</th>
                                                <th className="p-3 text-right">Wartość</th>
                                                <th className="p-3 text-center">Akcje</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {orderList.map(order => (
                                                <tr key={order._id}>
                                                    <td className="p-3 font-medium">{order.customerName}</td>
                                                    <td className="p-3 hidden md:table-cell">{order.author}</td>
                                                    <td className="p-3 hidden sm:table-cell">{new Date(order.date).toLocaleDateString()}</td>
                                                    <td className="p-3 text-right font-semibold">{(order.total || 0).toFixed(2)}</td>
                                                    <td className="p-3 text-center whitespace-nowrap">
                                                        <Tooltip text="Edytuj/Pokaż"><button onClick={() => onEdit(order._id)} className="p-2 text-blue-500 hover:text-blue-700"><Edit className="w-5 h-5"/></button></Tooltip>
                                                        <Tooltip text="Usuń"><button onClick={() => setModalState({ isOpen: true, orderId: order._id, type: 'delete' })} className="p-2 text-red-500 hover:text-red-700"><Trash2 className="w-5 h-5"/></button></Tooltip>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    ))}
                </div>
                 {orders.length === 0 && !isLoading && <p className="text-center text-gray-500 mt-8">Brak zamówień do wyświetlenia.</p>}
            </div>
            <Modal isOpen={modalState.isOpen} onClose={() => setModalState({ isOpen: false })} title="Potwierdź usunięcie">
                <p>Czy na pewno chcesz usunąć to zamówienie? Tej operacji nie można cofnąć.</p>
                <div className="flex justify-end gap-4 mt-6"><button onClick={() => setModalState({ isOpen: false })} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg">Usuń</button></div>
            </Modal>
        </>
    );
};

// ... (The rest of your components like PickingView, InventoryView, AdminView etc.)

// --- App Component ---
function App() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentOrder, setCurrentOrder] = useState(() => getInitialOrder());
    const [isDirty, setIsDirty] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogin = useCallback((data) => {
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        setUser(data.user);
        navigate('/dashboard');
    }, [navigate]);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('draftOrder');
        setUser(null);
        navigate('/login');
    }, [navigate]);

    useEffect(() => {
        const handleAuthError = () => {
            handleLogout();
        };
        window.addEventListener('auth-error', handleAuthError);
        return () => window.removeEventListener('auth-error', handleAuthError);
    }, [handleLogout]);

    const handleNewOrder = () => {
        if (isDirty && location.pathname.startsWith('/order')) {
            if (!window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz utworzyć nowe zamówienie? Zmiany zostaną utracone.")) {
                return;
            }
        }
        const newBlankOrder = { customerName: '', items: [], isDirty: false };
        localStorage.setItem('draftOrder', JSON.stringify(newBlankOrder));
        setCurrentOrder(newBlankOrder);
        setIsDirty(false);
        navigate('/order');
    };

    const loadOrderForEditing = async (orderId) => {
        try {
            const order = await api.getOrderById(orderId);
            setCurrentOrder(order);
            navigate('/order');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
    
    useEffect(() => {
        const userData = localStorage.getItem('userData');
        if (userData) {
            try { setUser(JSON.parse(userData)); } catch (e) { handleLogout(); }
        }
        setIsLoading(false);
    }, [handleLogout]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen">Ładowanie...</div>;
    }
    
    return (
        <>
            <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
                {user && <Sidebar user={user} onLogout={handleLogout} onOpenPasswordModal={() => setIsPasswordModalOpen(true)} onNewOrder={handleNewOrder} />}
                <main className="flex-1 flex flex-col overflow-y-auto">
                    <Routes>
                        {!user ? (
                            <>
                                <Route path="/login" element={<AuthPage onLogin={handleLogin} />} />
                                <Route path="*" element={<Navigate to="/login" replace />} />
                            </>
                        ) : (
                            <>
                                <Route path="/dashboard" element={<DashboardView user={user} onNavigate={navigate} />} />
                                <Route path="/search" element={<MainSearchView />} />
                                <Route path="/order" element={<OrderView currentOrder={currentOrder} setCurrentOrder={setCurrentOrder} user={user} setDirty={setIsDirty} />} />
                                <Route path="/orders" element={<OrdersListView onEdit={loadOrderForEditing} />} />
                                <Route path="/picking" element={<PickingView />} />
                                {/* Add other routes here */}
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </>
                        )}
                    </Routes>
                </main>
            </div>
            <UserChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
        </>
    );
}

const getInitialOrder = () => {
    try {
        const savedOrder = localStorage.getItem('draftOrder');
        if (savedOrder) {
            const parsed = JSON.parse(savedOrder);
            if (!parsed._id) { 
                return { ...parsed, isDirty: true };
            }
        }
    } catch (error) {
        console.error("Błąd odczytu roboczego zamówienia z localStorage:", error);
        localStorage.removeItem('draftOrder');
    }
    return { customerName: '', items: [], isDirty: false };
};

const Sidebar = ({ user, onLogout, onOpenPasswordModal, onNewOrder }) => {
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
    const [isNavOpen, setIsNavOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    const toggleTheme = () => {
        localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
        setIsDarkMode(!isDarkMode);
    };

    const navItems = useMemo(() => [
        { id: 'dashboard', label: 'Panel Główny', icon: Home, roles: ['user', 'administrator'] },
        { id: 'search', label: 'Wyszukiwarka', icon: Search, roles: ['user', 'administrator'] },
        { id: 'order', label: 'Nowe Zamówienie', icon: PlusCircle, roles: ['user', 'administrator'], action: onNewOrder },
        { id: 'orders', label: 'Zamówienia', icon: Archive, roles: ['user', 'administrator'] },
        { id: 'picking', label: 'Kompletacja', icon: List, roles: ['user', 'administrator'] },
        { id: 'inventory', label: 'Inwentaryzacja', icon: Wrench, roles: ['user', 'administrator'] },
        { id: 'admin', label: 'Panel Admina', icon: Settings, roles: ['administrator'] },
    ].filter(item => item.roles.includes(user.role)), [user.role, onNewOrder]);
	
    return (
        <nav className={`w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out z-40 fixed lg:static h-full ${isNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
             <div className="flex items-center justify-center h-20 border-b border-gray-200 dark:border-gray-700">
                <img src={isDarkMode ? "/logo-dark.png" : "/logo.png"} onError={(e) => { e.currentTarget.style.display = 'none'; }} alt="Logo" className="h-10" />
            </div>
            <ul className="flex-grow overflow-y-auto">
                {navItems.map(item => (
                    <li key={item.id}>
                        <Link to={`/${item.id}`} onClick={(e) => { if(item.action) { e.preventDefault(); item.action(); } setIsNavOpen(false); }} className={`w-full flex items-center justify-start h-12 px-6 text-base transition-colors duration-200 text-left ${location.pathname.startsWith(`/${item.id}`) ? 'bg-indigo-50 dark:bg-gray-700 text-indigo-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            <item.icon className="h-5 w-5" />
                            <span className="ml-4">{item.label}</span>
                        </Link>
                    </li>
                ))}
            </ul>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <div><p className="font-semibold">{user.username}</p><p className="text-sm text-gray-500">{user.role}</p></div>
                    <div className="flex items-center">
                        <Tooltip text="Zmień hasło"><button onClick={() => { onOpenPasswordModal(); setIsNavOpen(false); }} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><KeyRound className="h-6 w-6 text-gray-500" /></button></Tooltip>
                        <Tooltip text="Wyloguj"><button onClick={onLogout} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><LogOut className="h-6 w-6 text-gray-500" /></button></Tooltip>
                    </div>
                </div>
                <Tooltip text="Zmień motyw"><button onClick={toggleTheme} className="w-full flex justify-center p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">{isDarkMode ? <Sun className="h-6 w-6 text-yellow-400" /> : <Moon className="h-6 w-6 text-indigo-500" />}</button></Tooltip>
            </div>
        </nav>
    );
};

export default function AppWrapper() {
    return (
        <ErrorBoundary>
            <NotificationProvider>
                <Router>
                    <App />
                </Router>
            </NotificationProvider>
        </ErrorBoundary>
    );
}

