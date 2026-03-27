import React, { useState, useEffect } from 'react';
import { format, parseISO, eachDayOfInterval, isValid } from 'date-fns';
import { pl } from 'date-fns/locale';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { PlusCircle, Trash2, Menu } from 'lucide-react';
import Modal from '../common/Modal';
import DelegationDetails from './DelegationDetails';

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

export default DelegationForm;