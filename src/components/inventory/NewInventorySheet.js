import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { BarChart2, FileDown, FileUp, Printer, Trash2, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import { useSortableData } from '../../hooks/useSortableData';
import Modal from '../common/Modal';
import PinnedInputBar from '../order/PinnedInputBar';

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
        <div className="flex flex-col">
            <div className="flex-grow p-4 md:p-8 pb-56">
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

export default NewInventorySheet;