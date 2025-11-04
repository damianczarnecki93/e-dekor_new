import React, { useState, useEffect, useMemo, useRef } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { pl } from 'date-fns/locale';
import { GoogleMap, useLoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';

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

const DelegationDetails = ({ delegation, onUpdate, onNavigate, setCurrentOrder, isMapLoaded }) => {
    const { showNotification } = useNotification();
    const [visitRecapModal, setVisitRecapModal] = useState({ isOpen: false, clientIndex: null });
    const [directionsResponse, setDirectionsResponse] = useState(null);
    const mapRef = useRef();

    const clientsByDay = useMemo(() => {
        return (delegation.clients || []).reduce((acc, client) => {
            const day = client.date && isValid(parseISO(client.date)) ? format(parseISO(client.date), 'yyyy-MM-dd') : 'unassigned';
            if (!acc[day]) {
                acc[day] = [];
            }
            acc[day].push(client);
            return acc;
        }, {});
    }, [delegation.clients]);

    const validClients = useMemo(() => (delegation.clients || []).filter(c => c.lat && c.lng), [delegation.clients]);

    useEffect(() => {
        if (isMapLoaded && validClients.length > 1) {
            const directionsService = new window.google.maps.DirectionsService();

            const origin = { lat: validClients[0].lat, lng: validClients[0].lng };
            const destination = { lat: validClients[validClients.length - 1].lat, lng: validClients[validClients.length - 1].lng };
            const waypoints = validClients.slice(1, -1).map(client => ({
                location: { lat: client.lat, lng: client.lng },
                stopover: true,
            }));

            directionsService.route(
                {
                    origin: origin,
                    destination: destination,
                    waypoints: waypoints,
                    travelMode: window.google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === window.google.maps.DirectionsStatus.OK) {
                        setDirectionsResponse(result);
                    } else {
                        console.error(`Błąd podczas pobierania trasy: ${status}`);
                    }
                }
            );
        }
    }, [isMapLoaded, validClients]);

    const handleStartDelegation = async () => {
        try {
            const updatedDelegation = await api.startDelegation(delegation._id);
            onUpdate(updatedDelegation);
            showNotification('Delegacja rozpoczęta!', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleEndDelegation = async () => {
        try {
            const updatedDelegation = await api.endDelegation(delegation._id);
            onUpdate(updatedDelegation);
            showNotification('Delegacja zakończona!', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleStartVisit = async (clientIndex) => {
        try {
            const updatedDelegation = await api.startClientVisit(delegation._id, clientIndex);
            onUpdate(updatedDelegation);
            showNotification('Wizyta rozpoczęta!', 'success');
            setCurrentOrder({ customerName: delegation.clients[clientIndex].name, items: [], isDirty: false });
            onNavigate('order');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleEndVisit = async (visitData) => {
        try {
            const updatedDelegation = await api.endClientVisit(delegation._id, visitRecapModal.clientIndex, visitData);
            onUpdate(updatedDelegation);
            setVisitRecapModal({ isOpen: false, clientIndex: null });
            showNotification('Wizyta zakończona.', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                <h2 className="text-2xl font-bold">{delegation.destination}</h2>
                <div>
                    {delegation.status === 'Zaakceptowana' && !delegation.startTime && (
                        <button onClick={handleStartDelegation} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Rozpocznij Delegację</button>
                    )}
                    {delegation.status === 'W trakcie' && (
                        <button onClick={handleEndDelegation} className="px-4 py-2 bg-red-600 text-white rounded-lg">Zakończ Delegację</button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
                <p><strong>Cel:</strong> {delegation.purpose}</p>
                <p><strong>Autor:</strong> {delegation.author}</p>
                <p><strong>Data:</strong> {delegation.dateFrom && isValid(parseISO(delegation.dateFrom)) ? format(parseISO(delegation.dateFrom), 'd MMM yyyy') : ''} - {delegation.dateTo && isValid(parseISO(delegation.dateTo)) ? format(parseISO(delegation.dateTo), 'd MMM yyyy') : ''}</p>
                <p><strong>Status:</strong> {delegation.status}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-xl font-semibold mb-2">Plan Wizyt</h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {Object.keys(clientsByDay).sort().map(day => (
                            <div key={day}>
                                <h4 className="text-lg font-semibold mt-4 mb-2 bg-gray-100 dark:bg-gray-700 p-2 rounded-md">{day !== 'unassigned' && isValid(parseISO(day)) ? format(parseISO(day), 'eeee, d MMMM yyyy', { locale: pl }) : 'Nieprzypisane'}</h4>
                                {clientsByDay[day].map((client, index) => (
                                    <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h5 className="font-bold">{index + 1}. {client.name}</h5>
                                                <p className="text-xs text-gray-500">{client.address}</p>
                                                {client.visitTime && <p className="text-sm font-semibold text-blue-600">Planowana godzina: {client.visitTime}</p>}
                                                {client.note && <p className="mt-1 text-xs italic">Szczegóły: {client.note}</p>}
                                            </div>
                                            <div className="flex gap-2">
                                                {!client.startTime && delegation.status === 'W trakcie' && (
                                                    <button onClick={() => handleStartVisit(index)} className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg">Rozpocznij wizytę</button>
                                                )}
                                                {client.startTime && !client.endTime && (
                                                    <button onClick={() => setVisitRecapModal({isOpen: true, clientIndex: index})} className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg">Zakończ wizytę</button>
                                                )}
                                            </div>
                                        </div>
                                        {client.startTime && (
                                             <div className="mt-2 text-xs border-t pt-2">
                                                <p>Rozpoczęto: {isValid(parseISO(client.startTime)) ? format(parseISO(client.startTime), 'HH:mm:ss') : 'Błędna data'}</p>
                                                {client.endTime && <p>Zakończono: {isValid(parseISO(client.endTime)) ? format(parseISO(client.endTime), 'HH:mm:ss') : 'Błędna data'}</p>}
                                                {client.visitNotes && <p className="mt-1"><strong>Notatki:</strong> {client.visitNotes}</p>}
                                                {client.ordered && <p className="text-green-600 font-bold">Złożono zamówienie</p>}
                                             </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-semibold mb-2">Mapa Trasy</h3>
                    {isMapLoaded ? (
                        <GoogleMap
                            mapContainerStyle={{ height: '400px', width: '100%' }}
                            center={{ lat: 52.2297, lng: 21.0122 }}
                            zoom={7}
                            onLoad={map => { mapRef.current = map; }}
                        >
                            {directionsResponse ? (
                                <DirectionsRenderer directions={directionsResponse} />
                            ) : (
                                validClients.map((client, index) => (
                                    <Marker key={index} position={{ lat: client.lat, lng: client.lng }} label={`${index + 1}`} />
                                ))
                            )}
                        </GoogleMap>
                    ) : <div>Ładowanie mapy...</div>}
                </div>
            </div>

            <Modal isOpen={visitRecapModal.isOpen} onClose={() => setVisitRecapModal({isOpen: false})} title="Podsumowanie wizyty">
                <VisitRecapForm onSubmit={handleEndVisit} />
            </Modal>
        </div>
    );
};

export default DelegationDetails;