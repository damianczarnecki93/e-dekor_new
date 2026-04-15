const API_BASE_URL = process.env.REACT_APP_API_URL || '';

const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('userToken');
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });

        if (response.status === 401) {
            window.dispatchEvent(new Event('auth-error'));
            throw new Error('Sesja wygasła. Proszę zalogować się ponownie.');
        }
        return response;
    } catch (error) {
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            throw new Error('Brak połączenia z serwerem. Sprawdź połączenie internetowe.');
        }
        throw error;
    }
};

export const api = {
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
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Nie znaleziono zamówienia');
        }
        return await response.json();
    },
    deleteOrder: async (id) => {
        const response = await fetchWithAuth(`/api/orders/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Błąd usuwania zamówienia');
        }
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
    getProductsCount: async () => {
        const response = await fetchWithAuth(`/api/sync/products/count`);
        if (!response.ok) throw new Error('Błąd pobierania liczby produktów');
        return await response.json();
    },
    getProductsPage: async (page, limit) => {
        const response = await fetchWithAuth(`/api/sync/products?page=${page}&limit=${limit}`);
        if (!response.ok) throw new Error('Błąd pobierania strony produktów');
        return await response.json(); // Serwer zwróci { products: [...] }
    },
    getContactsCount: async () => {
        const response = await fetchWithAuth(`/api/sync/contacts/count`);
        if (!response.ok) throw new Error('Błąd pobierania liczby kontaktów');
        return await response.json();
    },
    getContactsPage: async (page, limit) => {
        const response = await fetchWithAuth(`/api/sync/contacts?page=${page}&limit=${limit}`);
        if (!response.ok) throw new Error('Błąd pobierania strony kontaktów');
        return await response.json(); // Serwer zwróci { contacts: [...] }
    },
    subscribeToPush: async (subscription) => {
        const response = await fetchWithAuth('/api/push/subscribe', {
            method: 'POST',
            body: JSON.stringify({ subscription }),
        });
        if (!response.ok) throw new Error('Błąd podczas subskrypcji powiadomień.');
        return await response.json();
    },
    getNotificationPreferences: async () => {
        const response = await fetchWithAuth('/api/user/notification-preferences');
        if (!response.ok) throw new Error('Błąd pobierania preferencji powiadomień.');
        return await response.json();
    },
    updateNotificationPreferences: async (preferences) => {
        const response = await fetchWithAuth('/api/user/notification-preferences', {
            method: 'PUT',
            body: JSON.stringify({ preferences }),
        });
        if (!response.ok) throw new Error('Błąd zapisywania preferencji powiadomień.');
        return await response.json();
    },
    unsubscribeFromPush: async (endpoint) => {
        const response = await fetchWithAuth('/api/push/unsubscribe', {
            method: 'POST',
            body: JSON.stringify({ endpoint }),
        });
        if (!response.ok) throw new Error('Błąd podczas anulowania subskrypcji.');
        return await response.json();
    },
};