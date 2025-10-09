import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlusCircle, FileUp, Edit, Trash2 } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';
import ContactFormModal from './ContactFormModal';

const CrmView = ({ user }) => {
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalState, setModalState] = useState({ isOpen: false, contact: null });
    const [filters, setFilters] = useState({ search: '', status: '', accountManager: '' });
    const [users, setUsers] = useState([]);
    const { showNotification } = useNotification();
    const importFileRef = useRef(null);

    const fetchContacts = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams(filters).toString();
            const data = await api.getContacts(params);
            setContacts(data);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showNotification, filters]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const userList = await api.getUsersList();
                setUsers(userList);
            } catch (error) {
                showNotification('Nie udało się wczytać listy użytkowników', 'error');
            }
        };
        fetchUsers();
    }, [showNotification]);

    useEffect(() => {
        const handler = setTimeout(() => {
            fetchContacts();
        }, 300);
        return () => clearTimeout(handler);
    }, [filters, fetchContacts]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({ search: '', status: '', accountManager: '' });
    };

    const handleSaveContact = async (contactData) => {
        try {
            if (modalState.contact?._id) {
                await api.updateContact(modalState.contact._id, contactData);
                showNotification('Kontakt zaktualizowany!', 'success');
            } else {
                await api.addContact(contactData);
                showNotification('Kontakt dodany!', 'success');
            }
            setModalState({ isOpen: false, contact: null });
            fetchContacts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleDelete = async (contactId) => {
        if (window.confirm('Czy na pewno chcesz usunąć ten kontakt?')) {
            try {
                await api.deleteContact(contactId);
                showNotification('Kontakt usunięty.', 'success');
                fetchContacts();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }
    };

    const handleFileImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const result = await api.importContacts(file);
            showNotification(result.message, 'success');
            fetchContacts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
        event.target.value = null;
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Kontakty CRM</h1>
                <div className="flex gap-2">
                    <input type="file" ref={importFileRef} onChange={handleFileImport} className="hidden" accept=".csv" />
                    <button onClick={() => importFileRef.current.click()} className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">
                        <FileUp className="w-5 h-5 mr-2"/> Importuj
                    </button>
                    <button onClick={() => setModalState({ isOpen: true, contact: null })} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <PlusCircle className="w-5 h-5 mr-2"/> Nowy
                    </button>
                </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input type="text" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Nazwa, firma, email..." className="p-2 border rounded-md bg-white dark:bg-gray-700"/>
                    <select name="status" value={filters.status} onChange={handleFilterChange} className="p-2 border rounded-md bg-white dark:bg-gray-700">
                        <option value="">Wszystkie statusy</option>
                        <option>Lead</option>
                        <option>Klient</option>
                        <option>Utracony</option>
                        <option>Partner</option>
                    </select>
                    <select name="accountManager" value={filters.accountManager} onChange={handleFilterChange} className="p-2 border rounded-md bg-white dark:bg-gray-700">
                        <option value="">Wszyscy opiekunowie</option>
                        {users.map(u => <option key={u._id} value={u.username}>{u.username}</option>)}
                    </select>
                    <button onClick={resetFilters} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg text-sm">Wyczyść filtry</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="p-4">Nazwa</th>
                            <th className="p-4">Firma</th>
                            <th className="p-4">Email</th>
                            <th className="p-4">Telefon</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Opiekun</th>
                            <th className="p-4">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {isLoading ? (
                            <tr><td colSpan="7" className="p-8 text-center">Ładowanie...</td></tr>
                        ) : contacts.map(contact => (
                            <tr key={contact._id}>
                                <td className="p-4 font-medium">{contact.name}</td>
                                <td className="p-4">{contact.company}</td>
                                <td className="p-4">{contact.email}</td>
                                <td className="p-4">{contact.phone}</td>
                                <td className="p-4"><span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{contact.status}</span></td>
                                <td className="p-4">{contact.accountManager}</td>
                                <td className="p-4">
                                    <button onClick={() => setModalState({ isOpen: true, contact })} className="p-2 text-blue-500 hover:text-blue-700"><Edit className="w-5 h-5"/></button>
                                    <button onClick={() => handleDelete(contact._id)} className="p-2 text-red-500 hover:text-red-700"><Trash2 className="w-5 h-5"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ContactFormModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ isOpen: false, contact: null })}
                onSave={handleSaveContact}
                contact={modalState.contact}
            />
        </div>
    );
};

export default CrmView;