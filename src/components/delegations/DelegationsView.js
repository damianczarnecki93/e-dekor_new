import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { GoogleMap, useLoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { PlusCircle, Edit, Trash2, Eye, CheckCircle, XCircle, ChevronsUpDown, ChevronUp, ChevronDown, Menu } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import { useSortableData } from '../../hooks/useSortableData';
import Modal from '../common/Modal';
import Tooltip from '../common/Tooltip';
import DelegationForm from './DelegationForm';
import DelegationDetails from './DelegationDetails';

const DelegationsView = ({ user, onNavigate, setCurrentOrder }) => {
    const [delegations, setDelegations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [detailsModal, setDetailsModal] = useState({ isOpen: false, delegation: null });
    const { showNotification } = useNotification();

    const { items: sortedDelegations, requestSort, sortConfig } = useSortableData(delegations);

    const LIBRARIES = useMemo(() => ['places', 'geocoding'], []);
    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: "AIzaSyDMr9jJIDp0M52-pvwJjehyXShfHmQ0AYE", // <-- WAŻNE: ZASTĄP SWOIM KLUCZEM
        libraries: LIBRARIES,
    });

    const getSortIcon = (name) => {
        if (!sortConfig || sortConfig.key !== name) {
            return <ChevronsUpDown className="w-4 h-4 ml-1 opacity-40" />;
        }
        return sortConfig.direction === 'ascending' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
    };

    const fetchDelegations = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getDelegations();
            setDelegations(data);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showNotification]);

    useEffect(() => {
        fetchDelegations();
    }, [fetchDelegations]);

    const handleAddOrUpdateDelegation = async (delegationData) => {
        try {
            await api.saveDelegation(delegationData);
            showNotification(`Delegacja pomyślnie ${delegationData._id ? 'zaktualizowana' : 'dodana'}.`, 'success');
            setIsFormModalOpen(false);
            fetchDelegations();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await api.updateDelegationStatus(id, status);
            showNotification('Status delegacji został zaktualizowany.', 'success');
            fetchDelegations();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleDelete = async (id) => {
        if(window.confirm("Czy na pewno chcesz usunąć tę delegację?")) {
            try {
                await api.deleteDelegation(id);
                showNotification("Delegacja usunięta", "success");
                fetchDelegations();
            } catch (error) {
                showNotification(error.message, "error");
            }
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Zaakceptowana': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
            case 'Odrzucona': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            case 'W trakcie': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            case 'Zakończona': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
            default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        }
    };

    const handleDelegationUpdate = (updatedDelegation) => {
        setDelegations(prev => prev.map(d => d._id === updatedDelegation._id ? updatedDelegation : d));
        setDetailsModal(prev => ({...prev, delegation: updatedDelegation}));
    };

    if (loadError) return <div className="p-8 text-red-500">Błąd ładowania mapy. Sprawdź klucz API i ustawienia w Google Cloud Console.</div>;

    return (
        <div className="p-2 sm:p-4 md:p-8">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                <h1 className="text-2xl md:text-3xl font-bold">Planer Wizyt i Tras</h1>
                <button onClick={() => setIsFormModalOpen(true)} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <PlusCircle className="w-5 h-5 md:mr-2"/>
                    <span className="hidden md:inline">Nowa Delegacja</span>
                </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="p-2 sm:p-3 cursor-pointer" onClick={() => requestSort('destination')}><div className="flex items-center">Cel {getSortIcon('destination')}</div></th>
                            <th className="hidden md:table-cell p-2 sm:p-3 cursor-pointer" onClick={() => requestSort('author')}><div className="flex items-center">Autor {getSortIcon('author')}</div></th>
                            <th className="p-2 sm:p-3 cursor-pointer" onClick={() => requestSort('dateFrom')}><div className="flex items-center">Daty {getSortIcon('dateFrom')}</div></th>
                            <th className="p-2 sm:p-3 text-center">Status</th>
                            <th className="p-2 sm:p-3 text-center">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {isLoading ? (<tr><td colSpan="5" className="p-8 text-center text-gray-500">Ładowanie...</td></tr>) : sortedDelegations.map(d => (
                            <tr key={d._id}>
                                <td className="p-2 sm:p-3 font-medium">{d.destination}</td>
                                <td className="hidden md:table-cell p-2 sm:p-3">{d.author}</td>
                                <td className="p-2 sm:p-3">{format(parseISO(d.dateFrom), 'd.MM.yy')} - {format(parseISO(d.dateTo), 'd.MM.yy')}</td>
                                <td className="p-2 sm:p-3 text-center"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(d.status)}`}>{d.status}</span></td>
                                <td className="p-2 sm:p-3 text-center whitespace-nowrap">
                                    <Tooltip text="Podgląd"><button onClick={() => setDetailsModal({isOpen: true, delegation: d})} className="p-2 text-blue-500 hover:text-blue-700"><Eye className="w-5 h-5"/></button></Tooltip>
                                    <Tooltip text="Edytuj"><button onClick={() => setIsFormModalOpen(d)} className="p-2 text-yellow-500 hover:text-yellow-700"><Edit className="w-5 h-5"/></button></Tooltip>
                                    {user.role === 'administrator' && d.status === 'Oczekująca' && (
                                        <>
                                            <Tooltip text="Akceptuj"><button onClick={() => handleStatusUpdate(d._id, 'Zaakceptowana')} className="p-2 text-green-500 hover:text-green-700"><CheckCircle className="w-5 h-5"/></button></Tooltip>
                                            <Tooltip text="Odrzuć"><button onClick={() => handleStatusUpdate(d._id, 'Odrzucona')} className="p-2 text-red-500 hover:text-red-700"><XCircle className="w-5 h-5"/></button></Tooltip>
                                        </>
                                    )}
                                    {(user.id === d.authorId || user.role === 'administrator') && (
                                        <Tooltip text="Usuń"><button onClick={() => handleDelete(d._id)} className="p-2 text-gray-500 hover:text-red-500"><Trash2 className="w-5 h-5"/></button></Tooltip>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title={isFormModalOpen._id ? "Edytuj Delegację" : "Nowa Delegacja"} maxWidth="2xl">
                <DelegationForm onSubmit={handleAddOrUpdateDelegation} delegationData={isFormModalOpen._id ? isFormModalOpen : null} />
            </Modal>
            <Modal isOpen={detailsModal.isOpen} onClose={() => setDetailsModal({isOpen: false, delegation: null})} title="Szczegóły Delegacji" maxWidth="4xl">
                {detailsModal.delegation && <DelegationDetails delegation={detailsModal.delegation} onUpdate={handleDelegationUpdate} onNavigate={onNavigate} setCurrentOrder={setCurrentOrder} isMapLoaded={isLoaded}/>}
            </Modal>
        </div>
    );
};

export default DelegationsView;