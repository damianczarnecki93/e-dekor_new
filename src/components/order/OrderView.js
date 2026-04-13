import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PlusCircle, FileText, FileDown, FileUp, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { api } from '../../api';
import { searchContacts, saveOrderOfflineFirst } from '../../data/repository';
import { useNotification } from '../../contexts/NotificationContext';
import { useSortableData } from '../../hooks/useSortableData';
import Modal from '../common/Modal';
import EditProductModal from '../modals/EditProductModal';
import PinnedInputBar from './PinnedInputBar';
import { ChevronsUpDown, ChevronUp, ChevronDown, Edit, MessageSquare, Trash2 } from 'lucide-react';

const OrderView = ({ currentOrder, setCurrentOrder, user, setDirty, onNewOrder }) => {
    const [order, setOrder] = useState(currentOrder);
    const [noteModal, setNoteModal] = useState({ isOpen: false, itemIndex: null, text: '' });
    const [editModal, setEditModal] = useState({ isOpen: false, itemData: null });
    const [isSaving, setIsSaving] = useState(false);
    const listEndRef = useRef(null);
    const printRef = useRef(null);
    const importFileRef = useRef(null);
    const { showNotification } = useNotification();
    const { items: sortedItems, requestSort, sortConfig } = useSortableData(order.items || []);

    const [contactSearchQuery, setContactSearchQuery] = useState(currentOrder.customerName || '');
    const [contactSuggestions, setContactSuggestions] = useState([]);
    const [isContactLoading, setIsContactLoading] = useState(false);

    const handleAutoSave = useCallback(async (updatedOrder) => {
        if (isSaving || !updatedOrder.customerName) return;
        setIsSaving(true);
        try {
            const savedOrder = await saveOrderOfflineFirst(updatedOrder, user);

            const finalOrder = {
                ...savedOrder,
                items: (savedOrder.items || []).map(item => ({ ...item, isSaved: true })),
                isDirty: savedOrder.statusSync === 'pending_sync'
            };

            // Aktualizuj lokalny stan TYLKO jeśli _id lub id się zgadza,
            // aby uniknąć nadpisania nowszych zmian, które mogły zajść w międzyczasie
            setOrder(prev => {
                if (prev.id === finalOrder.id || (prev._id && prev._id === finalOrder._id)) {
                    return { ...prev, ...finalOrder, isDirty: finalOrder.isDirty };
                }
                return prev;
            });

            setCurrentOrder(finalOrder);
            localStorage.setItem('draftOrder', JSON.stringify(finalOrder));
            setDirty(finalOrder.isDirty);

            if (savedOrder.statusSync === 'pending_sync') {
                showNotification('Jesteś offline. Zamówienie zostało zapisane lokalnie i zostanie wysłane po odzyskaniu połączenia.', 'info');
            }

        } catch (error) {
            showNotification(error.message, 'error');
            setDirty(true);
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, user, setCurrentOrder, setDirty, showNotification]);

    const getSortIcon = (name) => {
        if (!sortConfig || sortConfig.key !== name) {
            return <ChevronsUpDown className="w-4 h-4 ml-1 opacity-40" />;
        }
        return sortConfig.direction === 'ascending' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
    };

    useEffect(() => {
        // Inicjalizuj stan zamówienia tylko jeśli currentOrder się zmienił (np. załadowano inne zamówienie)
        // Unikaj resetowania lokalnego stanu 'order' przy każdym renderze, jeśli currentOrder jest aktualizowany przez handleAutoSave
        setOrder(prev => {
            if (prev.id !== currentOrder.id && (!prev._id || prev._id !== currentOrder._id)) {
                setContactSearchQuery(currentOrder.customerName || '');
                return currentOrder;
            }
            return prev;
        });
        setDirty(currentOrder.isDirty || false);
    }, [currentOrder, setDirty]);

    useEffect(() => {
        if (order.customerId && order.customerName === contactSearchQuery) {
            setContactSuggestions([]);
            return;
        }
        if (contactSearchQuery.trim().length < 2) {
            setContactSuggestions([]);
            return;
        }
        const handler = setTimeout(async () => {
            setIsContactLoading(true);
            try {
                const results = await searchContacts(contactSearchQuery);
                setContactSuggestions(results);
            } catch (error) {
                showNotification(error.message, 'error');
            } finally {
                setIsContactLoading(false);
            }
        }, 3000);
        return () => clearTimeout(handler);
    }, [contactSearchQuery, order.customerId, order.customerName, showNotification]);

    const prevItemsLength = useRef((order.items || []).length);
    useEffect(() => {
        const currentItemsLength = (order.items || []).length;
        if (currentItemsLength > prevItemsLength.current) {
            listEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
        prevItemsLength.current = currentItemsLength;
    }, [order.items]);

    const autoSaveTimer = useRef(null);
    useEffect(() => {
        if (!order.isDirty) {
            return;
        }
        if (autoSaveTimer.current) {
            clearTimeout(autoSaveTimer.current);
        }
        autoSaveTimer.current = setTimeout(() => {
            handleAutoSave(order);
        }, 20000);
        return () => {
            clearTimeout(autoSaveTimer.current);
        };
    }, [order, handleAutoSave]);

    const updateOrder = useCallback((updates, isDirtyFlag = true) => {
        setOrder(prev => {
            const newOrder = { ...prev, ...updates, isDirty: isDirtyFlag };
            // Synchronizacja z nadrzędnym stanem i localStorage powinna być efektem bocznym lub kontrolowana
            setCurrentOrder(newOrder);
            localStorage.setItem('draftOrder', JSON.stringify(newOrder));
            return newOrder;
        });
        setDirty(isDirtyFlag);
    }, [setCurrentOrder, setDirty]);

    const handleSelectContact = (contact) => {
        const updates = {
            customerName: contact.name,
            customerId: contact._id,
            items: (order.items || []).map(item => ({...item, isSaved: false}))
        };
        updateOrder(updates, true);
        setContactSearchQuery(contact.name);
        setContactSuggestions([]);
    };

    const addProductToOrder = (product, quantity) => {
        const newItems = [...(order.items || [])].map(item => ({ ...item, isSaved: false }));
        const productBarcode = product.barcodes && product.barcodes.length > 0 ? product.barcodes[0] : null;
        let existingItemIndex = -1;

        if (productBarcode) {
            existingItemIndex = newItems.findIndex(item => item.barcodes && item.barcodes.includes(productBarcode));
        } else {
            existingItemIndex = newItems.findIndex(item => item._id === product._id);
        }

        if (existingItemIndex > -1) {
            newItems[existingItemIndex].quantity += quantity;
        } else {
            newItems.push({ ...product, quantity: quantity, note: '', isSaved: false });
        }

        const updatedOrder = { ...order, items: newItems, isDirty: true };
        updateOrder(updatedOrder, true);
    };

    const updateQuantity = (itemIndex, newQuantityStr) => {
        const newItems = [...order.items].map(item => ({...item, isSaved: false}));
        const newQuantity = parseInt(newQuantityStr, 10);
        const originalItem = sortedItems[itemIndex];
        const targetIndex = newItems.findIndex(item => item._id === originalItem._id);

        if (targetIndex !== -1) {
            if (!isNaN(newQuantity) && newQuantity >= 0) {
                newItems[targetIndex].quantity = newQuantity;
            } else if (newQuantityStr === '') {
                newItems[targetIndex].quantity = 0;
            }
            const updatedOrder = { ...order, items: newItems, isDirty: true };
            updateOrder(updatedOrder, true);
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
        const newItems = [...order.items].map(item => ({...item, isSaved: false}));
        const originalItem = sortedItems[itemIndex];
        const targetIndex = newItems.findIndex(item => item._id === originalItem._id);
        if (targetIndex !== -1) {
            newItems.splice(targetIndex, 1);
            const updatedOrder = { ...order, items: newItems, isDirty: true };
            updateOrder(updatedOrder, true);
        }
    };

    const handleNoteSave = () => {
        const newItems = [...order.items].map(item => ({...item, isSaved: false}));
        newItems[noteModal.itemIndex].note = noteModal.text;
        const updatedOrder = { ...order, items: newItems, isDirty: true };
        updateOrder(updatedOrder, true);
        setNoteModal({ isOpen: false, itemIndex: null, text: '' });
    };

    const handleDiscountChange = (e) => {
        const newDiscount = e.target.value;
        const discountValue = Math.max(0, parseFloat(newDiscount) || 0);
        updateOrder({ discount: discountValue });
    };

    const totalValue = useMemo(() => (order.items || []).reduce((sum, item) => sum + item.price * (item.quantity || 0), 0), [order.items]);

    const totalValueWithDiscount = useMemo(() => {
        const discountValue = parseFloat(order.discount) || 0;
        return totalValue * (1 - discountValue / 100);
    }, [totalValue, order.discount]);

    const handleSaveOrder = async () => {
        if (!order.customerName) {
            showNotification('Proszę podać nazwę klienta.', 'error');
            return;
        }
        await handleAutoSave(order);
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

    return (
        <div className="h-full flex flex-col">
            <div className="flex-grow p-4 md:p-8 pb-32">
                <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">{order._id ? `Edycja Zamówienia` : 'Nowe Zamówienie'}</h1>
                    <div className="flex gap-2">
                       <button onClick={onNewOrder} className="flex items-center justify-center p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                            <PlusCircle className="w-5 h-5"/> <span className="hidden sm:inline ml-2">Nowe</span>
                        </button>
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
                    <div className="relative w-full max-w-lg">
                        <input
                            type="text"
                            value={contactSearchQuery}
                            onChange={(e) => {
                                const newName = e.target.value;
                                setContactSearchQuery(newName);
                                const updatedOrder = {
                                    ...order,
                                    customerName: newName,
                                    customerId: null,
                                    items: order.items.map(item => ({...item, isSaved: false}))
                                };
                                updateOrder(updatedOrder, true);
                            }}
                            placeholder="Wprowadź nazwę klienta"
                            className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoComplete="off"
                        />
                        {isContactLoading && <div className="absolute right-3 top-3"><div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div></div>}
                        {contactSuggestions.length > 0 && (
                            <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                {contactSuggestions.map(contact => (
                                    <li
                                        key={contact._id}
                                        onClick={() => handleSelectContact(contact)}
                                        className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        <p className="font-semibold">{contact.name}</p>
                                        {contact.company && <p className="text-sm text-gray-500">{contact.company}</p>}
                                        {contact.address && <p className="text-xs text-gray-400">{contact.address}</p>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
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
                    <div>
                        <div className="hidden lg:grid lg:grid-cols-12 gap-4 items-center font-bold p-2 border-b border-gray-200 dark:border-gray-700">
                            <div className="col-span-5 cursor-pointer" onClick={() => requestSort('name')}><div className="flex items-center">Nazwa {getSortIcon('name')}</div></div>
                            <div className="col-span-2 cursor-pointer" onClick={() => requestSort('product_code')}><div className="flex items-center">Kod produktu {getSortIcon('product_code')}</div></div>
                            <div className="col-span-1 text-right cursor-pointer" onClick={() => requestSort('price')}><div className="flex items-center justify-end">Cena {getSortIcon('price')}</div></div>
                            <div className="col-span-1 text-center cursor-pointer" onClick={() => requestSort('quantity')}><div className="flex items-center justify-center">Ilość {getSortIcon('quantity')}</div></div>
                            <div className="col-span-1 text-right">Wartość</div>
                            <div className="col-span-2 text-center">Akcje</div>
                        </div>
                        <div className="lg:divide-y lg:divide-gray-200 lg:dark:divide-gray-700">
                            {sortedItems.map((item, index) => (
                                <div key={item._id || index} className={`block lg:grid lg:grid-cols-12 gap-4 items-center p-4 lg:p-2 ${item.isCustom ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-white dark:bg-gray-800'} lg:bg-transparent lg:dark:bg-transparent mb-4 lg:mb-0 rounded-lg shadow-md lg:shadow-none`}>
                                    <div className="hidden lg:flex lg:col-span-5 font-medium items-center">
                                        {item.isSaved && <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />}
                                        <span className="truncate block">{item.name}</span>
                                        {item.note && <p className="text-xs text-gray-400 mt-1">Notatka: {item.note}</p>}
                                    </div>
                                    <div className="hidden lg:block lg:col-span-2">{item.product_code}</div>
                                    <div className="hidden lg:block lg:col-span-1 text-right">{item.price.toFixed(2)}</div>
                                    <div className="hidden lg:block lg:col-span-1 text-center">
                                        <input type="number" value={item.quantity || ''} onChange={(e) => updateQuantity(index, e.target.value)} onFocus={(e) => e.target.select()} className="w-16 text-center bg-transparent border rounded-md p-1 focus:ring-2 focus:ring-indigo-500 outline-none"/>
                                    </div>
                                    <div className="hidden lg:block lg:col-span-1 text-right font-semibold">{(item.price * (item.quantity || 0)).toFixed(2)}</div>
                                    <div className="w-full lg:hidden">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-bold text-lg">{item.name}</p>
                                                <p className="text-sm text-gray-500">{item.product_code}</p>
                                                {item.note && <p className="text-xs text-gray-400 mt-1">Notatka: {item.note}</p>}
                                            </div>
                                            <p className="font-bold text-lg whitespace-nowrap pl-2">{(item.price * (item.quantity || 0)).toFixed(2)} PLN</p>
                                        </div>
                                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-500">Ilość:</span>
                                                <input type="number" value={item.quantity || ''} onChange={(e) => updateQuantity(index, e.target.value)} onFocus={(e) => e.target.select()} className="w-20 text-center bg-gray-100 dark:bg-gray-700 border rounded-md p-1 focus:ring-2 focus:ring-indigo-500 outline-none"/>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                 <span className="text-sm text-gray-500">Cena:</span>
                                                 <span className="font-semibold">{item.price.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="lg:col-span-2 flex justify-end lg:justify-center items-center mt-2 lg:mt-0">
                                        <button onClick={() => setEditModal({ isOpen: true, itemData: { ...item, originalIndex: index } })} className="p-2 text-gray-500 hover:text-yellow-500"><Edit className="w-5 h-5"/></button>
                                        <button onClick={() => setNoteModal({ isOpen: true, itemIndex: index, text: item.note || '' })} className="p-2 text-gray-500 hover:text-blue-500"><MessageSquare className="w-5 h-5"/></button>
                                        <button onClick={() => removeItemFromOrder(index)} className="p-2 text-gray-500 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {(!order.items || order.items.length === 0) && <p className="text-center text-gray-500 py-8">Brak pozycji na zamówieniu.</p>}
                    <div ref={listEndRef} />
                </div>
                <div className="flex flex-wrap justify-end items-center gap-4 mt-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-right">
                        <span className="text-md font-medium text-gray-600 dark:text-gray-400">Kwota bez rabatu:</span>
                        <span className="text-md font-semibold text-gray-800 dark:text-gray-200">{totalValue.toFixed(2)} PLN</span>

                        <label htmlFor="discount" className="text-md font-medium text-gray-600 dark:text-gray-400 self-center">Rabat:</label>
                        <input
                            type="number"
                            id="discount"
                            value={order.discount || '0'}
                            onChange={handleDiscountChange}
                            onFocus={(e) => e.target.select()}
                            className="w-24 p-1 text-right bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="0"
                        />

                        <span className="text-lg font-bold text-gray-800 dark:text-gray-200 mt-2">Do zapłaty:</span>
                        <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{totalValueWithDiscount.toFixed(2)} PLN</span>
                    </div>
                </div>
            </div>

            <PinnedInputBar onProductAdd={addProductToOrder} onSave={handleSaveOrder} isDirty={order.isDirty} currentItems={order.items || []} />

            <Modal isOpen={noteModal.isOpen} onClose={() => setNoteModal({ isOpen: false, itemIndex: null, text: '' })} title="Dodaj notatkę do pozycji">
                <textarea value={noteModal.text} onChange={(e) => setNoteModal({...noteModal, text: e.target.value})} className="w-full p-2 border rounded-md min-h-[100px] bg-white dark:bg-gray-700"></textarea>
                <div className="flex justify-end gap-4 mt-4"><button onClick={() => setNoteModal({ isOpen: false, itemIndex: null, text: '' })} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={handleNoteSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz notatkę</button></div>
            </Modal>

            <EditProductModal
                isOpen={editModal.isOpen}
                onClose={() => setEditModal({ isOpen: false, itemData: null })}
                itemData={editModal.itemData}
                onSave={(editedItem) => {
                    const newItems = [...order.items];
                    const originalItem = sortedItems[editedItem.originalIndex];
                    const targetIndex = newItems.findIndex(item => item._id === originalItem._id);
                    if (targetIndex !== -1) {
                        newItems[targetIndex] = { ...newItems[targetIndex], ...editedItem };
                        delete newItems[targetIndex].originalIndex;
                        updateOrder({ items: newItems });
                    }
                    setEditModal({ isOpen: false, itemData: null });
                }}
            />
        </div>
    );
};

export default OrderView;