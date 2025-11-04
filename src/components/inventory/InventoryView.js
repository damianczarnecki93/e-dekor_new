import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { PlusCircle, FileUp, Edit, Trash2, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import { useSortableData } from '../../hooks/useSortableData';
import Modal from '../common/Modal';

const InventoryView = ({ user, onNavigate, isDirty, setIsDirty }) => {
    const [inventories, setInventories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, invId: null });
    const importMultipleRef = React.useRef(null);
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

export default InventoryView;