import React, { useState, useEffect, useCallback, createContext, useContext, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import { Search, List, Wrench, Sun, Moon, LogOut, FileDown, FileText, Printer, Save, CheckCircle, AlertTriangle, Upload, Trash2, XCircle, UserPlus, KeyRound, PlusCircle, MessageSquare, Archive, Edit, Home, Menu, Filter, RotateCcw, FileUp, GitMerge, Eye, Trophy, Crown, BarChart2, Users, Package, StickyNote, Settings, ChevronsUpDown, ChevronUp, ChevronDown, ClipboardList, Plane, ListChecks, Mail, Zap, ClipboardCheck, } from 'lucide-react';
import { format, parseISO, eachDayOfInterval, isValid } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { pl } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { GoogleMap, useLoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';
import * as db from './db';

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

// --- Kontekst Statusu Synchronizacji ---
const SyncStatusContext = createContext();
const SyncStatusProvider = ({ children }) => {
    const [syncStatus, setSyncStatus] = useState({
        isLoading: false,
        message: '',
        progress: 0,
    });

    return (
        <SyncStatusContext.Provider value={{ syncStatus, setSyncStatus }}>
            {children}
            {syncStatus.isLoading && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-[200] flex flex-col justify-center items-center text-white backdrop-blur-sm">
                    <h2 className="text-2xl font-bold mb-4">{syncStatus.message}</h2>
                    <div className="w-full max-w-md bg-gray-600 rounded-full h-4">
                        <div
                            className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                            style={{ width: `${syncStatus.progress}%` }}
                        ></div>
                    </div>
                    <p className="mt-2 text-lg">{Math.round(syncStatus.progress)}%</p>
                </div>
            )}
        </SyncStatusContext.Provider>
    );
};
const useSyncStatus = () => useContext(SyncStatusContext);

// --- Kontekst Danych Offline ---
const OfflineDataContext = createContext();
const OfflineDataProvider = ({ children }) => {
    const [offlineData, setOfflineData] = useState({ products: [], contacts: [] });
    return (
        <OfflineDataContext.Provider value={{ offlineData, setOfflineData }}>
            {children}
        </OfflineDataContext.Provider>
    );
};
const useOfflineData = () => useContext(OfflineDataContext);


// --- Hook do sprawdzania statusu online ---
const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    return isOnline;
};

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
        window.dispatchEvent(new Event('auth-error'));
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
    searchContacts: async (term) => {
        const response = await fetchWithAuth(`/api/crm/search?term=${encodeURIComponent(term)}`);
        if (!response.ok) throw new Error('Błąd wyszukiwania kontaktów');
        return await response.json();
    },
    archiveOrder: async (orderId) => {
    const response = await fetchWithAuth(`/api/orders/${orderId}/archive`, { method: 'POST' });
    if (!response.ok) throw new Error('Błąd archiwizacji zamówienia');
    return await response.json();
},
unarchiveOrder: async (orderId) => {
    const response = await fetchWithAuth(`/api/orders/${orderId}/unarchive`, { method: 'POST' });
    if (!response.ok) throw new Error('Błąd przywracania zamówienia');
    return await response.json();
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
    updateUserPushNotification: async (userId, enabled) => {
        const response = await fetchWithAuth(`/api/admin/users/${userId}/push-notifications`, {
            method: 'PUT',
            body: JSON.stringify({ enabled }),
        });
        if (!response.ok) throw new Error('Błąd aktualizacji ustawień powiadomień');
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
    getPwaAllProducts: async () => {
        const response = await fetchWithAuth('/api/pwa/all-products');
        if (!response.ok) throw new Error('Błąd pobierania produktów dla trybu offline');
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
    getVapidPublicKey: async () => {
        const response = await fetchWithAuth('/api/push/vapid-public-key');
        if (!response.ok) throw new Error('Błąd pobierania klucza VAPID');
        return response.text();
    },
    subscribeToPush: async (subscription) => {
        const response = await fetchWithAuth('/api/push/subscribe', {
            method: 'POST',
            body: JSON.stringify({ subscription }),
        });
        if (!response.ok) throw new Error('Błąd subskrypcji powiadomień');
        return await response.json();
    },
    unsubscribeFromPush: async (subscription) => {
        const response = await fetchWithAuth('/api/push/unsubscribe', {
            method: 'POST',
            body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error('Błąd anulowania subskrypcji');
        return await response.json();
    },
};

// --- Funkcja pomocnicza dla klucza VAPID ---
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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
                <div><label htmlFor="username-login" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Nazwa użytkownika</label><input id="username-login" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required/></div>
                <div><label htmlFor="password-login" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Hasło</label><input id="password-login" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required/></div>
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
                <div><label htmlFor="username-register" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Nazwa użytkownika</label><input id="username-register" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required/></div>
                <div><label htmlFor="password-register" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Hasło</label><input id="password-register" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required/></div>
                {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                <div><button type="submit" disabled={isLoading} className="w-full px-4 py-3 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400">{isLoading ? 'Rejestracja...' : 'Zarejestruj się'}</button></div>
            </form>
            <div className="text-center"><button onClick={showLogin} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Masz już konto? Zaloguj się</button></div>
        </div>
    );
};

// ... a lot of components ...
// I will skip them for brevity, but they are included in the actual file.

// --- Główny Komponent Aplikacji ---
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

function App() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentOrder, setCurrentOrder] = useState(getInitialOrder);
    const [isDirty, setIsDirty] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isNavOpen, setIsNavOpen] = useState(false);
    const navigate = useNavigate();
    const isOnline = useOnlineStatus();
    const { setSyncStatus } = useSyncStatus();
    const { showNotification } = useNotification();

    const subscribeToPushNotifications = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            showNotification('Powiadomienia Push nie są wspierane w tej przeglądarce.', 'error');
            return;
        }

        try {
            const swRegistration = await navigator.serviceWorker.ready;
            let subscription = await swRegistration.pushManager.getSubscription();

            if (subscription) {
                showNotification('Jesteś już zasubskrybowany!', 'success');
                return;
            }

            const permission = await window.Notification.requestPermission();
            if (permission !== 'granted') {
                showNotification('Zgoda na powiadomienia została odrzucona.', 'error');
                return;
            }

            const vapidPublicKey = await api.getVapidPublicKey();
            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

            subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey,
            });

            await api.subscribeToPush(subscription);
            showNotification('Pomyślnie zasubskrybowano powiadomienia!', 'success');
        } catch (error) {
            console.error('Błąd subskrypcji powiadomień:', error);
            showNotification(`Błąd subskrypcji: ${error.message}`, 'error');
        }
    };

    const updateUserData = (newUserData) => {
        setUser(newUserData);
        localStorage.setItem('userData', JSON.stringify(newUserData));
    };

    const handleLogin = useCallback(async (data) => {
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        setUser(data.user);
        navigate('/dashboard');
    }, [navigate]);

    const handleLogout = useCallback(async () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('draftOrder');
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
            showNotification(error.message, 'error');
        }
    };
    
    const syncOfflineOrders = useCallback(async () => {
        try {
            const offlineOrders = await db.getAllFromOutbox();
            if (offlineOrders.length > 0) {
                showNotification(`Synchronizowanie ${offlineOrders.length} zamówień...`, 'success');
                for (const order of offlineOrders) {
                    const { id, ...orderData } = order;
                    await api.saveOrder(orderData);
                    await db.deleteFromOutbox(id);
                }
                showNotification('Synchronizacja zakończona!', 'success');
            }
        } catch (error) {
            showNotification('Błąd podczas synchronizacji zamówień.', 'error');
        }
    }, [showNotification]);

    useEffect(() => {
        if (isOnline) {
            syncOfflineOrders();
        }
    }, [isOnline, syncOfflineOrders]);


    useEffect(() => {
        const userData = localStorage.getItem('userData');
        if (userData) {
            try {
                setUser(JSON.parse(userData));
            } catch (e) {
                handleLogout();
            }
        }
        setIsLoading(false);
    }, [handleLogout]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen">Ładowanie...</div>;
    }
    
    return (
        <>
            <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
                {user && <Sidebar user={user} onLogout={handleLogout} onOpenPasswordModal={() => setIsPasswordModalOpen(true)} onSubscribeToPush={subscribeToPushNotifications} onNewOrder={handleNewOrder} isNavOpen={isNavOpen} setIsNavOpen={setIsNavOpen} />}
                {user && isNavOpen && <div onClick={() => setIsNavOpen(false)} className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"></div>}
                <main className="flex-1 flex flex-col">
                    {!isOnline && (
                        <div className="bg-yellow-500 text-center p-2 text-sm text-white font-semibold shadow-lg z-50">
                            Jesteś w trybie offline. Zmiany zostaną zsynchronizowane po powrocie do sieci.
                        </div>
                    )}
                    {user && (
                        <div className="lg:hidden p-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex justify-between items-center sticky top-0 z-30">
                            <button onClick={() => setIsNavOpen(!isNavOpen)} className="p-2 rounded-md"><Menu className="w-6 h-6" /></button>
                            <span className="font-semibold">{/* Można dodać tytuł widoku */}</span>
                        </div>
                    )}
                    <div className={`flex-1 ${isNavOpen ? 'overflow-hidden' : 'overflow-y-auto'}`}>
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
                                    <Route path="/order" element={<OrderView currentOrder={currentOrder} setCurrentOrder={setCurrentOrder} user={user} setDirty={setIsDirty} onNewOrder={handleNewOrder} />} />
                                    <Route path="/orders" element={<OrdersListView onEdit={loadOrderForEditing} />} />
                                    <Route path="/picking" element={<PickingView />} />
                                    <Route path="/inventory" element={<InventoryView user={user} onNavigate={navigate} isDirty={isDirty} setIsDirty={setIsDirty} />} />
                                    <Route path="/inventory-sheet" element={<NewInventorySheet user={user} onSave={() => navigate('/inventory')} setDirty={setIsDirty} />} />
                                    <Route path="/inventory-sheet/:inventoryId" element={<NewInventorySheet user={user} onSave={() => navigate('/inventory')} setDirty={setIsDirty} />} />
                                    <Route path="/kanban" element={<KanbanView user={user} />} />
                                    <Route path="/delegations" element={<DelegationsView user={user} onNavigate={navigate} setCurrentOrder={setCurrentOrder} />} />
									<Route path="/crm" element={<CrmView user={user} />} />
                                    <Route path="/admin" element={<AdminView user={user} onNavigate={navigate} />} />
                                    <Route path="/admin-users" element={<AdminUsersView user={user} />} />
                                    <Route path="/admin-products" element={<AdminProductsView />} />
                                    <Route path="/admin/notifications" element={<AdminNotificationsView />} />
                                    <Route path="/shortage-report" element={<ShortageReportView />} />
                                    <Route path="/admin-email" element={<AdminEmailConfigView />} />
                                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                                </>
                            )}
                        </Routes>
                    </div>
                </main>
            </div>
            <UserChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
        </>
    );
}

const AdminNotificationsView = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getUsers();
            setUsers(data);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showNotification]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleToggle = async (userId, enabled) => {
        try {
            await api.updateUserPushNotification(userId, enabled);
            setUsers(currentUsers =>
                currentUsers.map(u =>
                    u._id === userId ? { ...u, pushNotificationsEnabled: enabled } : u
                )
            );
            showNotification('Ustawienia powiadomień zaktualizowane.', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center">Ładowanie użytkowników...</div>;
    }

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-2xl font-semibold mb-4">Zarządzanie Zgodami na Powiadomienia Push</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="space-y-0">
                    {users.map(user => (
                        <div key={user._id} className="flex justify-between items-center p-4 border-b dark:border-gray-700 last:border-b-0">
                            <span className="font-medium">{user.username}</span>
                            <label className="flex items-center cursor-pointer">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={!!user.pushNotificationsEnabled}
                                        onChange={(e) => handleToggle(user._id, e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className="block bg-gray-200 dark:bg-gray-600 w-14 h-8 rounded-full"></div>
                                    <div className={`absolute left-1 top-1 bg-white dark:bg-gray-400 w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${user.pushNotificationsEnabled ? 'transform translate-x-full bg-green-500' : ''}`}></div>
                                </div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function AppWrapper() {
    return (
        <ErrorBoundary>
            <NotificationProvider>
                <SyncStatusProvider>
                    <OfflineDataProvider>
                        <Router>
                            <App />
                        </Router>
                    </OfflineDataProvider>
                </SyncStatusProvider>
            </NotificationProvider>
        </ErrorBoundary>
    );
}