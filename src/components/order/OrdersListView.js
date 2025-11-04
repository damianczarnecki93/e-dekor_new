import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Edit, Archive, Trash2, RotateCcw, Filter, FileUp, WifiOff, CheckCircle } from 'lucide-react';
import { api } from '../../api';
import { db } from '../../db';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';
import Tooltip from '../common/Tooltip';

const OrdersListView = ({ onEdit }) => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalState, setModalState] = useState({ isOpen: false, orderToDelete: null, type: '' });
    const { showNotification } = useNotification();
    const [filters, setFilters] = useState({ customer: '', author: '', dateFrom: '', dateTo: '', showArchived: false });
    const [showFilters, setShowFilters] = useState(false);
    const importMultipleRef = useRef(null);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Pobierz zamówienia z lokalnej bazy danych
            const localOrders = await db.orders.toArray();

            // 2. Spróbuj pobrać zamówienia z API
            let remoteOrders = [];
            try {
                remoteOrders = await api.getOrders(filters);
            } catch (error) {
                console.warn("Nie udało się pobrać zamówień z serwera, wyświetlam dane lokalne.", error.message);
                showNotification("Jesteś offline. Wyświetlane dane mogą być nieaktualne.", "info");
            }

            // 3. Połącz i zdeduplikuj dane
            const combinedOrders = new Map();

            // Najpierw dodaj dane z serwera (są "ważniejsze")
            remoteOrders.forEach(order => combinedOrders.set(order._id, order));

            // Następnie dodaj dane lokalne, nadpisując tylko jeśli nie ma wersji z serwera
            localOrders.forEach(localOrder => {
                if (localOrder._id && combinedOrders.has(localOrder._id)) {
                    // Jeśli mamy już wersję z serwera, upewnijmy się, że ma status synced
                    const serverVersion = combinedOrders.get(localOrder._id);
                    serverVersion.statusSync = 'synced';
                } else {
                    // Jeśli nie ma wersji serwerowej (lub zamówienie jest czysto lokalne), dodaj
                    const key = localOrder._id || `local-${localOrder.localId}`;
                    combinedOrders.set(key, localOrder);
                }
            });

            const finalOrders = Array.from(combinedOrders.values());

            setOrders(finalOrders);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [filters, showNotification]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleArchiveToggle = async (orderId, isArchived) => {
        try {
            if (isArchived) {
                await api.unarchiveOrder(orderId);
                showNotification('Zamówienie przywrócone!', 'success');
            } else {
                await api.archiveOrder(orderId);
                showNotification('Zamówienie zarchiwizowane!', 'success');
            }
            fetchOrders();
        } catch (error) {
            // Jeśli serwer zwróci 404 (Nie znaleziono), a zamówienie ma lokalne ID,
            // oznacza to, że mamy do czynienia z "osieroconym" zamówieniem.
            // W takim przypadku pozwalamy na usunięcie go tylko z lokalnej bazy danych.
            if (error.message.includes('Nie znaleziono') && orderToDelete.localId) {
                try {
                    await db.orders.delete(orderToDelete.localId);
                    showNotification('Usunięto lokalną kopię zamówienia (nie znaleziono na serwerze).', 'warning');
                    setModalState({ isOpen: false, orderToDelete: null, type: '' });
                    fetchOrders();
                } catch (localError) {
                    showNotification(`Błąd usuwania lokalnego: ${localError.message}`, 'error');
                }
            } else {
                showNotification(error.message, 'error');
            }
        }
    };

    const handleDelete = async () => {
        const { orderToDelete } = modalState;
        if (!orderToDelete) return;

        try {
            const isSynced = orderToDelete.statusSync !== 'pending_sync' && orderToDelete._id;

            if (isSynced) {
                try {
                    await api.deleteOrder(orderToDelete._id);
                } catch (serverError) {
                    if (!serverError.message.includes('Nie znaleziono')) {
                        throw serverError;
                    }
                    console.warn(`Order ${orderToDelete._id} not found on server, deleting locally.`);
                }
            }

            const localKey = orderToDelete.localId || orderToDelete._id;
            if (localKey) {
                await db.orders.delete(localKey);
            }

            showNotification('Zamówienie zostało pomyślnie usunięte.', 'success');

        } catch (error) {
            showNotification(`Wystąpił nieoczekiwany błąd: ${error.message}`, 'error');
        } finally {
            setModalState({ isOpen: false, orderToDelete: null, type: '' });
            fetchOrders();
        }
    };

    const handleFilterChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFilters(prev => ({...prev, [name]: type === 'checkbox' ? checked : value}));
    };

    const resetFilters = () => {
        setFilters({ customer: '', author: '', dateFrom: '', dateTo: '', showArchived: false });
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

    const groupedOrders = useMemo(() => {
        const groups = {
            'Oczekujące na synchronizację': [],
            'Braki': [],
            'Zapisane': [],
            'Skompletowane': [],
            'Zakończono': [],
            'Archiwum': []
        };
        orders.forEach(order => {
            if (order.statusSync === 'pending_sync') {
                 groups['Oczekujące na synchronizację'].push(order);
            } else if (order.isArchived) {
                groups['Archiwum'].push(order);
            } else if (groups[order.status]) {
                groups[order.status].push(order);
            }
        });
        return groups;
    }, [orders]);

    const renderOrderTable = (orderList, isArchivedView = false) => (
        <div className="space-y-4 lg:space-y-0 lg:bg-white lg:dark:bg-gray-800 lg:rounded-lg lg:shadow">
            <div className="hidden lg:grid grid-cols-12 gap-4 font-bold p-3 bg-gray-50 dark:bg-gray-700 rounded-t-lg">
                <div className="col-span-3">Klient</div>
                <div className="col-span-2">Autor</div>
                <div className="col-span-2">Data</div>
                <div className="col-span-2">Status synchronizacji</div>
                <div className="col-span-1 text-right">Wartość</div>
                <div className="col-span-2 text-center">Akcje</div>
            </div>
            <div className="lg:divide-y lg:divide-gray-200 lg:dark:divide-gray-700">
                {orderList.map(order => (
                    <div key={order._id || order.localId} className="bg-white dark:bg-gray-800 rounded-lg shadow lg:shadow-none lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center p-4 lg:p-3">
                        <div className="lg:hidden">
                             <div className="flex justify-between items-start">
                                <h3 className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{order.customerName}</h3>
                                <p className="font-bold text-lg">{(order.total || 0).toFixed(2)} PLN</p>
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                <p>Autor: {order.author}</p>
                                <p>Data: {new Date(order.date || order.updatedAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div className="hidden lg:block col-span-3 font-medium">{order.customerName}</div>
                        <div className="hidden lg:block col-span-2">{order.author}</div>
                        <div className="hidden lg:block col-span-2">{new Date(order.date || order.updatedAt).toLocaleDateString()}</div>
                        <div className="hidden lg:flex col-span-2 items-center">
                            {order.statusSync === 'pending_sync' ? (
                                <><WifiOff className="w-4 h-4 mr-2 text-yellow-500" /> Oczekuje</>
                            ) : (
                                <><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Zsynchronizowano</>
                            )}
                        </div>
                        <div className="hidden lg:block col-span-1 text-right font-semibold">{(order.total || 0).toFixed(2)}</div>
                        <div className="flex justify-end lg:justify-center items-center mt-3 lg:mt-0 lg:col-span-2 border-t lg:border-t-0 pt-3 lg:pt-0">
                             {!isArchivedView && (
                                <Tooltip text="Edytuj/Pokaż"><button onClick={() => onEdit(order._id || order.localId)} className="p-2 text-blue-500 hover:text-blue-700"><Edit className="w-5 h-5"/></button></Tooltip>
                            )}
                            <Tooltip text={isArchivedView ? "Przywróć" : "Archiwizuj"}>
                                <button onClick={() => handleArchiveToggle(order._id, order.isArchived)} className={`p-2 ${isArchivedView ? 'text-green-500 hover:text-green-700' : 'text-gray-500 hover:text-gray-700'}`} disabled={!order._id}>
                                    {isArchivedView ? <RotateCcw className="w-5 h-5"/> : <Archive className="w-5 h-5"/>}
                                </button>
                            </Tooltip>
                            <Tooltip text="Usuń"><button onClick={() => setModalState({ isOpen: true, orderToDelete: order, type: 'delete' })} className="p-2 text-red-500 hover:text-red-700"><Trash2 className="w-5 h-5"/></button></Tooltip>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Zamówienia</h1>
                <div className="flex items-center gap-2 flex-wrap">
                    <input type="file" ref={importMultipleRef} onChange={handleMultipleFileImport} className="hidden" accept=".csv" multiple />
                    <button onClick={() => importMultipleRef.current.click()} className="flex items-center p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"><FileUp className="w-5 h-5"/><span className="hidden sm:inline ml-2">Importuj</span></button>
                    <button onClick={() => setShowFilters(!showFilters)} className="flex items-center p-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"><Filter className="w-5 h-5"/><span className="hidden sm:inline ml-2">Filtry</span></button>
                </div>
            </div>
            {showFilters && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6 shadow-sm animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                        <input type="text" name="customer" value={filters.customer} onChange={handleFilterChange} placeholder="Klient" className="p-2 border rounded-md bg-white dark:bg-gray-700"/>
                        <input type="text" name="author" value={filters.author} onChange={handleFilterChange} placeholder="Autor" className="p-2 border rounded-md bg-white dark:bg-gray-700"/>
                        <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} className="p-2 border rounded-md bg-white dark:bg-gray-700"/>
                        <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} className="p-2 border rounded-md bg-white dark:bg-gray-700"/>
                        <label className="flex items-center gap-2"><input type="checkbox" name="showArchived" checked={filters.showArchived} onChange={handleFilterChange} /> Pokaż zarchiwizowane</label>
                        <button onClick={resetFilters} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg text-sm">Wyczyść</button>
                    </div>
                </div>
            )}
            <div className="space-y-6">
                {filters.showArchived ? (
                    groupedOrders['Archiwum'].length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold mb-3 text-gray-700 dark:text-gray-300">Archiwum ({groupedOrders['Archiwum'].length})</h2>
                            {renderOrderTable(groupedOrders['Archiwum'], true)}
                        </div>
                    )
                ) : (
                    Object.entries(groupedOrders).map(([status, orderList]) => (
                        status !== 'Archiwum' && orderList.length > 0 && (
                            <div key={status}>
                                <h2 className="text-xl font-bold mb-3 text-gray-700 dark:text-gray-300">{status} ({orderList.length})</h2>
                                {renderOrderTable(orderList)}
                            </div>
                        )
                    ))
                )}
            </div>
            {orders.length === 0 && !isLoading && <p className="text-center text-gray-500 mt-8">Brak zamówień do wyświetlenia dla wybranych filtrów.</p>}
            <Modal isOpen={modalState.isOpen} onClose={() => setModalState({ isOpen: false })} title="Potwierdź usunięcie">
                <p>Czy na pewno chcesz usunąć to zamówienie? Tej operacji nie można cofnąć.</p>
                <div className="flex justify-end gap-4 mt-6"><button onClick={() => setModalState({ isOpen: false })} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg">Usuń</button></div>
            </Modal>
        </div>
    );
};

export default OrdersListView;
