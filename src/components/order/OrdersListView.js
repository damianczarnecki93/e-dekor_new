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
    const [selectedOrderKeys, setSelectedOrderKeys] = useState([]);
    const { showNotification } = useNotification();
    const [filters, setFilters] = useState({ customer: '', author: '', dateFrom: '', dateTo: '', showArchived: false });
    const [showFilters, setShowFilters] = useState(false);
    const importMultipleRef = useRef(null);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const localOrders = await db.orders.toArray();
            let remoteOrders = [];
            try {
                remoteOrders = await api.getOrders(filters);
            } catch (error) {
                console.warn("Nie udało się pobrać zamówień z serwera, wyświetlam dane lokalne.", error.message);
                showNotification("Jesteś offline. Wyświetlane dane mogą być nieaktualne.", "info");
            }

            const combinedOrders = new Map();
            remoteOrders.forEach(order => combinedOrders.set(order._id, order));

            localOrders.forEach(localOrder => {
                if (localOrder._id && combinedOrders.has(localOrder._id)) {
                    const serverVersion = combinedOrders.get(localOrder._id);
                    serverVersion.statusSync = 'synced';
                } else {
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

    const toggleSelectOrder = (key) => {
        setSelectedOrderKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const toggleSelectAll = (visibleOrders) => {
        const visibleKeys = visibleOrders.map(o => o._id || o.localId);
        const allSelected = visibleKeys.length > 0 && visibleKeys.every(k => selectedOrderKeys.includes(k));
        if (allSelected) {
            setSelectedOrderKeys(prev => prev.filter(k => !visibleKeys.includes(k)));
        } else {
            setSelectedOrderKeys(prev => Array.from(new Set([...prev, ...visibleKeys])));
        }
    };

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
            showNotification(error.message, 'error');
        }
    };

    const handleBulkArchiveToggle = async (archive) => {
        const selectedOrders = orders.filter(o => selectedOrderKeys.includes(o._id || o.localId));
        let successCount = 0;
        for (const order of selectedOrders) {
            if (!order._id) continue;
            try {
                if (archive) {
                    await api.archiveOrder(order._id);
                } else {
                    await api.unarchiveOrder(order._id);
                }
                successCount++;
            } catch (e) {
                console.error(e);
            }
        }
        showNotification(`Wykonano akcję dla ${successCount} zamówień.`, 'success');
        setSelectedOrderKeys([]);
        fetchOrders();
    };

    const handleDelete = async () => {
        if (modalState.type === 'bulkDelete') {
            await handleBulkDelete();
            return;
        }

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

    const handleBulkDelete = async () => {
        const selectedOrders = orders.filter(o => selectedOrderKeys.includes(o._id || o.localId));
        let count = 0;
        for (const order of selectedOrders) {
            try {
                if (order._id && order.statusSync !== 'pending_sync') {
                    try {
                        await api.deleteOrder(order._id);
                    } catch (e) {
                        console.warn(e);
                    }
                }
                const localKey = order.localId || order._id;
                if (localKey) {
                    await db.orders.delete(localKey);
                }
                count++;
            } catch (e) {
                console.error(e);
            }
        }
        showNotification(`Usunięto ${count} zamówień.`, 'success');
        setSelectedOrderKeys([]);
        setModalState({ isOpen: false, orderToDelete: null, type: '' });
        fetchOrders();
    };

    const handleFilterChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFilters(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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

    const renderOrderTable = (orderList, isArchivedView = false) => {
        const visibleKeys = orderList.map(o => o._id || o.localId);
        const isAllSelected = visibleKeys.length > 0 && visibleKeys.every(k => selectedOrderKeys.includes(k));

        return (
            <div className="space-y-4 lg:space-y-0 lg:bg-white lg:dark:bg-gray-800 lg:rounded-lg lg:shadow">
                <div className="hidden lg:grid grid-cols-12 gap-4 font-bold p-3 bg-gray-50 dark:bg-gray-700 rounded-t-lg items-center">
                    <div className="col-span-1 flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={() => toggleSelectAll(orderList)}
                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                        />
                    </div>
                    <div className="col-span-3">Klient</div>
                    <div className="col-span-2">Autor</div>
                    <div className="col-span-2">Data</div>
                    <div className="col-span-2">Status synchronizacji</div>
                    <div className="col-span-1 text-right">Wartość</div>
                    <div className="col-span-1 text-center">Akcje</div>
                </div>
                <div className="lg:divide-y lg:divide-gray-200 lg:dark:divide-gray-700">
                    {orderList.map(order => {
                        const key = order._id || order.localId;
                        const isSelected = selectedOrderKeys.includes(key);

                        return (
                            <div
                                key={key}
                                className={`bg-white dark:bg-gray-800 rounded-lg shadow lg:shadow-none lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center p-4 lg:p-3 transition-colors ${
                                    isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''
                                }`}
                            >
                                <div className="lg:hidden flex justify-between items-center mb-2">
                                    <label className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelectOrder(key)}
                                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <span>{order.customerName}</span>
                                    </label>
                                    <p className="font-bold text-lg">{(order.total || 0).toFixed(2)} PLN</p>
                                </div>
                                <div className="lg:hidden text-sm text-gray-500 dark:text-gray-400">
                                    <p>Autor: {order.author}</p>
                                    <p>Data: {new Date(order.date || order.updatedAt).toLocaleDateString()}</p>
                                </div>

                                <div className="hidden lg:flex col-span-1 items-center">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectOrder(key)}
                                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                                    />
                                </div>
                                <div className="hidden lg:block col-span-3 font-medium truncate">{order.customerName}</div>
                                <div className="hidden lg:block col-span-2">{order.author}</div>
                                <div className="hidden lg:block col-span-2">{new Date(order.date || order.updatedAt).toLocaleDateString()}</div>
                                <div className="hidden lg:flex col-span-2 items-center text-sm">
                                    {order.statusSync === 'pending_sync' ? (
                                        <><WifiOff className="w-4 h-4 mr-2 text-yellow-500" /> Oczekuje</>
                                    ) : (
                                        <><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Zsynchronizowano</>
                                    )}
                                </div>
                                <div className="hidden lg:block col-span-1 text-right font-semibold">{(order.total || 0).toFixed(2)}</div>
                                <div className="flex justify-end lg:justify-center items-center mt-3 lg:mt-0 lg:col-span-1 border-t lg:border-t-0 pt-3 lg:pt-0 gap-1">
                                    {!isArchivedView && (
                                        <Tooltip text="Edytuj/Pokaż"><button onClick={() => onEdit(order._id || order.localId)} className="p-1.5 text-blue-500 hover:text-blue-700"><Edit className="w-5 h-5"/></button></Tooltip>
                                    )}
                                    <Tooltip text={isArchivedView ? "Przywróć" : "Archiwizuj"}>
                                        <button onClick={() => handleArchiveToggle(order._id, order.isArchived)} className={`p-1.5 ${isArchivedView ? 'text-green-500 hover:text-green-700' : 'text-gray-500 hover:text-gray-700'}`} disabled={!order._id}>
                                            {isArchivedView ? <RotateCcw className="w-5 h-5"/> : <Archive className="w-5 h-5"/>}
                                        </button>
                                    </Tooltip>
                                    <Tooltip text="Usuń"><button onClick={() => setModalState({ isOpen: true, orderToDelete: order, type: 'single' })} className="p-1.5 text-red-500 hover:text-red-700"><Trash2 className="w-5 h-5"/></button></Tooltip>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8 relative pb-24">
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

            {/* Floating Bulk Action Bar */}
            {selectedOrderKeys.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white dark:bg-gray-800 dark:text-gray-100 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-gray-700 animate-fade-in">
                    <span className="font-semibold text-sm whitespace-nowrap">
                        Zaznaczono: <span className="text-indigo-400 font-bold text-base">{selectedOrderKeys.length}</span>
                    </span>
                    <div className="h-5 w-px bg-gray-700" />
                    <button
                        onClick={() => handleBulkArchiveToggle(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                    >
                        <Archive className="w-4 h-4" />
                        Archiwizuj
                    </button>
                    <button
                        onClick={() => handleBulkArchiveToggle(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Przywróć
                    </button>
                    <button
                        onClick={() => setModalState({ isOpen: true, orderToDelete: null, type: 'bulkDelete' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 rounded-lg transition"
                    >
                        <Trash2 className="w-4 h-4" />
                        Usuń
                    </button>
                    <button
                        onClick={() => setSelectedOrderKeys([])}
                        className="ml-2 text-xs text-gray-400 hover:text-white underline"
                    >
                        Odznacz
                    </button>
                </div>
            )}

            <Modal isOpen={modalState.isOpen} onClose={() => setModalState({ isOpen: false, orderToDelete: null, type: '' })} title="Potwierdź usunięcie">
                <p>
                    {modalState.type === 'bulkDelete'
                        ? `Czy na pewno chcesz usunąć zaznaczone zamówienia (${selectedOrderKeys.length})? Tej operacji nie można cofnąć.`
                        : 'Czy na pewno chcesz usunąć to zamówienie? Tej operacji nie można cofnąć.'}
                </p>
                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={() => setModalState({ isOpen: false, orderToDelete: null, type: '' })} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button>
                    <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg">Usuń</button>
                </div>
            </Modal>
        </div>
    );
};

export default OrdersListView;
