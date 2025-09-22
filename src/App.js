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

    useEffect(() => {
        if (query.length < 2) {
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
        if (value.length > 13) {
            showNotification("Kod EAN nie może przekraczać 13 znaków.", "error");
            setQuery(value.substring(0, 13)); // Obcina wartość zamiast ją czyścić
        } else {
            setQuery(value);
        }
    };
	
    const handleKeyDown = async (e) => {
        if (e.key === 'Enter' && query.trim() !== '') {
            e.preventDefault();
            
            const exactMatch = suggestions.find(s => s.barcodes.includes(query.trim()) || s.product_code === query.trim());
            if (exactMatch) {
                handleAdd(exactMatch);
                return;
            }

            if (suggestions.length === 0) {
                try {
                    const results = await api.searchProducts(query.trim());
                    if (results.length === 1) {
                        handleAdd(results[0]);
                        return;
                    } else if (results.length > 1) {
                        setSuggestions(results);
                        return;
                    }
                } catch (error) {
                    // Ignoruj błąd
                }
            }

            const customItem = {
                _id: `custom-${Date.now()}`,
                name: `EAN: ${query}`,
                product_code: 'SPOZA LISTY',
                barcodes: [query],
                price: 0,
                isCustom: true,
            };
            handleAdd(customItem);
        }
    };

    return (
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-top z-20 p-4">
            <div className="max-w-4xl mx-auto relative">
                {suggestions.length > 0 && (
                    <ul className="absolute bottom-full mb-2 w-full bg-white dark:bg-gray-700 border rounded-lg shadow-xl max-h-60 overflow-y-auto z-30">
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
        // Zapisuj w localStorage tylko jeśli to nowe, niezapisane zamówienie (brak _id)
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
        // Używamy unikalnego identyfikatora, który działa też dla produktów spoza listy
        const uniqueIdentifier = product.isCustom ? `custom-${product.barcodes[0]}` : product._id;

        const existingItemIndex = newItems.findIndex(item => {
            const itemIdentifier = item.isCustom ? `custom-${item.barcodes[0]}` : item._id;
            return itemIdentifier === uniqueIdentifier;
        });

        if (existingItemIndex > -1) {
            // Jeśli produkt już istnieje na liście, zwiększ jego ilość o 1 (kolejny skan)
            newItems[existingItemIndex].quantity += 1;
        } else {
            // Jeśli to nowy produkt, dodaj go z domyślną ilością 1 (pierwszy skan)
            newItems.push({ ...product, quantity: 1, note: '' });
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
            localStorage.removeItem('draftOrder'); // Czyścimy dane robocze po zapisie
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

const PickingView = () => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [toPickItems, setToPickItems] = useState([]);
    const [pickedItems, setPickedItems] = useState([]);
    const [pickModal, setPickModal] = useState({ isOpen: false, item: null });
    const [summaryModal, setSummaryModal] = useState({ isOpen: false, discrepancies: [] });
    const [pickedQuantity, setPickedQuantity] = useState('');
    const { showNotification } = useNotification();
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const searchInputRef = useRef(null);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const ordersToPick = await api.getOrders({ status: ['Braki', 'Zakończono'] });
            
            ordersToPick.sort((a, b) => {
                if (a.status === 'Braki' && b.status !== 'Braki') return -1;
                if (a.status !== 'Braki' && b.status === 'Braki') return 1;
                return new Date(b.date) - new Date(a.date);
            });

            setOrders(ordersToPick);
        } catch (error) { 
            showNotification(error.message, 'error'); 
        } finally { 
            setIsLoading(false); 
        }
    }, [showNotification]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    useEffect(() => {
        if (!selectedOrder || inputValue.length < 2) { setSuggestions([]); return; }
        const lowerCaseInput = inputValue.toLowerCase();
        const availableSuggestions = toPickItems.filter(item => 
            item.name.toLowerCase().includes(lowerCaseInput) || 
            (item.product_code && item.product_code.toLowerCase().includes(lowerCaseInput)) ||
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
    
    const openPickModal = (item) => {
        setPickModal({ isOpen: true, item: item });
        setPickedQuantity(String(item.quantity));
    };

    const handleConfirmPick = () => {
        const quantity = parseInt(pickedQuantity, 10);
        if (isNaN(quantity) || quantity < 0) { showNotification("Proszę wpisać poprawną ilość.", 'error'); return; }
        const currentItem = pickModal.item;
        setPickedItems(prev => [...prev, { ...currentItem, pickedQuantity: quantity }]);
        setToPickItems(prev => prev.filter(item => item._id !== currentItem._id));
        setPickModal({ isOpen: false, item: null });
        setPickedQuantity('');
        setInputValue('');
        searchInputRef.current?.focus();
    };

    const handlePickItem = (itemToPick) => {
        openPickModal(itemToPick);
        setInputValue('');
        setSuggestions([]);
    };
    
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && inputValue.trim() !== '') {
            e.preventDefault();
            const directMatch = toPickItems.find(item => item.barcodes.includes(inputValue.trim()));
            if (directMatch) {
                handlePickItem(directMatch);
            } else if (suggestions.length === 1) { 
                handlePickItem(suggestions[0]); 
            }
        }
    };

    const handleShowSummary = () => {
        if (pickedItems.length === 0 && toPickItems.length > 0) {
            showNotification("Nie skompletowano żadnych produktów.", "error");
            return;
        }
    
        const allOrderItems = [...pickedItems, ...toPickItems];
        const discrepancies = allOrderItems
            .map(item => {
                const pickedItem = pickedItems.find(p => p._id === item._id);
                const pickedQuantity = pickedItem ? pickedItem.pickedQuantity : 0;
                return {
                    ...item,
                    pickedQuantity: pickedQuantity,
                    diff: pickedQuantity - item.originalQuantity
                };
            })
            .filter(item => item.diff !== 0 || !pickedItems.find(p => p._id === item._id));
    
        setSummaryModal({ isOpen: true, discrepancies });
    };

    const handleCompleteOrder = async () => {
        try {
            const allOrderItems = [...pickedItems, ...toPickItems]; 
            await api.processCompletion(selectedOrder._id, pickedItems, allOrderItems);
            showNotification('Zamówienie zostało pomyślnie przetworzone!', 'success');
            setSummaryModal({ isOpen: false, discrepancies: [] });
            fetchOrders(); 
            setSelectedOrder(null);
            setToPickItems([]);
            setPickedItems([]);
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

        if (!selectedOrder) {
        return (
            <div className="p-4 md:p-8">
                <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Kompletacja Zamówień</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {orders.map(order => {
                        const isClickable = true;
                        const bgColor = {
                            'Braki': 'bg-yellow-50 dark:bg-yellow-900/40',
                            'Zakończono': 'bg-gray-50 dark:bg-gray-800',
                        }[order.status] || 'bg-white dark:bg-gray-800';
                        
                        const statusStyle = {
                            'Braki': 'bg-yellow-200 text-yellow-800',
                            'Zakończono': 'bg-gray-200 text-gray-800',
                        }[order.status] || 'bg-blue-100 text-blue-800';

                        return (
                            <div 
                                key={order._id} 
                                onClick={() => isClickable && handleSelectOrder(order)} 
                                className={`p-4 rounded-lg shadow-md transition-all ${bgColor} ${isClickable ? 'cursor-pointer hover:shadow-lg hover:scale-105' : 'opacity-60 cursor-not-allowed'}`}
                            >
                                <p className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{order.customerName}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Autor: {order.author}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(order.date).toLocaleDateString()}</p>
                                <div className={`mt-2 text-xs font-semibold px-2 py-1 inline-block rounded-full ${statusStyle}`}>
                                    {order.status}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {orders.length === 0 && !isLoading && <p className="text-center text-gray-500 mt-8">Brak zamówień do kompletacji.</p>}
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
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3 max-h-96 overflow-y-auto">{toPickItems.map(item => <div key={item._id} onClick={() => openPickModal(item)} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"><div><p className="font-semibold">{item.name}</p><p className="text-sm text-gray-500">{item.product_code}</p></div><div className="text-lg font-bold px-3 py-1 bg-blue-100 text-blue-800 rounded-full">{item.quantity}</div></div>)} {toPickItems.length === 0 && <p className="text-center text-gray-500 p-4">Wszystko skompletowane.</p>}</div>
                </div>
                <div>
                    <h2 className="text-2xl font-semibold mb-4">Skompletowano ({pickedItems.length})</h2>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3 max-h-96 overflow-y-auto">{pickedItems.map(item => { const isMismatch = item.pickedQuantity !== item.originalQuantity; return (<div key={item._id} className={`flex justify-between items-center p-3 rounded-lg ${isMismatch ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}><div><p className="font-semibold">{item.name}</p><p className="text-sm text-gray-500">{item.product_code}</p></div><div className="flex items-center gap-2"><Tooltip text="Cofnij"><button onClick={() => handleUndoPick(item)} className="p-1 text-gray-500 hover:text-blue-600"><RotateCcw className="w-4 h-4" /></button></Tooltip><div className={`text-lg font-bold px-3 py-1 rounded-full flex items-center gap-2 ${isMismatch ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{isMismatch && <AlertTriangle className="w-4 h-4" />} {item.pickedQuantity} / {item.originalQuantity}</div></div></div>);})} {pickedItems.length === 0 && <p className="text-center text-gray-500 p-4">Brak pozycji.</p>}</div>
                </div>
            </div>
            <div className="mt-8 flex justify-center gap-4">
                <button onClick={handleShowSummary} className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">
                    <CheckCircle className="w-5 h-5 mr-2 inline-block"/> Zatwierdź kompletację
                </button>
                <button onClick={exportCompletion} className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                    <FileDown className="w-5 h-5 mr-2 inline-block"/> Eksportuj
                </button>
            </div>
            
            <Modal isOpen={pickModal.isOpen} onClose={() => setPickModal({isOpen: false, item: null})} title="Wpisz ilość">
                {pickModal.item && (
                    <div>
                        <p className="mb-4 text-lg font-semibold">{pickModal.item.name}</p>
                        <input type="number" value={pickedQuantity} onChange={(e) => setPickedQuantity(e.target.value)} className="w-full p-3 bg-white dark:bg-gray-700 border rounded-lg text-center text-2xl" autoFocus onKeyPress={(e) => e.key === 'Enter' && handleConfirmPick()}/>
                        <button onClick={handleConfirmPick} className="w-full mt-4 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg">Akceptuj</button>
                    </div>
                )}
            </Modal>

            <Modal isOpen={summaryModal.isOpen} onClose={() => setSummaryModal({isOpen: false, discrepancies: []})} title="Podsumowanie kompletacji" maxWidth="2xl">
                <div>
                    {summaryModal.discrepancies.length > 0 ? (
                        <div>
                            <p className="mb-4 text-lg text-red-600 dark:text-red-400">Wykryto następujące niezgodności:</p>
                            <ul className="space-y-2 max-h-60 overflow-y-auto">
                                {summaryModal.discrepancies.map(item => (
                                    <li key={item._id} className="p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                                        <strong>{item.name}</strong>: Oczekiwano {item.originalQuantity}, skompletowano {item.pickedQuantity} (Różnica: <span className="font-bold">{item.diff > 0 ? `+${item.diff}`: item.diff}</span>)
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <p className="mb-4 text-lg text-green-600 dark:text-green-400">Wszystkie pozycje zostały skompletowane zgodnie z zamówieniem.</p>
                    )}
                    <p className="mt-6">Czy na pewno chcesz zatwierdzić tę kompletację i oznaczyć zamówienie jako 'Skompletowane'?</p>
                    <div className="flex justify-end gap-4 mt-6">
                        <button onClick={() => setSummaryModal({isOpen: false, discrepancies: []})} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg">Anuluj</button>
                        <button onClick={handleCompleteOrder} className="px-4 py-2 bg-green-600 text-white rounded-lg">Tak, zatwierdź</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// --- Moduł Inwentaryzacji ---

const InventoryView = ({ user, onNavigate, isDirty, setIsDirty }) => {
    const [inventories, setInventories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, invId: null });
    const importMultipleRef = useRef(null);
    const { items: sortedInventories, requestSort, sortConfig } = useSortableData(inventories);

    const getSortIcon = (name) => {
        if (!sortConfig || sortConfig.key !== name) {
            return <ChevronsUpDown className="w-4 h-4 ml-1 opacity-40" />;
        }
        return sortConfig.direction === 'ascending' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
    };

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
        fetchInventories();
    }, [fetchInventories]);

    const handleNewInventory = () => {
        onNavigate('inventory-sheet');
    };
    
    const handleEdit = (inventoryId) => {
        onNavigate('inventory-sheet', { inventoryId });
    };

    const handleDelete = async () => {
        try {
            await api.deleteInventory(deleteModal.invId);
            showNotification('Inwentaryzacja usunięta.', 'success');
            setDeleteModal({ isOpen: false, invId: null });
            fetchInventories();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
    
    const handleMultipleFileImport = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        try {
            const result = await api.importMultipleInventorySheets(files);
            showNotification(result.message, 'success');
            fetchInventories();
        } catch (error) {
            showNotification(error.message, 'error');
        }
        event.target.value = null;
    };

    if (isLoading) {
        return <div className="p-8 text-center">Ładowanie...</div>;
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Zapisane inwentaryzacje</h1>
                <div className="flex gap-2">
                    <input type="file" ref={importMultipleRef} onChange={handleMultipleFileImport} className="hidden" accept=".csv" multiple />
                    <button onClick={() => importMultipleRef.current.click()} className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"><FileUp className="w-5 h-5 mr-2"/> Importuj wiele</button>
                    <button onClick={handleNewInventory} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <PlusCircle className="w-5 h-5 mr-2"/> Nowa inwentaryzacja
                    </button>
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="p-4 cursor-pointer" onClick={() => requestSort('name')}><div className="flex items-center">Nazwa {getSortIcon('name')}</div></th>
                            <th className="p-4 cursor-pointer" onClick={() => requestSort('author')}><div className="flex items-center">Autor {getSortIcon('author')}</div></th>
                            <th className="p-4 cursor-pointer" onClick={() => requestSort('date')}><div className="flex items-center">Data {getSortIcon('date')}</div></th>
                            <th className="p-4 cursor-pointer" onClick={() => requestSort('totalItems')}><div className="flex items-center">Pozycje {getSortIcon('totalItems')}</div></th>
                            <th className="p-4 cursor-pointer" onClick={() => requestSort('totalQuantity')}><div className="flex items-center">Sztuki {getSortIcon('totalQuantity')}</div></th>
                            <th className="p-4">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedInventories.map(inv => (
                            <tr key={inv._id}>
                                <td className="p-4 font-medium">{inv.name}</td>
                                <td className="p-4">{inv.author}</td>
                                <td className="p-4">{format(new Date(inv.date), 'd MMM yy, HH:mm', { locale: pl })}</td>
                                <td className="p-4">{inv.totalItems}</td>
                                <td className="p-4">{inv.totalQuantity}</td>
                                <td className="p-4">
                                    <button onClick={() => handleEdit(inv._id)} className="p-2 text-blue-500 hover:text-blue-700"><Edit className="w-5 h-5"/></button>
                                    {user.role === 'administrator' && (
                                        <button onClick={() => setDeleteModal({ isOpen: true, invId: inv._id })} className="p-2 text-red-500 hover:text-red-700"><Trash2 className="w-5 h-5"/></button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false, invId: null })} title="Potwierdź usunięcie">
                <p>Czy na pewno chcesz usunąć tę inwentaryzację? Tej operacji nie można cofnąć.</p>
                <div className="flex justify-end gap-4 mt-6"><button onClick={() => setDeleteModal({ isOpen: false, invId: null })} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg">Usuń</button></div>
            </Modal>
        </div>
    );
};


const NewInventorySheet = ({ user, onSave, inventoryId = null, setDirty }) => {
    const [inventory, setInventory] = useState({ name: '', items: [] });
    const [isLoading, setIsLoading] = useState(!!inventoryId);
    const [discrepancyModal, setDiscrepancyModal] = useState({ isOpen: false });
    const printRef = useRef(null);
    const { showNotification } = useNotification();
    const importFileRef = useRef(null);
    const { items: sortedItems, requestSort, sortConfig } = useSortableData(inventory.items);

    const getSortIcon = (name) => {
        if (!sortConfig || sortConfig.key !== name) {
            return <ChevronsUpDown className="w-4 h-4 ml-1 opacity-40" />;
        }
        return sortConfig.direction === 'ascending' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
    };

    useEffect(() => {
        if (inventoryId) {
            const fetchInventory = async () => {
                setIsLoading(true);
                try {
                    const data = await api.getInventoryById(inventoryId);
                    setInventory(data);
                } catch (error) {
                    showNotification(error.message, 'error');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchInventory();
        } else {
            setInventory({ name: '', items: [], isDirty: false });
        }
    }, [inventoryId, showNotification]);

    const updateInventory = (updates, isDirty = true) => {
        const newInventory = { ...inventory, ...updates, isDirty };
        setInventory(newInventory);
        setDirty(isDirty);
    };

    const addProductToInventory = (product, quantity) => {
        const newItems = [...inventory.items];
        const existingItemIndex = newItems.findIndex(item => item._id === product._id && !item.isCustom);
        if (existingItemIndex > -1) {
            newItems[existingItemIndex].quantity = (newItems[existingItemIndex].quantity || 0) + quantity;
        } else {
            newItems.push({ ...product, quantity, expectedQuantity: product.quantity, isCustom: !!product.isCustom });
        }
        updateInventory({ items: newItems });
    };

    const updateQuantity = (id, newQuantityStr) => {
        const newQuantity = parseInt(newQuantityStr, 10);
        const newItems = inventory.items.map(item => {
            if (item._id === id) {
                return { ...item, quantity: isNaN(newQuantity) || newQuantity < 0 ? 0 : newQuantity };
            }
            return item;
        });
        updateInventory({ items: newItems });
    };
    
    const removeItem = (id) => {
        updateInventory({ items: inventory.items.filter(item => item._id !== id) });
    };

    const handleSave = async () => {
        if (!inventory.name) {
            showNotification('Proszę podać nazwę inwentaryzacji.', 'error');
            return;
        }
        try {
            const payload = { ...inventory, author: user.username };
            const { inventory: savedInventory } = await api.saveInventory(payload);
            setInventory(savedInventory);
            setDirty(false);
            showNotification('Inwentaryzacja została pomyślnie zapisana.', 'success');
            onSave();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleFileImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const { items } = await api.importInventorySheet(file);
            updateInventory({ items });
            showNotification(`Zaimportowano ${items.length} pozycji do arkusza.`, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
        event.target.value = null;
    };
    
    const handleExport = () => {
        const csvContent = inventory.items
            .map(item => `${item.barcodes[0] || ''},${item.quantity || 0}`)
            .join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `inwentaryzacja_${inventory.name.replace(/\s/g, '_')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintDiscrepancies = () => {
        const content = printRef.current;
        if (content) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write('<html><head><title>Wykaz Rozbieżności</title><style>body{font-family:sans-serif; padding: 2rem;} table{width:100%; border-collapse:collapse;} th,td{border:1px solid #ddd; padding:8px; text-align:left;} th{background-color:#f2f2f2;}</style></head><body>');
            printWindow.document.write(content.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
        }
    };
    
    const discrepancies = inventory.items.filter(item => (item.quantity || 0) !== (item.expectedQuantity ?? 0));

    if (isLoading) { return <div className="p-8 text-center">Ładowanie...</div>; }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-grow p-4 md:p-8 pb-32">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold">{inventoryId ? 'Edycja' : 'Nowa'} Inwentaryzacja</h1>
                    <div className="flex gap-2">
                        <button onClick={() => setDiscrepancyModal({ isOpen: true })} className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"><BarChart2 className="w-5 h-5 mr-2"/> Wykaz rozbieżności</button>
                        <button onClick={handleExport} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><FileDown className="w-5 h-5 mr-2"/> Eksportuj</button>
                        <input type="file" ref={importFileRef} onChange={handleFileImport} className="hidden" accept=".csv" />
                        <button onClick={() => importFileRef.current.click()} className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"><FileUp className="w-5 h-5 mr-2"/> Importuj</button>
                    </div>
                </div>
                <input type="text" value={inventory.name} onChange={(e) => updateInventory({ name: e.target.value })} placeholder="Wprowadź nazwę listy spisowej" className="w-full max-w-lg p-3 mb-6 bg-white dark:bg-gray-700 border rounded-lg"/>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr className="border-b">
                                <th className="p-3 cursor-pointer" onClick={() => requestSort('name')}><div className="flex items-center">Nazwa {getSortIcon('name')}</div></th>
                                <th className="p-3 cursor-pointer" onClick={() => requestSort('product_code')}><div className="flex items-center">Kod produktu {getSortIcon('product_code')}</div></th>
                                <th className="p-3 text-center cursor-pointer" onClick={() => requestSort('expectedQuantity')}><div className="flex items-center justify-center">Oczekiwano {getSortIcon('expectedQuantity')}</div></th>
                                <th className="p-3 text-center cursor-pointer" onClick={() => requestSort('quantity')}><div className="flex items-center justify-center">Zliczono {getSortIcon('quantity')}</div></th>
                                <th className="p-3 text-center">Różnica</th>
                                <th className="p-3 text-center">Akcje</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedItems.map(item => {
                                const expected = item.expectedQuantity ?? 0;
                                const counted = item.quantity || 0;
                                const diff = counted - expected;
                                return (
                                    <tr key={item._id} className={`border-b last:border-0 ${(item.quantity || 0) === 0 ? 'bg-orange-50 dark:bg-orange-900/20' : ''} ${item.isCustom ? 'text-yellow-500' : ''}`}>
                                        <td className="p-2 font-medium">{item.name}</td>
                                        <td className="p-2">{item.product_code}</td>
                                        <td className="p-2 text-center">{item.expectedQuantity ?? 'N/A'}</td>
                                        <td className="p-2 text-center">
                                            <input type="number" value={item.quantity || ''} onChange={(e) => updateQuantity(item._id, e.target.value)} className="w-24 text-center bg-transparent border rounded-md p-1 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                        </td>
                                        <td className={`p-2 text-center font-bold ${diff === 0 ? 'text-green-500' : 'text-red-500'}`}>{diff > 0 ? `+${diff}` : diff}</td>
                                        <td className="p-2 text-center">
                                            <button onClick={() => removeItem(item._id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-5 h-5" /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {inventory.items.length === 0 && <p className="text-center text-gray-500 p-8">Brak pozycji na liście. Zaimportuj arkusz lub dodaj produkty, aby rozpocząć.</p>}
                </div>
            </div>
            
            <PinnedInputBar onProductAdd={addProductToInventory} onSave={handleSave} isDirty={inventory.isDirty} />

            <Modal isOpen={discrepancyModal.isOpen} onClose={() => setDiscrepancyModal({ isOpen: false })} title="Wykaz Rozbieżności" maxWidth="4xl">
                <div ref={printRef} className="max-h-[70vh] overflow-y-auto">
                    <h2 className="text-2xl font-bold mb-4">Rozbieżności w inwentaryzacji: {inventory.name}</h2>
                    <p>Data: {format(new Date(), 'PPpp', { locale: pl })}</p>
                    {discrepancies.length > 0 ? (
                        <table className="w-full text-left mt-4">
                            <thead><tr><th>Nazwa</th><th>Kod produktu</th><th>Oczekiwano</th><th>Zliczono</th><th>Różnica</th></tr></thead>
                            <tbody>
                                {discrepancies.map(item => (
                                    <tr key={item._id}>
                                        <td>{item.name}</td><td>{item.product_code}</td><td>{item.expectedQuantity ?? 0}</td><td>{item.quantity || 0}</td><td>{(item.quantity || 0) - (item.expectedQuantity ?? 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="mt-4">Brak rozbieżności.</p>}
                </div>
                <div className="flex justify-end mt-6"><button onClick={handlePrintDiscrepancies} className="px-4 py-2 bg-blue-600 text-white rounded-lg"><Printer className="w-5 h-5 mr-2 inline-block"/>Drukuj</button></div>
            </Modal>
        </div>
    );
};

// --- Moduł Admina ---

const AdminView = ({ user, onNavigate }) => {
    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Panel Administratora</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md cursor-pointer hover:shadow-xl transition-shadow" onClick={() => onNavigate('admin-users')}>
                    <div className="flex items-center">
                        <Users className="w-10 h-10 text-indigo-500 mr-4"/>
                        <div>
                            <h2 className="text-2xl font-semibold">Zarządzanie Użytkownikami</h2>
                            <p className="text-gray-500">Akceptuj, usuwaj i zarządzaj rolami użytkowników.</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md cursor-pointer hover:shadow-xl transition-shadow" onClick={() => onNavigate('admin-products')}>
				<div className="flex items-center">
                        <Package className="w-10 h-10 text-green-500 mr-4"/>
                        <div>
                            <h2 className="text-2xl font-semibold">Zarządzanie Produktami</h2>
                            <p className="text-gray-500">Przeglądaj, importuj i synchronizuj bazę produktów.</p>
                        </div>
                    </div>
				</div>
				<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md cursor-pointer hover:shadow-xl transition-shadow" onClick={() => onNavigate('admin-email')}>
				<div className="flex items-center">
						<Mail className="w-10 h-10 text-orange-500 mr-4"/>
						<div>
							<h2 className="text-2xl font-semibold">Ustawienia E-mail</h2>
							<p className="text-gray-500">Zarządzaj konfiguracją wysyłki powiadomień.</p>
						</div>
					</div>
				</div>
                    
                
            </div>
        </div>
    );
};

const AdminUsersView = ({ user }) => {
    const [users, setUsers] = useState([]);
    const { showNotification } = useNotification();
    const [modalState, setModalState] = useState({ isOpen: false, user: null, type: '' });
    const [newPassword, setNewPassword] = useState('');

    const allModules = [
        { id: 'search', label: 'Wyszukiwarka' },
        { id: 'order', label: 'Nowe Zamówienie' },
        { id: 'orders', label: 'Zamówienia' },
        { id: 'picking', label: 'Kompletacja' },
        { id: 'inventory', label: 'Inwentaryzacja' },
        { id: 'kanban', label: 'Tablica Zadań' },
        { id: 'delegations', label: 'Delegacje' },
		{ id: 'shortage-report', label: 'Raport Braków' }
    ];

    const fetchUsers = useCallback(async () => {
        try {
            const userList = await api.getUsers();
            setUsers(userList);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }, [showNotification]);
    
    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleModuleChange = async (userId, moduleId, isVisible) => {
        const targetUser = users.find(u => u._id === userId);
        if (!targetUser) return;

        let updatedModules;
        const currentModules = targetUser.visibleModules || [];

        if (isVisible) {
            updatedModules = [...currentModules, moduleId];
        } else {
            updatedModules = currentModules.filter(m => m !== moduleId);
        }
        
        try {
            await api.updateUserModules(userId, updatedModules);
            showNotification('Uprawnienia zaktualizowane', 'success');
            setUsers(users.map(u => u._id === userId ? {...u, visibleModules: updatedModules} : u));
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

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

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-2xl font-semibold mb-4">Zarządzanie Użytkownikami</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-4 font-semibold">Użytkownik</th><th className="p-4 font-semibold">Rola</th><th className="p-4 font-semibold">Dostępne moduły</th><th className="p-4 font-semibold text-right">Akcje</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {users.map(u => (
                            <tr key={u._id}>
                                <td className="p-4 font-medium">{u.username}<br/><span className={`text-xs font-semibold rounded-full capitalize ${u.status === 'oczekujący' ? 'text-yellow-500' : 'text-green-500'}`}>{u.status}</span></td>
                                <td className="p-4">
                                    <select value={u.role} onChange={(e) => handleRoleChange(u._id, e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" disabled={user.id === u._id}><option value="user">Użytkownik</option><option value="administrator">Administrator</option></select>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-wrap gap-2">
                                        {allModules.map(module => (
                                            <label key={module.id} className="flex items-center text-sm">
                                                <input
                                                    type="checkbox"
                                                    className="form-checkbox h-4 w-4 text-indigo-600 rounded"
                                                    checked={u.visibleModules?.includes(module.id) || false}
                                                    onChange={(e) => handleModuleChange(u._id, module.id, e.target.checked)}
                                                    disabled={u.role === 'administrator'}
                                                />
                                                <span className="ml-2">{module.label}</span>
                                            </label>
                                        ))}
                                    </div>
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
            <Modal isOpen={modalState.isOpen && modalState.type === 'delete'} onClose={() => setModalState({isOpen: false, user: null, type: ''})} title="Potwierdź usunięcie"><p>Czy na pewno chcesz usunąć użytkownika <strong>{modalState.user?.username}</strong>? Tej operacji nie można cofnąć.</p><div className="flex justify-end gap-4 mt-6"><button onClick={() => setModalState({isOpen: false, user: null, type: ''})} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={() => handleDeleteUser(modalState.user._id)} className="px-4 py-2 bg-red-600 text-white rounded-lg">Usuń</button></div></Modal>
            <Modal isOpen={modalState.isOpen && modalState.type === 'password'} onClose={() => setModalState({isOpen: false, user: null, type: ''})} title={`Zmień hasło dla ${modalState.user?.username}`}><div><label className="block mb-2 text-sm font-medium">Nowe hasło</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"/></div><div className="flex justify-end gap-4 mt-6"><button onClick={() => setModalState({isOpen: false, user: null, type: ''})} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={handleChangePassword} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zmień hasło</button></div></Modal>
        </div>
    );
};


const AdminProductsView = () => {
    const [products, setProducts] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();
    const [isUploading, setIsUploading] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [importMode, setImportMode] = useState('append');

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getAllProducts(page, 20, search);
            setProducts(data.products);
            setTotalPages(data.totalPages);
            setTotalProducts(data.totalProducts);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [page, search, showNotification]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const result = await api.uploadProductsFile(file, importMode);
            showNotification(result.message, 'success');
            fetchProducts();
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
                fetchProducts();
            } catch (error) {
                showNotification(error.message, 'error');
            } finally {
                setIsMerging(false);
            }
        }
    };

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-2xl font-semibold mb-4">Zarządzanie Produktami</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium mb-2">Synchronizuj bazę danych</h3>
                    <p className="text-sm text-gray-500 mb-4">Kolumny: barcode, name, price, product_code, quantity, availability (separator: średnik, separator dziesiętny: przecinek)</p>
                    <div className="flex justify-center gap-4 mb-4">
                        <label className="flex items-center"><input type="radio" name="importMode" value="append" checked={importMode === 'append'} onChange={() => setImportMode('append')} className="mr-2"/>Dopisz / Zaktualizuj</label>
                        <label className="flex items-center"><input type="radio" name="importMode" value="overwrite" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} className="mr-2"/>Nadpisz wszystko</label>
                    </div>
                    <label className={`cursor-pointer w-full text-center block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <Upload className={`w-4 h-4 mr-2 inline-block ${isUploading ? 'animate-spin' : ''}`}/> {isUploading ? 'Przetwarzanie...' : 'Wybierz plik CSV'}
                        <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={isUploading} />
                    </label>
                </div>
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium mb-2">Operacje na danych</h3>
                    <p className="text-sm text-gray-500 mb-4">Połącz zduplikowane produkty (wg. kodu produktu) w jedną pozycję.</p>
                    <button onClick={handleMergeProducts} disabled={isMerging} className="flex items-center justify-center w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400">
                        <GitMerge className={`w-5 h-5 mr-2 ${isMerging ? 'animate-spin' : ''}`} />
                        {isMerging ? 'Przetwarzanie...' : 'Połącz produkty'}
                    </button>
                </div>
            </div>

            <h3 className="text-xl font-semibold mb-4">Wszystkie produkty w bazie ({totalProducts})</h3>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtruj produkty..." className="w-full max-w-lg p-3 mb-6 bg-white dark:bg-gray-700 border rounded-lg"/>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-4">Nazwa</th><th className="p-4">Kod produktu</th><th className="p-4">Kody EAN</th><th className="p-4">Ilość</th><th className="p-4">Cena</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {isLoading ? <tr><td colSpan="5" className="text-center p-8">Ładowanie...</td></tr> :
                        products.map(p => (
                            <tr key={p._id} className="border-b dark:border-gray-700">
                                <td className="p-4">{p.name}</td>
                                <td className="p-4">{p.product_code}</td>
                                <td className="p-4 text-sm text-gray-500 max-w-xs truncate">{p.barcodes.join(', ')}</td>
                                <td className="p-4">{p.quantity}</td>
                                <td className="p-4">{p.price?.toFixed(2)} PLN</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-between items-center mt-4">
                <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg disabled:opacity-50">Poprzednia</button>
                <span>Strona {page} z {totalPages}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg disabled:opacity-50">Następna</button>
            </div>
        </div>
    );
};

// --- Moduł panelu głównego ---

const DashboardView = ({ user, onNavigate }) => {
    const [stats, setStats] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();
    const [layout, setLayout] = useState(user.dashboardLayout || []);
    const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);

    const fetchDashboardData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [statsData, tasksData] = await Promise.all([
                api.getDashboardStats(),
                api.getKanbanTasks(user.id)
            ]);
            setStats(statsData);
            setTasks(tasksData.filter(t => t.status !== 'done'));
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [user.id, showNotification]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const availableWidgets = useMemo(() => ({
        'stats_products': { name: 'Liczba Produktów', component: (props) => <StatCard {...props} title="Produktów w bazie" value={stats?.productCount} icon={<Package />} /> },
        'stats_pending_orders': { name: 'Zamówienia Oczekujące', component: (props) => <StatCard {...props} title="Zamówień do skompletowania" value={stats?.pendingOrders} icon={<List />} onClick={() => onNavigate('picking')} /> },
        'stats_completed_orders': { name: 'Zamówienia Zrealizowane', component: (props) => <StatCard {...props} title="Zamówień skompletowanych" value={stats?.completedOrders} icon={<CheckCircle />} onClick={() => onNavigate('orders')} /> },
        'sales_goals': { name: 'Cele Sprzedażowe', component: (props) => <SalesGoalsWidget {...props} stats={stats} user={user} onUpdate={fetchDashboardData} /> },
        'quick_actions': { name: 'Szybkie Akcje', component: (props) => <QuickActionsWidget {...props} onNavigate={onNavigate} /> },
        'my_tasks': { name: 'Moje Zadania', component: (props) => <MyTasksWidget {...props} tasks={tasks} onNavigate={onNavigate} /> },
        'top_products': { name: 'Najlepsze Produkty', component: (props) => <TopProductsWidget {...props} stats={stats} /> },
        'top_customers': { name: 'Najlepsi Klienci', component: (props) => <TopCustomersWidget {...props} stats={stats} /> },
        'notes_widget': { name: 'Notatki', component: (props) => <NotesWidget {...props} /> },
    }), [stats, tasks, onNavigate, user, fetchDashboardData]);

    const handleLayoutChange = async (newLayout) => {
        setLayout(newLayout);
        try {
            await api.updateUserDashboardLayout(newLayout);
            showNotification('Układ pulpitu został zapisany.', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
    
    const draggedItem = useRef(null);
    const onDragStart = (e, index) => {
        draggedItem.current = index;
        e.dataTransfer.effectAllowed = 'move';
    };
    const onDragOver = (e, index) => {
        e.preventDefault();
        const draggedOverItem = index;
        if (draggedItem.current === draggedOverItem) {
            return;
        }
        const items = [...layout];
        const item = items.splice(draggedItem.current, 1)[0];
        items.splice(draggedOverItem, 0, item);
        draggedItem.current = draggedOverItem;
        setLayout(items);
    };
    const onDragEnd = () => {
        handleLayoutChange(layout);
        draggedItem.current = null;
    };

    if (isLoading) return <div className="text-center p-8">Ładowanie pulpitu...</div>;

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Panel Główny</h1>
                <button onClick={() => setIsCustomizeModalOpen(true)} className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-sm rounded-lg">
                    <Settings className="w-4 h-4 mr-2"/>Dostosuj
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {layout.map((widgetId, index) => {
                    const Widget = availableWidgets[widgetId];
                    if (!Widget) return null;
                    const Component = Widget.component;
                    return (
                        <div
                            key={widgetId}
                            draggable
                            onDragStart={(e) => onDragStart(e, index)}
                            onDragOver={(e) => onDragOver(e, index)}
                            onDragEnd={onDragEnd}
                            className="cursor-move"
                        >
                           <Component />
                        </div>
                    );
                })}
            </div>
            <CustomizeDashboardModal 
                isOpen={isCustomizeModalOpen}
                onClose={() => setIsCustomizeModalOpen(false)}
                availableWidgets={availableWidgets}
                currentLayout={layout}
                onSave={handleLayoutChange}
            />
        </div>
    );
};

const StatCard = ({ title, value, icon, onClick }) => (
    <div onClick={onClick} className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex items-center text-left transition-all hover:shadow-xl hover:scale-105 ${onClick ? 'cursor-pointer' : ''}`}>
        <div className="p-4 bg-gray-100 dark:bg-gray-900/30 rounded-full">{React.cloneElement(icon, { className: "h-8 w-8 text-indigo-500" })}</div>
        <div className="ml-4">
            <p className="text-3xl font-bold">{value ?? '...'}</p>
            <p className="text-gray-500 dark:text-gray-400">{title}</p>
        </div>
    </div>
);

const SalesGoalsWidget = ({ stats, user, onUpdate }) => {
    const { showNotification } = useNotification();
    const [goalInput, setGoalInput] = useState(stats?.individualSalesGoal || 0);
    const [manualSaleInput, setManualSaleInput] = useState('');

    useEffect(() => {
        setGoalInput(stats?.individualSalesGoal || 0);
    }, [stats]);

    const handleSetGoal = async (e) => {
        e.preventDefault();
        const goalValue = parseFloat(goalInput);
        if (isNaN(goalValue) || goalValue < 0) {
            showNotification('Wprowadź poprawną wartość celu.', 'error');
            return;
        }
        try {
            await api.setUserGoal(goalValue);
            showNotification('Cel miesięczny został zaktualizowany!', 'success');
            onUpdate();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
    
    const handleAddManualSale = async (e) => {
        e.preventDefault();
        const saleValue = parseFloat(manualSaleInput);
        if (isNaN(saleValue)) {
            showNotification('Wprowadź poprawną wartość sprzedaży.', 'error');
            return;
        }
        try {
            await api.addManualSales(saleValue);
            showNotification('Sprzedaż została dodana!', 'success');
            setManualSaleInput('');
            onUpdate();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const individualGoalProgress = stats?.individualSalesGoal > 0 ? ((stats?.individualMonthlySales || 0) / stats.individualSalesGoal) * 100 : 0;
    const totalGoalProgress = stats?.totalSalesGoal > 0 ? ((stats?.totalMonthlySales || 0) / stats.totalSalesGoal) * 100 : 0;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full flex flex-col justify-between">
            <div>
                <h3 className="font-bold mb-4 flex items-center"><BarChart2 className="w-5 h-5 mr-2 text-indigo-500"/>Cele Sprzedażowe</h3>
                <div className="space-y-4">
                    <div>
                        <h4 className="text-sm font-semibold">Twój cel miesięczny</h4>
                        <div className="flex justify-between mb-1 text-xs">
                            <span>{(stats?.individualMonthlySales || 0).toFixed(2)} / {(stats?.individualSalesGoal || 0).toFixed(2)} PLN</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${Math.min(individualGoalProgress, 100)}%` }}></div>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold">Cel ogólny</h4>
                        <div className="flex justify-between mb-1 text-xs">
                            <span>{(stats?.totalMonthlySales || 0).toFixed(2)} / {(stats?.totalSalesGoal || 0).toFixed(2)} PLN</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${Math.min(totalGoalProgress, 100)}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                <form onSubmit={handleSetGoal} className="flex items-center gap-2">
                    <input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} className="p-2 border rounded-md w-full text-sm bg-gray-50 dark:bg-gray-700" placeholder="Ustaw cel..."/>
                    <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm"><Save size={16}/></button>
                </form>
                <form onSubmit={handleAddManualSale} className="flex items-center gap-2">
                    <input type="number" value={manualSaleInput} onChange={(e) => setManualSaleInput(e.target.value)} className="p-2 border rounded-md w-full text-sm bg-gray-50 dark:bg-gray-700" placeholder="Dodaj sprzedaż..."/>
                    <button type="submit" className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm"><PlusCircle size={16}/></button>
                </form>
            </div>
        </div>
    );
};

const QuickActionsWidget = ({ onNavigate }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full">
        <h3 className="font-bold mb-4 flex items-center"><Zap className="w-5 h-5 mr-2 text-yellow-500"/>Szybkie Akcje</h3>
        <div className="grid grid-cols-2 gap-4">
            <button onClick={() => onNavigate('order')} className="p-3 bg-blue-500 text-white rounded-lg text-sm">Nowe Zamówienie</button>
            <button onClick={() => onNavigate('orders')} className="p-3 bg-red-500 text-white rounded-lg text-sm">Zamówienia</button>
        </div>
    </div>
);

const MyTasksWidget = ({ tasks, onNavigate }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full">
        <h3 className="font-bold mb-4 flex items-center"><ListChecks className="w-5 h-5 mr-2 text-red-500"/>Tablica zadań</h3>
        <div className="space-y-2 text-sm">
            {tasks.length > 0 ? tasks.slice(0, 3).map(task => (
                <p key={task._id} className="truncate">{task.content}</p>
            )) : <p className="text-gray-400">Brak zadań.</p>}
        </div>
        <button onClick={() => onNavigate('kanban')} className="text-sm text-indigo-500 mt-4">Zobacz wszystkie</button>
    </div>
);

const TopProductsWidget = ({ stats }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full">
        <h3 className="font-bold mb-4 flex items-center"><Trophy className="w-5 h-5 mr-2 text-yellow-500"/>Najlepsze Produkty</h3>
        <ul className="space-y-2 text-sm">
            {stats?.topProducts.map(p => <li key={p._id} className="flex justify-between"><span>{p._id}</span><strong>{p.totalSold} szt.</strong></li>)}
        </ul>
    </div>
);

const TopCustomersWidget = ({ stats }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full">
        <h3 className="font-bold mb-4 flex items-center"><Crown className="w-5 h-5 mr-2 text-blue-500"/>Najlepsi Klienci</h3>
        <ul className="space-y-2 text-sm">
            {stats?.topCustomers.map(c => <li key={c._id} className="flex justify-between"><span>{c._id}</span><strong>{c.orderCount} zam.</strong></li>)}
        </ul>
    </div>
);

const CustomizeDashboardModal = ({ isOpen, onClose, availableWidgets, currentLayout, onSave }) => {
    const [layout, setLayout] = useState(currentLayout);

    useEffect(() => {
        setLayout(currentLayout);
    }, [currentLayout, isOpen]);

    const toggleWidget = (widgetId) => {
        setLayout(prev => 
            prev.includes(widgetId) ? prev.filter(id => id !== widgetId) : [...prev, widgetId]
        );
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Dostosuj Pulpit">
            <div className="space-y-4">
                <p className="text-sm text-gray-500">Zaznacz komponenty, które mają być widoczne na Twoim pulpicie.</p>
                {Object.entries(availableWidgets).map(([id, { name }]) => (
                    <label key={id} className="flex items-center">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded"
                            checked={layout.includes(id)}
                            onChange={() => toggleWidget(id)}
                        />
                        <span className="ml-3">{name}</span>
                    </label>
                ))}
            </div>
            <div className="flex justify-end mt-6">
                <button onClick={() => { onSave(layout); onClose(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz</button>
            </div>
        </Modal>
    );
};

const NotesWidget = () => {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const { showNotification } = useNotification();

    useEffect(() => {
        const fetchNotes = async () => {
            try {
                const data = await api.getNotes();
                setNotes(data);
            } catch (error) {
                showNotification(error.message, 'error');
            }
        };
        fetchNotes();
    }, [showNotification]);

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!newNote.trim()) return;
        try {
            const addedNote = await api.addNote({ content: newNote, color: 'yellow' });
            setNotes([...notes, addedNote]);
            setNewNote('');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleDeleteNote = async (id) => {
        try {
            await api.deleteNote(id);
            setNotes(notes.filter(n => n._id !== id));
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-4 flex items-center"><StickyNote className="mr-2 text-yellow-400"/> Notatki</h2>
            <div className="flex-grow space-y-3 overflow-y-auto pr-2">
                {notes.map(note => (
                    <div key={note._id} className="bg-yellow-100 dark:bg-yellow-900/40 p-3 rounded-md shadow-sm relative group">
                        <p className="text-yellow-800 dark:text-yellow-200">{note.content}</p>
                        <button onClick={() => handleDeleteNote(note._id)} className="absolute top-1 right-1 p-1 text-yellow-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <XCircle className="w-4 h-4"/>
                        </button>
                    </div>
                ))}
            </div>
            <form onSubmit={handleAddNote} className="mt-4 flex gap-2">
                <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Nowa notatka..." className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700"/>
                <button type="submit" className="p-2 bg-yellow-400 text-yellow-900 rounded-md hover:bg-yellow-500"><PlusCircle/></button>
            </form>
        </div>
    );
};

const CrmView = ({ user }) => {
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalState, setModalState] = useState({ isOpen: false, contact: null });
    const [filters, setFilters] = useState({ search: '', status: '', accountManager: '' });
    const [users, setUsers] = useState([]);
    const { showNotification } = useNotification();
    const importFileRef = useRef(null);

    const fetchContacts = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getContacts(filters);
            setContacts(data);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showNotification, filters]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const userList = await api.getUsersList();
                setUsers(userList);
            } catch (error) {
                showNotification('Nie udało się wczytać listy użytkowników', 'error');
            }
        };
        fetchUsers();
    }, [showNotification]);

    useEffect(() => {
        // Debounce fetching to avoid too many requests
        const handler = setTimeout(() => {
            fetchContacts();
        }, 300);
        return () => clearTimeout(handler);
    }, [filters, fetchContacts]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({ search: '', status: '', accountManager: '' });
    };

    const handleSaveContact = async (contactData) => {
        try {
            if (modalState.contact?._id) {
                await api.updateContact(modalState.contact._id, contactData);
                showNotification('Kontakt zaktualizowany!', 'success');
            } else {
                await api.addContact(contactData);
                showNotification('Kontakt dodany!', 'success');
            }
            setModalState({ isOpen: false, contact: null });
            fetchContacts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleDelete = async (contactId) => {
        if (window.confirm('Czy na pewno chcesz usunąć ten kontakt?')) {
            try {
                await api.deleteContact(contactId);
                showNotification('Kontakt usunięty.', 'success');
                fetchContacts();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }
    };

    const handleFileImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const result = await api.importContacts(file);
            showNotification(result.message, 'success');
            fetchContacts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
        event.target.value = null;
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Kontakty CRM</h1>
                <div className="flex gap-2">
                    <input type="file" ref={importFileRef} onChange={handleFileImport} className="hidden" accept=".csv" />
                    <button onClick={() => importFileRef.current.click()} className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">
                        <FileUp className="w-5 h-5 mr-2"/> Importuj
                    </button>
                    <button onClick={() => setModalState({ isOpen: true, contact: null })} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <PlusCircle className="w-5 h-5 mr-2"/> Nowy
                    </button>
                </div>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input type="text" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Nazwa, firma, email..." className="p-2 border rounded-md bg-white dark:bg-gray-700"/>
                    <select name="status" value={filters.status} onChange={handleFilterChange} className="p-2 border rounded-md bg-white dark:bg-gray-700">
                        <option value="">Wszystkie statusy</option>
                        <option>Lead</option>
                        <option>Klient</option>
                        <option>Utracony</option>
                        <option>Partner</option>
                    </select>
                    <select name="accountManager" value={filters.accountManager} onChange={handleFilterChange} className="p-2 border rounded-md bg-white dark:bg-gray-700">
                        <option value="">Wszyscy opiekunowie</option>
                        {users.map(u => <option key={u._id} value={u.username}>{u.username}</option>)}
                    </select>
                    <button onClick={resetFilters} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg text-sm">Wyczyść filtry</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="p-4">Nazwa</th>
                            <th className="p-4">Firma</th>
                            <th className="p-4">Email</th>
                            <th className="p-4">Telefon</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Opiekun</th>
                            <th className="p-4">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {isLoading ? (
                            <tr><td colSpan="7" className="p-8 text-center">Ładowanie...</td></tr>
                        ) : contacts.map(contact => (
                            <tr key={contact._id}>
                                <td className="p-4 font-medium">{contact.name}</td>
                                <td className="p-4">{contact.company}</td>
                                <td className="p-4">{contact.email}</td>
                                <td className="p-4">{contact.phone}</td>
                                <td className="p-4"><span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{contact.status}</span></td>
                                <td className="p-4">{contact.accountManager}</td>
                                <td className="p-4">
                                    <button onClick={() => setModalState({ isOpen: true, contact })} className="p-2 text-blue-500 hover:text-blue-700"><Edit className="w-5 h-5"/></button>
                                    <button onClick={() => handleDelete(contact._id)} className="p-2 text-red-500 hover:text-red-700"><Trash2 className="w-5 h-5"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ContactFormModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ isOpen: false, contact: null })}
                onSave={handleSaveContact}
                contact={modalState.contact}
            />
        </div>
    );
};

const ContactFormModal = ({ isOpen, onClose, onSave, contact }) => {
    const [formData, setFormData] = useState({});
    const [users, setUsers] = useState([]);
    const { showNotification } = useNotification();

    useEffect(() => {
        if (isOpen) {
            const fetchUsers = async () => {
                try {
                    const userList = await api.getUsersList(); 
                    setUsers(userList);
                } catch (error) {
                    showNotification('Nie udało się wczytać listy użytkowników', 'error');
                }
            };
            fetchUsers();

            if (contact) {
                setFormData(contact);
            } else {
                setFormData({ name: '', company: '', email: '', phone: '', address: '', status: 'Lead', notes: '', accountManager: '' });
            }
        }
    }, [contact, isOpen, showNotification]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={contact ? "Edytuj Kontakt" : "Nowy Kontakt"} maxWidth="2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Imię i nazwisko / Nazwa *" required className="p-2 border rounded-md"/>
                    <input name="company" value={formData.company || ''} onChange={handleChange} placeholder="Firma" className="p-2 border rounded-md"/>
                    <input name="email" value={formData.email || ''} onChange={handleChange} placeholder="Email" type="email" className="p-2 border rounded-md"/>
                    <input name="phone" value={formData.phone || ''} onChange={handleChange} placeholder="Telefon" className="p-2 border rounded-md"/>
                </div>
                <input name="address" value={formData.address || ''} onChange={handleChange} placeholder="Adres" className="w-full p-2 border rounded-md"/>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select name="status" value={formData.status || 'Lead'} onChange={handleChange} className="w-full p-2 border rounded-md">
                        <option>Lead</option>
                        <option>Klient</option>
                        <option>Utracony</option>
                        <option>Partner</option>
                    </select>
                    <select name="accountManager" value={formData.accountManager || ''} onChange={handleChange} className="w-full p-2 border rounded-md">
                        <option value="">-- Brak opiekuna --</option>
                        {users.map(user => (
                            <option key={user._id} value={user.username}>{user.username}</option>
                        ))}
                    </select>
                </div>
                <textarea name="notes" value={formData.notes || ''} onChange={handleChange} placeholder="Notatki..." className="w-full p-2 border rounded-md min-h-[100px]"/>
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Anuluj</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz</button>
                </div>
            </form>
        </Modal>
    );
};

// --- Moduł tabeli zadań ---


const TaskModal = ({ isOpen, onClose, onSave, task, users, currentUser }) => {
    const [formData, setFormData] = useState({
        title: '', content: '', subtasks: [], priority: 'Normalny', deadline: '', assignedToId: ''
    });
    const [newSubtask, setNewSubtask] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (task) {
                setFormData({
                    title: task.title || '',
                    content: task.content || '',
                    subtasks: task.subtasks || [],
                    priority: task.priority || 'Normalny',
                    deadline: task.deadline ? format(parseISO(task.deadline), "yyyy-MM-dd'T'HH:mm") : '',
                    assignedToId: task.assignedToId?._id || task.assignedToId || ''
                });
            } else {
                setFormData({
                    title: '', content: '', subtasks: [], priority: 'Normalny', deadline: '', assignedToId: currentUser.id
                });
            }
        }
    }, [task, isOpen, currentUser.id]);

    const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleAddSubtask = () => {
        if (newSubtask.trim()) {
            setFormData(prev => ({ ...prev, subtasks: [...prev.subtasks, { content: newSubtask, isDone: false }] }));
            setNewSubtask('');
        }
    };
    
    const handleRemoveSubtask = index => {
        setFormData(prev => ({ ...prev, subtasks: prev.subtasks.filter((_, i) => i !== index) }));
    };

    const handleToggleSubtask = index => {
        setFormData(prev => {
            const newSubtasks = [...prev.subtasks];
            newSubtasks[index].isDone = !newSubtasks[index].isDone;
            return { ...prev, subtasks: newSubtasks };
        });
    };

    const handleSubmit = e => {
        e.preventDefault();
        onSave({ ...formData, _id: task?._id });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={task ? 'Edytuj zadanie' : 'Nowe zadanie'} maxWidth="2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="font-semibold">Zadanie *</label>
                    <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                </div>
                <div>
                    <label className="font-semibold">Szczególy</label>
                    <textarea name="content" value={formData.content} onChange={handleChange} className="w-full p-2 border rounded-md min-h-[100px]"/>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="font-semibold">Priorytet</label>
                        <select name="priority" value={formData.priority} onChange={handleChange} className="w-full p-2 border rounded-md">
                            <option>Niski</option><option>Normalny</option><option>Wysoki</option>
                        </select>
                    </div>
                    <div>
                        <label className="font-semibold">Deadline (opcjonalnie)</label>
                        <input type="datetime-local" name="deadline" value={formData.deadline} onChange={handleChange} className="w-full p-2 border rounded-md" />
                    </div>
                </div>
                {currentUser.role === 'administrator' && (
                    <div>
                        <label className="font-semibold">Przypisz do</label>
                        <select name="assignedToId" value={formData.assignedToId} onChange={handleChange} className="w-full p-2 border rounded-md">
                            {users.map(u => <option key={u._id} value={u._id}>{u.username}</option>)}
                        </select>
                    </div>
                )}
                <div>
                    <label className="font-semibold">Podpunkty</label>
                    {formData.subtasks.map((st, i) => (
                        <div key={i} className="flex items-center gap-2 mt-1">
                            <input type="checkbox" checked={st.isDone} onChange={() => handleToggleSubtask(i)} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" />
                            <span className={`flex-grow p-2 bg-gray-100 dark:bg-gray-700 rounded-md ${st.isDone ? 'line-through text-gray-500' : ''}`}>{st.content}</span>
                            <button type="button" onClick={() => handleRemoveSubtask(i)} className="text-red-500"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                        <input type="text" value={newSubtask} onChange={e => setNewSubtask(e.target.value)} placeholder="Dodaj nowy podpunkt..." className="w-full p-2 border rounded-md" />
                        <button type="button" onClick={handleAddSubtask} className="px-3 bg-gray-200 dark:bg-gray-600 rounded-md">Dodaj</button>
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-4 border-t dark:border-gray-700">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg">Anuluj</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz zadanie</button>
                </div>
            </form>
        </Modal>
    );
};

const TaskCard = ({ task, isExpanded, onToggleExpand, onEdit, onDelete, onUpdateTask }) => {
    const isOverdue = task.deadline && new Date(task.deadline) < new Date();
    const priorityClass = { 'Wysoki': 'border-red-500', 'Normalny': 'border-yellow-500', 'Niski': 'border-green-500' };

    const handleSubtaskToggle = (e, index) => {
        e.stopPropagation();
        const newSubtasks = [...task.subtasks];
        newSubtasks[index].isDone = !newSubtasks[index].isDone;
        onUpdateTask(task._id, { subtasks: newSubtasks });
    };

    return (
        <div onClick={onToggleExpand} className={`p-3 mb-3 rounded-lg shadow-md bg-white dark:bg-gray-800 border-l-4 ${isOverdue ? 'border-purple-600' : priorityClass[task.priority]} cursor-pointer group`}>
            <div className="flex justify-between items-start">
                <div className="flex-grow mr-2">
                    <p className="font-semibold">{task.title}</p>
                    {task.deadline && <p className={`text-xs mt-1 ${isOverdue ? 'text-purple-600 font-bold' : 'text-gray-400'}`}>Termin: {format(parseISO(task.deadline), 'dd.MM.yy HH:mm')}</p>}
                </div>
                <div className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip text="Edytuj"><button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 text-gray-500 hover:text-blue-500"><Edit size={16}/></button></Tooltip>
                    <Tooltip text="Usuń"><button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-gray-500 hover:text-red-500"><Trash2 size={16}/></button></Tooltip>
                </div>
            </div>
            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    {task.content && <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{task.content}</p>}
                    {task.subtasks?.length > 0 && (
                        <div className="space-y-1">
                            {task.subtasks.map((subtask, index) => (
                                <label key={index} className="flex items-center gap-2 cursor-pointer text-sm">
                                    <input type="checkbox" checked={subtask.isDone} onChange={(e) => handleSubtaskToggle(e, index)} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" />
                                    <span className={subtask.isDone ? 'line-through text-gray-400' : ''}>{subtask.content}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const KanbanColumn = ({ status, column, tasks, expandedTasks, onToggleExpand, onEditTask, onDeleteTask, onUpdateTask }) => (
    <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
        <h2 className="text-lg font-bold mb-4 text-center">{column.name} ({tasks.length})</h2>
        <Droppable droppableId={status}>
            {(provided, snapshot) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className={`min-h-[400px] p-2 rounded-md transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
                    {tasks.map((task, index) => (
                        <Draggable key={task._id} draggableId={task._id} index={index}>
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                    <TaskCard 
                                        task={task} 
                                        isExpanded={expandedTasks.has(task._id)}
                                        onToggleExpand={() => onToggleExpand(task._id)}
                                        onEdit={() => onEditTask(task)}
                                        onDelete={() => onDeleteTask(task._id)}
                                        onUpdateTask={onUpdateTask}
                                    />
                                </div>
                            )}
                        </Draggable>
                    ))}
                    {provided.placeholder}
                </div>
            )}
        </Droppable>
    </div>
);

const KanbanView = ({ user }) => {
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(user.id);
    const [isLoading, setIsLoading] = useState(true);
    const [modalState, setModalState] = useState({ isOpen: false, task: null });
    const { showNotification } = useNotification();
    const [expandedTasks, setExpandedTasks] = useState(new Set());

    const fetchUsers = useCallback(async () => {
        if (user.role === 'administrator') {
            try {
                const userList = await api.getUsersList();
                setUsers(userList);
            } catch (error) { showNotification(error.message, 'error'); }
        }
    }, [user.role, showNotification]);
    
    const fetchTasks = useCallback(async () => {
        setIsLoading(true);
        try {
            const userIdToFetch = user.role === 'administrator' ? (selectedUserId === 'all' ? '' : selectedUserId) : user.id;
            const data = await api.getKanbanTasks(userIdToFetch);
            setTasks(data);
        } catch (error) { showNotification(error.message, 'error'); } 
        finally { setIsLoading(false); }
    }, [user.role, user.id, selectedUserId, showNotification]);

    useEffect(() => { fetchUsers(); fetchTasks(); }, [fetchUsers, fetchTasks]);

    const columns = useMemo(() => ({
        todo: { name: 'Do zrobienia', items: tasks.filter(t => t.status === 'todo') },
        inprogress: { name: 'W trakcie', items: tasks.filter(t => t.status === 'inprogress') },
        done: { name: 'Gotowe', items: tasks.filter(t => t.status === 'done') },
    }), [tasks]);

    const handleDragEnd = async (result) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;
        if (source.droppableId === destination.droppableId) return;

        try {
            const taskToUpdate = tasks.find(t => t._id === draggableId);
            const updatedTask = { ...taskToUpdate, status: destination.droppableId };
            setTasks(prev => prev.map(t => t._id === draggableId ? updatedTask : t));
            await api.updateKanbanTask(draggableId, { status: destination.droppableId });
            showNotification('Status zadania zaktualizowany', 'success');
        } catch (error) { showNotification(error.message, 'error'); fetchTasks(); }
    };
    
    const handleSaveTask = async (taskData) => {
        try {
            const promise = taskData._id ? api.updateKanbanTask(taskData._id, taskData) : api.addKanbanTask(taskData);
            await promise;
            showNotification('Zadanie zapisane!', 'success');
            fetchTasks();
        } catch (error) { showNotification(error.message, 'error'); }
    };

    const handleDeleteTask = async (taskId) => {
        if (window.confirm("Czy na pewno chcesz usunąć to zadanie?")) {
            try {
                setTasks(prev => prev.filter(t => t._id !== taskId));
                await api.deleteKanbanTask(taskId);
                showNotification('Zadanie usunięte', 'success');
            } catch (error) { showNotification(error.message, 'error'); fetchTasks(); }
        }
    };
    
    const handleUpdateTask = async (taskId, updateData) => {
        try {
            setTasks(prev => prev.map(t => t._id === taskId ? {...t, ...updateData} : t));
            await api.updateKanbanTask(taskId, updateData);
        } catch (error) { showNotification('Błąd aktualizacji zadania', 'error'); fetchTasks(); }
    };

    const handleToggleExpand = (taskId) => {
        setExpandedTasks(prev => {
            const newSet = new Set(prev);
            newSet.has(taskId) ? newSet.delete(taskId) : newSet.add(taskId);
            return newSet;
        });
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold">Tablica Zadań</h1>
                <div className="flex items-center gap-4">
                    {user.role === 'administrator' && (
                        <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="p-2 border rounded-md bg-white dark:bg-gray-700">
                            <option value="all">Wszyscy użytkownicy</option>
                            {users.map(u => <option key={u._id} value={u._id}>{u.username}</option>)}
                        </select>
                    )}
                    <button onClick={() => setModalState({ isOpen: true, task: null })} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
                        <PlusCircle size={20} /> Nowe zadanie
                    </button>
                </div>
            </div>
            {isLoading ? <div className="text-center">Ładowanie zadań...</div> : (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Object.entries(columns).map(([status, column]) => (
                            <KanbanColumn 
                                key={status}
                                status={status} 
                                column={column}
                                tasks={column.items}
                                expandedTasks={expandedTasks}
                                onToggleExpand={handleToggleExpand}
                                onEditTask={(task) => setModalState({ isOpen: true, task })}
                                onDeleteTask={handleDeleteTask}
                                onUpdateTask={handleUpdateTask}
                            />
                        ))}
                    </div>
                </DragDropContext>
            )}
            <TaskModal 
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ isOpen: false, task: null })}
                onSave={handleSaveTask}
                task={modalState.task}
                users={users}
                currentUser={user}
            />
        </div>
    );
};

const AdminEmailConfigView = () => {
    const [config, setConfig] = useState({
        host: '', port: 587, secure: true, user: '', pass: '', recipientEmail: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();
    const [isTesting, setIsTesting] = useState(false); // Dodany stan dla przycisku testowego

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const data = await api.getEmailConfig();
                if (data) setConfig(prev => ({...prev, ...data}));
            } catch (error) {
                showNotification(error.message, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchConfig();
    }, [showNotification]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setConfig(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { message } = await api.saveEmailConfig(config);
            showNotification(message, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
    
    const handleTestEmail = async () => {
        setIsTesting(true);
        try {
            await api.saveEmailConfig(config);
            const { message } = await api.testEmailConfig();
            showNotification(message, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center">Ładowanie...</div>;

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-2xl font-semibold mb-4">Konfiguracja serwera E-mail (SMTP)</h2>
            <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <div>
                    <label className="block text-sm font-medium">Adres lub adresy e-mail odbiorców (oddzielone przecinkami)</label>
                    <input 
                        type="text"
                        name="recipientEmail" 
                        value={config.recipientEmail || ''} 
                        onChange={handleChange} 
                        className="mt-1 w-full p-2 border rounded-md" 
                        placeholder="np. adres1@example.com, adres2@example.com"
                        required 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">Host SMTP</label>
                    <input type="text" name="host" value={config.host || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Port</label>
                    <input type="number" name="port" value={config.port || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Użytkownik (adres e-mail nadawcy)</label>
                    <input type="email" name="user" value={config.user || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required />
                </div>
                 <div>
                    <label className="block text-sm font-medium">Hasło</label>
                    <input type="password" name="pass" value={config.pass || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Wprowadź, jeśli chcesz zmienić" />
                </div>
                <div className="flex items-center">
                    <input type="checkbox" name="secure" checked={config.secure} onChange={handleChange} className="h-4 w-4 rounded" />
                    <label className="ml-2 text-sm">Używaj SSL/TLS (secure)</label>
                </div>
                
                {/* --- POCZĄTEK POPRAWKI --- */}
                <div className="flex justify-end gap-4 pt-4 border-t dark:border-gray-700">
                    <button 
                        type="button" 
                        onClick={handleTestEmail}
                        disabled={isTesting}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                        {isTesting ? 'Wysyłanie...' : 'Testuj wysyłkę'}
                    </button>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Zapisz konfigurację</button>
                </div>
                {/* --- KONIEC POPRAWKI --- */}
            </form>
        </div>
    );
};

const ShortageReportView = () => {
    const [reportData, setReportData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { showNotification } = useNotification();

    const generateReport = async () => {
        setIsLoading(true);
        setReportData([]);
        try {
            const data = await api.getShortageReport();
            setReportData(data);
            if (data.length === 0) {
                showNotification('Wszystkie zamówienia są zrealizowane!', 'success');
            }
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // --- POCZĄTEK NOWEJ LOGIKI ---

    const handleExportPdf = () => {
        if (reportData.length === 0) {
            showNotification('Brak danych do wygenerowania raportu.', 'error');
            return;
        }

        const doc = new jsPDF();
        doc.addFont('/Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        doc.text("Raport Braków Magazynowych", 14, 15);
        doc.setFontSize(10);
        doc.text(`Data wygenerowania: ${new Date().toLocaleString()}`, 14, 22);

        let finalY = 30;

        reportData.forEach(order => {
            // Dodaj nagłówek dla każdego zamówienia
            doc.setFontSize(12);
            doc.text(`Klient: ${order.customerName} (Zamówienie: ${order.orderId})`, 14, finalY);
            finalY += 7;

            doc.autoTable({
                startY: finalY,
                head: [['Nazwa produktu', 'Kod produktu', 'Brak']],
                body: order.shortages.map(item => [
                    item.name,
                    item.product_code,
                    item.shortage
                ]),
                styles: {
                    font: 'Roboto',
                    fontSize: 8,
                },
                headStyles: {
                    fillColor: [220, 220, 220],
                    textColor: [0, 0, 0]
                }
            });
            finalY = doc.lastAutoTable.finalY + 10; // Ustaw pozycję dla następnej tabeli
        });

        doc.save('raport_brakow.pdf');
    };

    const handleExportCsv = () => {
        if (reportData.length === 0) {
            showNotification('Brak danych do wygenerowania raportu.', 'error');
            return;
        }

        const csvHeader = [
            'klient',
            'nazwa_produktu',
            'kod_produktu',
            'brak'
        ].join(';') + '\n';

        const csvRows = reportData.flatMap(order => 
            order.shortages.map(item => [
                order.customerName.replace(/;/g, ','), // Zabezpieczenie przed średnikami w nazwie
                item.name.replace(/;/g, ','),
                item.product_code,
                item.shortage
            ].join(';'))
        ).join('\n');

        const csvContent = csvHeader + csvRows;

        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", "raport_brakow.csv");
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- KONIEC NOWEJ LOGIKI ---

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                <h1 className="text-2xl md:text-3xl font-bold">Raport Braków wg Zamówień</h1>
                <div className="flex gap-2">
                    <button onClick={generateReport} disabled={isLoading} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                        <RotateCcw className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`}/>
                        {isLoading ? 'Generowanie...' : 'Generuj Raport'}
                    </button>
                    {/* NOWE PRZYCISKI EKSPORTU */}
                    <button onClick={handleExportPdf} disabled={reportData.length === 0} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                        <FileDown className="w-5 h-5 mr-2"/> PDF
                    </button>
                     <button onClick={handleExportCsv} disabled={reportData.length === 0} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                        <FileText className="w-5 h-5 mr-2"/> CSV
                    </button>
                </div>
            </div>
            {/* Reszta komponentu (tabela) pozostaje bez zmian */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="p-4">Nazwa produktu</th>
                            <th className="p-4">Kod produktu</th>
                            <th className="p-4 text-center font-bold">Brak</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {reportData.map(order => (
                            <React.Fragment key={order._id}>
                                <tr className="bg-gray-100 dark:bg-gray-700">
                                    <td colSpan="5" className="p-3 font-bold text-indigo-600 dark:text-indigo-400">
                                        Zamówienie: {order.customerName}
                                    </td>
                                </tr>
                                {order.shortages.map(item => (
                                    <tr key={item._id}>
                                        <td className="p-4 pl-8 font-medium">{item.name}</td>
                                        <td className="p-4 pl-8">{item.product_code}</td>
                                        <td className="p-4 text-center font-bold text-red-600">{item.shortage}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
                {reportData.length === 0 && !isLoading && (
                    <p className="p-8 text-center text-gray-500">
                        Kliknij "Generuj Raport", aby wyświetlić braki pogrupowane według zamówień.
                    </p>
                )}
                {isLoading && (
                     <p className="p-8 text-center text-gray-500">
                        Generowanie raportu...
                    </p>
                )}
            </div>
        </div>
    );
};

const KanbanForm = ({ onSubmit }) => {
    const [content, setContent] = useState('');
    const [details, setDetails] = useState('');
    const [subtasks, setSubtasks] = useState([]);
    const [newSubtask, setNewSubtask] = useState('');
    const [priority, setPriority] = useState('normal');

    const handleAddSubtask = () => {
        if (!newSubtask.trim()) return;
        setSubtasks([...subtasks, { content: newSubtask, isDone: false }]);
        setNewSubtask('');
    };
    
    const removeSubtask = (index) => {
        const newSubtasks = [...subtasks];
        newSubtasks.splice(index, 1);
        setSubtasks(newSubtasks);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!content) {
            alert('Treść zadania jest wymagana.');
            return;
        }
        onSubmit({ content, details, subtasks, priority });
        setContent('');
        setDetails('');
        setSubtasks([]);
        setPriority('normal');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-sm font-medium">Treść zadania</label><textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full p-2 border rounded-md" required /></div>
            <div><label className="block text-sm font-medium">Priorytet</label><select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full p-2 border rounded-md"><option value="normal">Normalny</option><option value="high">Wysoki</option><option value="critical">Krytyczny</option></select></div>
            <div><label className="block text-sm font-medium">Szczegóły (opcjonalnie)</label><textarea value={details} onChange={(e) => setDetails(e.target.value)} className="w-full p-2 border rounded-md min-h-[100px]"/></div>
             <div>
                <h4 className="font-semibold">Podzadania (opcjonalnie)</h4>
                <div className="space-y-2 mt-2">
                    {subtasks.map((st, index) => (
                        <div key={index} className="flex items-center gap-2"><span>{st.content}</span><button type="button" onClick={() => removeSubtask(index)} className="ml-auto p-1 text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button></div>
                    ))}
                </div>
                <div className="flex gap-2 mt-2">
                    <input type="text" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} placeholder="Dodaj podzadanie..." className="w-full p-2 border rounded-md"/>
                    <button type="button" onClick={handleAddSubtask} className="px-3 py-1 bg-gray-200 rounded-md">Dodaj</button>
                </div>
            </div>
            <div className="flex justify-end pt-4">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Dodaj zadanie</button>
            </div>
        </form>
    );
};

const TaskDetails = ({ task, onSave }) => {
    const [content, setContent] = useState(task.content || '');
    const [details, setDetails] = useState(task.details || '');
    const [subtasks, setSubtasks] = useState(task.subtasks || []);
    const [newSubtask, setNewSubtask] = useState('');
    const [priority, setPriority] = useState(task.priority || 'normal');

    const handleAddSubtask = () => {
        if (!newSubtask.trim()) return;
        setSubtasks([...subtasks, { content: newSubtask, isDone: false, _id: `new-${Date.now()}` }]);
        setNewSubtask('');
    };

    const toggleSubtask = (index) => {
        const newSubtasks = [...subtasks];
        newSubtasks[index].isDone = !newSubtasks[index].isDone;
        setSubtasks(newSubtasks);
    };

    const removeSubtask = (index) => {
        const newSubtasks = [...subtasks];
        newSubtasks.splice(index, 1);
        setSubtasks(newSubtasks);
    };
    
    const handleSave = () => {
        onSave(task._id, { content, details, subtasks, priority });
    };

    return (
        <div className="space-y-4">
             <div><label className="block text-sm font-medium">Tytuł zadania</label><input type="text" value={content} onChange={(e) => setContent(e.target.value)} className="w-full p-2 border rounded-md"/></div>
             <div><label className="block text-sm font-medium">Priorytet</label><select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full p-2 border rounded-md"><option value="normal">Normalny</option><option value="high">Wysoki</option><option value="critical">Krytyczny</option></select></div>
            <div><label className="block text-sm font-medium">Szczegóły</label><textarea value={details} onChange={(e) => setDetails(e.target.value)} className="w-full p-2 border rounded-md min-h-[100px]"/></div>
            <div>
                <h4 className="font-semibold">Podzadania</h4>
                <div className="space-y-2 mt-2">
                    {subtasks.map((st, index) => (
                        <div key={st._id || index} className="flex items-center gap-2">
                            <input type="checkbox" checked={st.isDone} onChange={() => toggleSubtask(index)} />
                            <span className={st.isDone ? 'line-through text-gray-500' : ''}>{st.content}</span>
                            <button onClick={() => removeSubtask(index)} className="ml-auto p-1 text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 mt-2">
                    <input type="text" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} placeholder="Dodaj podzadanie..." className="w-full p-2 border rounded-md"/>
                    <button type="button" onClick={handleAddSubtask} className="px-3 py-1 bg-gray-200 rounded-md">Dodaj</button>
                </div>
            </div>
            <div className="flex justify-end pt-4">
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz szczegóły</button>
            </div>
        </div>
    );
};

// --- Moduł delegacji ---

const DelegationsView = ({ user, onNavigate, setCurrentOrder }) => {
    const [delegations, setDelegations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [detailsModal, setDetailsModal] = useState({ isOpen: false, delegation: null });
    const { showNotification } = useNotification();
    
    // Prosty hook do sortowania
	
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

    const { items: sortedDelegations, requestSort, sortConfig } = useSortableData(delegations);

    const LIBRARIES = useMemo(() => ['places', 'geocoding'], []);
    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: "AIzaSyDMr9jJIDp0M52-pvwJjehyXShfHmQ0AYE", // <-- WAŻNE: ZASTĄP SWOIM KLUCZEM
        libraries: LIBRARIES,
    });

    const getSortIcon = (name) => {
        if (!sortConfig || sortConfig.key !== name) {
            return <ChevronsUpDown className="w-4 h-4 ml-1 opacity-40" />;
        }
        return sortConfig.direction === 'ascending' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
    };

    const fetchDelegations = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getDelegations();
            setDelegations(data);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showNotification]);

    useEffect(() => {
        fetchDelegations();
    }, [fetchDelegations]);

    const handleAddOrUpdateDelegation = async (delegationData) => {
        try {
            await api.saveDelegation(delegationData);
            showNotification(`Delegacja pomyślnie ${delegationData._id ? 'zaktualizowana' : 'dodana'}.`, 'success');
            setIsFormModalOpen(false);
            fetchDelegations();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await api.updateDelegationStatus(id, status);
            showNotification('Status delegacji został zaktualizowany.', 'success');
            fetchDelegations();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
    
    const handleDelete = async (id) => {
        if(window.confirm("Czy na pewno chcesz usunąć tę delegację?")) {
            try {
                await api.deleteDelegation(id);
                showNotification("Delegacja usunięta", "success");
                fetchDelegations();
            } catch (error) {
                showNotification(error.message, "error");
            }
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Zaakceptowana': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
            case 'Odrzucona': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            case 'W trakcie': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            case 'Zakończona': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
            default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        }
    };

    const handleDelegationUpdate = (updatedDelegation) => {
        setDelegations(prev => prev.map(d => d._id === updatedDelegation._id ? updatedDelegation : d));
        setDetailsModal(prev => ({...prev, delegation: updatedDelegation}));
    };

    if (loadError) return <div className="p-8 text-red-500">Błąd ładowania mapy. Sprawdź klucz API i ustawienia w Google Cloud Console.</div>;

return (
    <div className="p-2 sm:p-4 md:p-8">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
            <h1 className="text-2xl md:text-3xl font-bold">Planer Wizyt i Tras</h1>
            <button onClick={() => setIsFormModalOpen(true)} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <PlusCircle className="w-5 h-5 md:mr-2"/>
                <span className="hidden md:inline">Nowa Delegacja</span>
            </button>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th className="p-2 sm:p-3 cursor-pointer" onClick={() => requestSort('destination')}><div className="flex items-center">Cel {getSortIcon('destination')}</div></th>
                        <th className="hidden md:table-cell p-2 sm:p-3 cursor-pointer" onClick={() => requestSort('author')}><div className="flex items-center">Autor {getSortIcon('author')}</div></th>
                        <th className="p-2 sm:p-3 cursor-pointer" onClick={() => requestSort('dateFrom')}><div className="flex items-center">Daty {getSortIcon('dateFrom')}</div></th>
                        <th className="p-2 sm:p-3 text-center">Status</th>
                        <th className="p-2 sm:p-3 text-center">Akcje</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {isLoading ? (<tr><td colSpan="5" className="p-8 text-center text-gray-500">Ładowanie...</td></tr>) : sortedDelegations.map(d => (
                        <tr key={d._id}>
                            <td className="p-2 sm:p-3 font-medium">{d.destination}</td>
                            <td className="hidden md:table-cell p-2 sm:p-3">{d.author}</td>
                            <td className="p-2 sm:p-3">{format(parseISO(d.dateFrom), 'd.MM.yy')} - {format(parseISO(d.dateTo), 'd.MM.yy')}</td>
                            <td className="p-2 sm:p-3 text-center"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(d.status)}`}>{d.status}</span></td>
                            <td className="p-2 sm:p-3 text-center whitespace-nowrap">
                                <Tooltip text="Podgląd"><button onClick={() => setDetailsModal({isOpen: true, delegation: d})} className="p-2 text-blue-500 hover:text-blue-700"><Eye className="w-5 h-5"/></button></Tooltip>
                                <Tooltip text="Edytuj"><button onClick={() => setIsFormModalOpen(d)} className="p-2 text-yellow-500 hover:text-yellow-700"><Edit className="w-5 h-5"/></button></Tooltip>
                                {user.role === 'administrator' && d.status === 'Oczekująca' && (
                                    <>
                                        <Tooltip text="Akceptuj"><button onClick={() => handleStatusUpdate(d._id, 'Zaakceptowana')} className="p-2 text-green-500 hover:text-green-700"><CheckCircle className="w-5 h-5"/></button></Tooltip>
                                        <Tooltip text="Odrzuć"><button onClick={() => handleStatusUpdate(d._id, 'Odrzucona')} className="p-2 text-red-500 hover:text-red-700"><XCircle className="w-5 h-5"/></button></Tooltip>
                                    </>
                                )}
                                {(user.id === d.authorId || user.role === 'administrator') && (
                                    <Tooltip text="Usuń"><button onClick={() => handleDelete(d._id)} className="p-2 text-gray-500 hover:text-red-500"><Trash2 className="w-5 h-5"/></button></Tooltip>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <Modal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title={isFormModalOpen._id ? "Edytuj Delegację" : "Nowa Delegacja"} maxWidth="2xl">
            <DelegationForm onSubmit={handleAddOrUpdateDelegation} delegationData={isFormModalOpen._id ? isFormModalOpen : null} />
        </Modal>
         <Modal isOpen={detailsModal.isOpen} onClose={() => setDetailsModal({isOpen: false, delegation: null})} title="Szczegóły Delegacji" maxWidth="4xl">
            {detailsModal.delegation && <DelegationDetails delegation={detailsModal.delegation} onUpdate={handleDelegationUpdate} onNavigate={onNavigate} setCurrentOrder={setCurrentOrder} isMapLoaded={isLoaded}/>}
        </Modal>
    </div>
);
};


const DelegationForm = ({ onSubmit, delegationData }) => {
    const [formData, setFormData] = useState({
        destination: '', purpose: '', dateFrom: '', dateTo: '', transport: '', kms: 0, advancePayment: 0, clientsByDay: {}
    });
    const [previewModal, setPreviewModal] = useState(false);

    useEffect(() => {
        if (delegationData) {
            const initialClientsByDay = {};
            (delegationData.clients || []).forEach(client => {
                const day = client.date && isValid(parseISO(client.date)) 
                    ? format(parseISO(client.date), 'yyyy-MM-dd') 
                    : format(parseISO(delegationData.dateFrom), 'yyyy-MM-dd');
                
                if (!initialClientsByDay[day]) {
                    initialClientsByDay[day] = [];
                }
                initialClientsByDay[day].push({ ...client, id: client.id || `client-${Math.random()}` });
            });

            setFormData({
                _id: delegationData._id,
                destination: delegationData.destination || '',
                purpose: delegationData.purpose || '',
                dateFrom: delegationData.dateFrom && isValid(parseISO(delegationData.dateFrom)) ? format(parseISO(delegationData.dateFrom), 'yyyy-MM-dd') : '',
                dateTo: delegationData.dateTo && isValid(parseISO(delegationData.dateTo)) ? format(parseISO(delegationData.dateTo), 'yyyy-MM-dd') : '',
                transport: delegationData.transport || '',
                kms: delegationData.kms || 0,
                advancePayment: delegationData.advancePayment || 0,
                clientsByDay: initialClientsByDay
            });
        }
    }, [delegationData]);
    
    useEffect(() => {
        const { dateFrom, dateTo } = formData;
        if (dateFrom && dateTo && isValid(new Date(dateFrom)) && isValid(new Date(dateTo)) && new Date(dateFrom) <= new Date(dateTo)) {
            const days = eachDayOfInterval({ start: new Date(dateFrom), end: new Date(dateTo) });
            const newClientsByDay = {};
            days.forEach(day => {
                const dayString = format(day, 'yyyy-MM-dd');
                newClientsByDay[dayString] = formData.clientsByDay[dayString] || [];
            });
            setFormData(prev => ({ ...prev, clientsByDay: newClientsByDay }));
        } else if (!delegationData) {
            setFormData(prev => ({ ...prev, clientsByDay: {} }));
        }
    }, [formData.dateFrom, formData.dateTo, delegationData]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleClientChange = (day, index, e) => {
        const { name, value } = e.target;
        const newClientsByDay = { ...formData.clientsByDay };
        newClientsByDay[day][index][name] = value;
        setFormData(prev => ({ ...prev, clientsByDay: newClientsByDay }));
    };

    const addClient = (day) => {
        const newClientsByDay = { ...formData.clientsByDay };
        newClientsByDay[day].push({ id: `client-${Date.now()}`, name: '', address: '', note: '', visitTime: '' });
        setFormData(prev => ({ ...prev, clientsByDay: newClientsByDay }));
    };

    const removeClient = (day, index) => {
        const newClientsByDay = { ...formData.clientsByDay };
        newClientsByDay[day].splice(index, 1);
        setFormData(prev => ({ ...prev, clientsByDay: newClientsByDay }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.destination || !formData.purpose || !formData.dateFrom || !formData.dateTo) {
            alert('Proszę wypełnić wszystkie wymagane pola.');
            return;
        }
        const flatClients = Object.entries(formData.clientsByDay).flatMap(([date, clients]) => 
            clients.map(client => ({ ...client, date }))
        );
        onSubmit({ ...formData, clients: flatClients });
    };
    
    const onDragEnd = (result) => {
        const { source, destination } = result;
        if (!destination) return;

        const newClientsByDay = { ...formData.clientsByDay };
        const sourceDay = source.droppableId;
        const destDay = destination.droppableId;
        
        const sourceClients = Array.from(newClientsByDay[sourceDay]);
        const [movedClient] = sourceClients.splice(source.index, 1);

        if (sourceDay === destDay) {
            sourceClients.splice(destination.index, 0, movedClient);
            newClientsByDay[sourceDay] = sourceClients;
        } else {
            const destClients = Array.from(newClientsByDay[destDay]);
            destClients.splice(destination.index, 0, movedClient);
            newClientsByDay[sourceDay] = sourceClients;
            newClientsByDay[destDay] = destClients;
        }

        setFormData(prev => ({ ...prev, clientsByDay: newClientsByDay }));
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6 p-1">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cel Delegacji</label>
                            <input type="text" name="destination" value={formData.destination} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Środek Transportu</label>
                            <input type="text" name="transport" value={formData.transport} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data od</label>
                            <input type="date" name="dateFrom" value={formData.dateFrom} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data do</label>
                            <input type="date" name="dateTo" value={formData.dateTo} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Przewidywana ilość km</label>
                            <input type="number" name="kms" value={formData.kms} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kwota zaliczki (PLN)</label>
                            <input type="number" name="advancePayment" value={formData.advancePayment} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cel Podróży (opis)</label>
                        <textarea name="purpose" value={formData.purpose} onChange={handleChange} className="mt-1 block w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required />
                    </div>
                </div>

                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="space-y-6">
                        {Object.keys(formData.clientsByDay).sort().map(day => (
                            <div key={day} className="p-4 border dark:border-gray-700 rounded-lg">
                                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">{format(parseISO(day), 'eeee, d MMMM yyyy', { locale: pl })}</h3>
                                <Droppable droppableId={day}>
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3 min-h-[50px]">
                                            {formData.clientsByDay[day].map((client, index) => (
                                                <Draggable key={client.id} draggableId={client.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div 
                                                            ref={provided.innerRef} 
                                                            {...provided.draggableProps} 
                                                            className={`p-3 border-l-4 rounded-md shadow-sm flex flex-col sm:flex-row gap-4 ${snapshot.isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}`}
                                                        >
                                                            <div {...provided.dragHandleProps} className="flex-shrink-0 flex items-center justify-center cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                                                <Menu className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                <input type="text" name="name" value={client.name} onChange={(e) => handleClientChange(day, index, e)} placeholder="Nazwa kontrahenta" className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700"/>
                                                                <input type="text" name="address" value={client.address} onChange={(e) => handleClientChange(day, index, e)} placeholder="Adres" className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700"/>
                                                                <input type="time" name="visitTime" value={client.visitTime || ''} onChange={(e) => handleClientChange(day, index, e)} placeholder="Godzina wizyty" className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700"/>
                                                                <textarea name="note" value={client.note} onChange={(e) => handleClientChange(day, index, e)} placeholder="Szczegóły wizyty..." className="w-full p-2 border rounded-md text-sm sm:col-span-2 bg-gray-50 dark:bg-gray-700" rows="1"></textarea>
                                                            </div>
                                                            <div className="flex-shrink-0 flex items-center justify-center">
                                                                <button type="button" onClick={() => removeClient(day, index)} className="p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"><Trash2 className="w-5 h-5"/></button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                                <button type="button" onClick={() => addClient(day)} className="mt-3 flex items-center px-3 py-1 bg-gray-200 dark:bg-gray-600 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"><PlusCircle className="w-4 h-4 mr-2"/> Dodaj kontrahenta</button>
                            </div>
                        ))}
                    </div>
                </DragDropContext>

                <div className="flex justify-between items-center pt-6 border-t dark:border-gray-700">
                    <button type="button" onClick={() => setPreviewModal(true)} className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700">Podgląd Trasy</button>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Zapisz Delegację</button>
                </div>
            </form>
            <Modal isOpen={previewModal} onClose={() => setPreviewModal(false)} title="Podgląd Delegacji" maxWidth="4xl">
                <DelegationDetails delegation={{...formData, clients: Object.values(formData.clientsByDay).flat()}} isMapLoaded={true} />
            </Modal>
        </>
    );
};


const DelegationDetails = ({ delegation, onUpdate, onNavigate, setCurrentOrder, isMapLoaded }) => {
    const { showNotification } = useNotification();
    const [visitRecapModal, setVisitRecapModal] = useState({ isOpen: false, clientIndex: null });
    const [directionsResponse, setDirectionsResponse] = useState(null);
    const mapRef = useRef();

    const clientsByDay = useMemo(() => {
        return (delegation.clients || []).reduce((acc, client) => {
            const day = client.date && isValid(parseISO(client.date)) ? format(parseISO(client.date), 'yyyy-MM-dd') : 'unassigned';
            if (!acc[day]) {
                acc[day] = [];
            }
            acc[day].push(client);
            return acc;
        }, {});
    }, [delegation.clients]);
    
    const validClients = useMemo(() => (delegation.clients || []).filter(c => c.lat && c.lng), [delegation.clients]);

    useEffect(() => {
        if (isMapLoaded && validClients.length > 1) {
            const directionsService = new window.google.maps.DirectionsService();

            const origin = { lat: validClients[0].lat, lng: validClients[0].lng };
            const destination = { lat: validClients[validClients.length - 1].lat, lng: validClients[validClients.length - 1].lng };
            const waypoints = validClients.slice(1, -1).map(client => ({
                location: { lat: client.lat, lng: client.lng },
                stopover: true,
            }));

            directionsService.route(
                {
                    origin: origin,
                    destination: destination,
                    waypoints: waypoints,
                    travelMode: window.google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === window.google.maps.DirectionsStatus.OK) {
                        setDirectionsResponse(result);
                    } else {
                        console.error(`Błąd podczas pobierania trasy: ${status}`);
                    }
                }
            );
        }
    }, [isMapLoaded, validClients]);

    const handleStartDelegation = async () => {
        try {
            const updatedDelegation = await api.startDelegation(delegation._id);
            onUpdate(updatedDelegation);
            showNotification('Delegacja rozpoczęta!', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleEndDelegation = async () => {
        try {
            const updatedDelegation = await api.endDelegation(delegation._id);
            onUpdate(updatedDelegation);
            showNotification('Delegacja zakończona!', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
    
    const handleStartVisit = async (clientIndex) => {
        try {
            const updatedDelegation = await api.startClientVisit(delegation._id, clientIndex);
            onUpdate(updatedDelegation);
            showNotification('Wizyta rozpoczęta!', 'success');
            setCurrentOrder({ customerName: delegation.clients[clientIndex].name, items: [], isDirty: false });
            onNavigate('order');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
    
    const handleEndVisit = async (visitData) => {
        try {
            const updatedDelegation = await api.endClientVisit(delegation._id, visitRecapModal.clientIndex, visitData);
            onUpdate(updatedDelegation);
            setVisitRecapModal({ isOpen: false, clientIndex: null });
            showNotification('Wizyta zakończona.', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                <h2 className="text-2xl font-bold">{delegation.destination}</h2>
                <div>
                    {delegation.status === 'Zaakceptowana' && !delegation.startTime && (
                        <button onClick={handleStartDelegation} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Rozpocznij Delegację</button>
                    )}
                    {delegation.status === 'W trakcie' && (
                        <button onClick={handleEndDelegation} className="px-4 py-2 bg-red-600 text-white rounded-lg">Zakończ Delegację</button>
                    )}
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
                <p><strong>Cel:</strong> {delegation.purpose}</p>
                <p><strong>Autor:</strong> {delegation.author}</p>
                <p><strong>Data:</strong> {delegation.dateFrom && isValid(parseISO(delegation.dateFrom)) ? format(parseISO(delegation.dateFrom), 'd MMM yyyy') : ''} - {delegation.dateTo && isValid(parseISO(delegation.dateTo)) ? format(parseISO(delegation.dateTo), 'd MMM yyyy') : ''}</p>
                <p><strong>Status:</strong> {delegation.status}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-xl font-semibold mb-2">Plan Wizyt</h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {Object.keys(clientsByDay).sort().map(day => (
                            <div key={day}>
                                <h4 className="text-lg font-semibold mt-4 mb-2 bg-gray-100 dark:bg-gray-700 p-2 rounded-md">{day !== 'unassigned' && isValid(parseISO(day)) ? format(parseISO(day), 'eeee, d MMMM yyyy', { locale: pl }) : 'Nieprzypisane'}</h4>
                                {clientsByDay[day].map((client, index) => (
                                    <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h5 className="font-bold">{index + 1}. {client.name}</h5>
                                                <p className="text-xs text-gray-500">{client.address}</p>
                                                {client.visitTime && <p className="text-sm font-semibold text-blue-600">Planowana godzina: {client.visitTime}</p>}
                                                {client.note && <p className="mt-1 text-xs italic">Szczegóły: {client.note}</p>}
                                            </div>
                                            <div className="flex gap-2">
                                                {!client.startTime && delegation.status === 'W trakcie' && (
                                                    <button onClick={() => handleStartVisit(index)} className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg">Rozpocznij wizytę</button>
                                                )}
                                                {client.startTime && !client.endTime && (
                                                    <button onClick={() => setVisitRecapModal({isOpen: true, clientIndex: index})} className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg">Zakończ wizytę</button>
                                                )}
                                            </div>
                                        </div>
                                        {client.startTime && (
                                             <div className="mt-2 text-xs border-t pt-2">
                                                <p>Rozpoczęto: {isValid(parseISO(client.startTime)) ? format(parseISO(client.startTime), 'HH:mm:ss') : 'Błędna data'}</p>
                                                {client.endTime && <p>Zakończono: {isValid(parseISO(client.endTime)) ? format(parseISO(client.endTime), 'HH:mm:ss') : 'Błędna data'}</p>}
                                                {client.visitNotes && <p className="mt-1"><strong>Notatki:</strong> {client.visitNotes}</p>}
                                                {client.ordered && <p className="text-green-600 font-bold">Złożono zamówienie</p>}
                                             </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-semibold mb-2">Mapa Trasy</h3>
                    {isMapLoaded ? (
                        <GoogleMap
                            mapContainerStyle={{ height: '400px', width: '100%' }}
                            center={{ lat: 52.2297, lng: 21.0122 }}
                            zoom={7}
                            onLoad={map => { mapRef.current = map; }}
                        >
                            {directionsResponse ? (
                                <DirectionsRenderer directions={directionsResponse} />
                            ) : (
                                validClients.map((client, index) => (
                                    <Marker key={index} position={{ lat: client.lat, lng: client.lng }} label={`${index + 1}`} />
                                ))
                            )}
                        </GoogleMap>
                    ) : <div>Ładowanie mapy...</div>}
                </div>
            </div>

            <Modal isOpen={visitRecapModal.isOpen} onClose={() => setVisitRecapModal({isOpen: false})} title="Podsumowanie wizyty">
                <VisitRecapForm onSubmit={handleEndVisit} />
            </Modal>
        </div>
    );
};


// --- Główny Komponent Aplikacji ---

const getInitialOrder = () => {
    try {
        const savedOrder = localStorage.getItem('draftOrder');
        if (savedOrder) {
            const parsed = JSON.parse(savedOrder);
            // Wczytujemy tylko jeśli to wersja robocza (nie ma _id z bazy danych)
            if (!parsed._id) { 
                return { ...parsed, isDirty: true }; // Oznaczamy jako "brudny" po wczytaniu
            }
        }
    } catch (error) {
        console.error("Błąd odczytu roboczego zamówienia z localStorage:", error);
        localStorage.removeItem('draftOrder'); // Czyścimy w razie błędu parsowania
    }
    // Domyślnie zwracamy czyste zamówienie
    return { customerName: '', items: [], isDirty: false };
};

const Sidebar = ({ user, onLogout, onOpenPasswordModal, onNewOrder }) => {
    const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
    const [isNavOpen, setIsNavOpen] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState(['Główne']);
    const location = useLocation();

    const toggleTheme = () => {
        const newIsDarkMode = !isDarkMode;
        setIsDarkMode(newIsDarkMode);
        if (newIsDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };
    
    const toggleCategory = (category) => {
        setExpandedCategories(prev =>
            prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
        );
    };

    const navConfig = useMemo(() => [
        {
            category: 'Główne',
            items: [
                { id: 'dashboard', label: 'Panel Główny', icon: Home, roles: ['user', 'administrator'], alwaysVisible: true },
                { id: 'search', label: 'Wyszukiwarka', icon: Search, roles: ['user', 'administrator'] },
            ]
        },
        {
            category: 'Sprzedaż',
            items: [
                { id: 'order', label: 'Nowe Zamówienie', icon: PlusCircle, roles: ['user', 'administrator'] },
                { id: 'orders', label: 'Zamówienia', icon: Archive, roles: ['user', 'administrator'] },
            ]
        },
        {
            category: 'Magazyn',
            items: [
                { id: 'picking', label: 'Kompletacja', icon: List, roles: ['user', 'administrator'] },
                { id: 'inventory', label: 'Inwentaryzacja', icon: Wrench, roles: ['user', 'administrator'] },
            ]
        },
        {
            category: 'Organizacyjne',
            items: [
                { id: 'kanban', label: 'Tablica Zadań', icon: ClipboardList, roles: ['user', 'administrator'] },
                { id: 'delegations', label: 'Delegacje', icon: Plane, roles: ['user', 'administrator'] },
				{ id: 'crm', label: 'Kontakty', icon: Users, roles: ['user', 'administrator'] },
            ]
        },
		{
            category: 'Raporty',
            items: [
                 { id: 'shortage-report', label: 'Raport Braków', icon: ClipboardCheck, roles: ['user', 'administrator'] },
            ]
        },
        {
            category: 'Administracja',
            items: [
                 { id: 'admin', label: 'Panel Admina', icon: Settings, roles: ['administrator'] },
            ]
        }
    ], []);

const availableNav = useMemo(() => {
    if (!user) return [];
    return navConfig
        .map(category => ({
            ...category,
            items: category.items.filter(item => user.role === 'administrator' || item.roles.includes(user.role) && (item.alwaysVisible || user.visibleModules?.includes(item.id)))
        }))
        .filter(category => category.items.length > 0);
}, [user, navConfig]);
	
    return (
        <nav className={`w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out z-40 fixed lg:static h-full ${isNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
             <div className="flex items-center justify-center h-20 border-b border-gray-200 dark:border-gray-700">
                <img src={isDarkMode ? "/logo-dark.png" : "/logo.png"} alt="Logo" className="h-10" />
            </div>
            <ul className="flex-grow overflow-y-auto">
                {availableNav.map(category => (
                    <div key={category.category} className="my-2">
                        <h3 onClick={() => toggleCategory(category.category)} className="px-6 mt-4 mb-2 text-xs font-semibold text-gray-400 uppercase flex justify-between items-center cursor-pointer">
                            {category.category}
                            {expandedCategories.includes(category.category) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </h3>
                        {expandedCategories.includes(category.category) && category.items.map(item => (
                            <li key={item.id}>
                                <Link to={`/${item.id}`} onClick={() => setIsNavOpen(false)} className={`w-full flex items-center justify-start h-12 px-6 text-base transition-colors duration-200 text-left ${location.pathname.startsWith(`/${item.id}`) ? 'bg-indigo-50 dark:bg-gray-700 text-indigo-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                    <item.icon className="h-5 w-5" />
                                    <span className="ml-4">{item.label}</span>
                                </Link>
                            </li>
                        ))}
                    </div>
                ))}
            </ul>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <div><p className="font-semibold">{user.username}</p><p className="text-sm text-gray-500">{user.role}</p></div>
                    <div className="flex items-center">
                        <Tooltip text="Zmień hasło"><button onClick={onOpenPasswordModal} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><KeyRound className="h-6 w-6 text-gray-500" /></button></Tooltip>
                        <Tooltip text="Wyloguj"><button onClick={onLogout} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><LogOut className="h-6 w-6 text-gray-500" /></button></Tooltip>
                    </div>
                </div>
                <Tooltip text="Zmień motyw"><button onClick={toggleTheme} className="w-full flex justify-center p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">{isDarkMode ? <Sun className="h-6 w-6 text-yellow-400" /> : <Moon className="h-6 w-6 text-indigo-500" />}</button></Tooltip>
            </div>
        </nav>
    );
};

// --- Główny Komponent Aplikacji ---
function App() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentOrder, setCurrentOrder] = useState(getInitialOrder);
    const [isDirty, setIsDirty] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const navigate = useNavigate();

    const updateUserData = (newUserData) => {
        setUser(newUserData);
        localStorage.setItem('userData', JSON.stringify(newUserData));
    };

    const handleLogin = useCallback((data) => {
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        setUser(data.user);
        navigate('/dashboard');
    }, [navigate]);

    const handleLogout = useCallback(async () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('draftOrder'); // Czyścimy robocze zamówienie przy wylogowaniu
        setUser(null);
        navigate('/login');
    }, [navigate]);

    const handleNewOrder = () => {
        if (isDirty) {
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

    useEffect(() => {
        const handleAuthError = () => {
            console.log("Wykryto błąd autoryzacji, wylogowywanie...");
            handleLogout();
        };

        window.addEventListener('auth-error', handleAuthError);

        return () => {
            window.removeEventListener('auth-error', handleAuthError);
        };
    }, [handleLogout]);

    const loadOrderForEditing = async (orderId) => {
        try {
            const order = await api.getOrderById(orderId);
            setCurrentOrder(order);
            navigate('/order');
        } catch (error) {
            console.error("Błąd ładowania zamówienia", error);
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
                                <Route path="/dashboard" element={<DashboardView user={user} onNavigate={navigate} onUpdateUser={updateUserData} />} />
                                <Route path="/search" element={<MainSearchView />} />
                                <Route path="/order" element={<OrderView currentOrder={currentOrder} setCurrentOrder={setCurrentOrder} user={user} setDirty={setIsDirty} />} />
                                <Route path="/orders" element={<OrdersListView onEdit={loadOrderForEditing} />} />
                                <Route path="/picking" element={<PickingView />} />
                                <Route path="/inventory" element={<InventoryView user={user} onNavigate={navigate} isDirty={isDirty} setIsDirty={setIsDirty} />} />
                                <Route path="/inventory-sheet" element={<NewInventorySheet user={user} onSave={() => navigate('/inventory')} setDirty={setIsDirty} />} />
                                <Route path="/inventory-sheet/:inventoryId" element={<NewInventorySheet user={user} onSave={() => navigate('/inventory')} setDirty={setIsDirty} />} />
                                <Route path="/kanban" element={<KanbanView user={user} />} />
                                <Route path="/delegations" element={<DelegationsView user={user} onNavigate={navigate} setCurrentOrder={setCurrentOrder} />} />
                                <Route path="/admin" element={<AdminView user={user} onNavigate={navigate} />} />
                                <Route path="/admin-users" element={<AdminUsersView user={user} />} />
                                <Route path="/admin-products" element={<AdminProductsView />} />
                                <Route path="/shortage-report" element={<ShortageReportView />} />
                                <Route path="/admin-email" element={<AdminEmailConfigView />} />
								<Route path="/crm" element={<CrmView user={user} />} />
                                <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
