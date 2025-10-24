import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { synchronizeData } from './data/synchronization';
import { db } from './db';
import ErrorBoundary from './components/ErrorBoundary';
import AuthPage from './components/auth/AuthPage';
import Topbar from './components/layout/Topbar';
import DashboardView from './components/dashboard/DashboardView';
import MainSearchView from './components/product/MainSearchView';
import OrderView from './components/order/OrderView';
import OrdersListView from './components/order/OrdersListView';
import PickingView from './components/picking/PickingView';
import InventoryView from './components/inventory/InventoryView';
import NewInventorySheet from './components/inventory/NewInventorySheet';
import KanbanView from './components/kanban/KanbanView';
import DelegationsView from './components/delegations/DelegationsView';
import CrmView from './components/crm/CrmView';
import AdminView from './components/admin/AdminView';
import AdminUsersView from './components/admin/AdminUsersView';
import AdminProductsView from './components/admin/AdminProductsView';
import AdminEmailConfigView from './components/admin/AdminEmailConfigView';
import ShortageReportView from './components/reports/ShortageReportView';
import UserChangePasswordModal from './components/modals/UserChangePasswordModal';
import { api } from './api';

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
    const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
    const [syncProgress, setSyncProgress] = useState({ status: 'idle' });
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    const triggerSync = useCallback(async () => {
        const success = await synchronizeData(setSyncProgress);
        if (success) {
            showNotification('Dane zsynchronizowane pomyślnie!', 'success');
        } else {
            showNotification(`Błąd synchronizacji.`, 'error');
        }
    }, [showNotification]);

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

    const handleLogin = useCallback((data) => {
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        setUser(data.user);
        navigate('/dashboard');
        triggerSync();
    }, [navigate, triggerSync]);

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
            console.error("Błąd ładowania zamówienia", error);
        }
    };
    
    useEffect(() => {
        const userData = localStorage.getItem('userData');
        if (userData) {
            try {
                setUser(JSON.parse(userData));
                // Sprawdź, czy dane kiedykolwiek były synchronizowane
                Promise.all([db.syncStatus.get('products'), db.syncStatus.get('contacts')]).then(([p, c]) => {
                    if (!p || !c) {
                        setSyncProgress({ status: 'required' });
                    }
                });
            } catch (e) { handleLogout(); }
        }
        setIsLoading(false);
    }, [handleLogout]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen">Ładowanie...</div>;
    }
    
    return (
        <>
            <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
                {user && (
                    <Topbar
                        user={user}
                        onLogout={handleLogout}
                        onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
                        isDarkMode={isDarkMode}
                        toggleTheme={toggleTheme}
                        syncProgress={syncProgress}
                        onForceSync={triggerSync}
                    />
                )}
                <main className="flex-1 overflow-y-auto">
                    <Routes>
                        {!user ? (
                            <>
                                <Route path="/login" element={<AuthPage onLogin={handleLogin} />} />
                                <Route path="*" element={<Navigate to="/login" replace />} />
                            </>
                        ) : (
                            <>
                                <Route path="/dashboard" element={<DashboardView user={user} onNewOrder={handleNewOrder} />} />
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
                                <Route path="/shortage-report" element={<ShortageReportView />} />
                                <Route path="/admin-email" element={<AdminEmailConfigView />} />
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
