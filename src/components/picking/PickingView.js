import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, FileDown, AlertTriangle, RotateCcw } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';
import Tooltip from '../common/Tooltip';

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

export default PickingView;