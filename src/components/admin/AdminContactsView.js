import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlusCircle, FileUp, Edit, Trash2, HelpCircle, ChevronDown, ChevronUp, Search, RefreshCw } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import ContactFormModal from '../crm/ContactFormModal';

const AdminContactsView = () => {
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalState, setModalState] = useState({ isOpen: false, contact: null });
    const [filters, setFilters] = useState({ search: '', status: '', accountManager: '' });
    const [users, setUsers] = useState([]);
    const [showInstructions, setShowInstructions] = useState(false);
    const { showNotification } = useNotification();
    const importFileRef = useRef(null);

    const fetchContacts = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams(filters).toString();
            const data = await api.getAdminContacts(params);
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
                await api.updateAdminContact(modalState.contact._id, contactData);
                showNotification('Kontakt zaktualizowany!', 'success');
            } else {
                await api.addAdminContact(contactData);
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
                await api.deleteAdminContact(contactId);
                showNotification('Kontakt został usunięty.', 'success');
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
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Zarządzanie Kontaktami (Panel Admina)</h1>
                    <p className="text-gray-500 text-sm mt-1">Przeglądaj, edytuj, dodawaj i importuj kontakty dla wszystkich użytkowników.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setShowInstructions(!showInstructions)}
                        className="flex items-center px-4 py-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 rounded-lg hover:bg-indigo-200 transition-colors"
                    >
                        <HelpCircle className="w-5 h-5 mr-2" />
                        Instrukcja importu
                        {showInstructions ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                    </button>
                    <input type="file" ref={importFileRef} onChange={handleFileImport} className="hidden" accept=".csv" />
                    <button onClick={() => importFileRef.current.click()} className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors">
                        <FileUp className="w-5 h-5 mr-2"/> Importuj CSV
                    </button>
                    <button onClick={() => setModalState({ isOpen: true, contact: null })} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                        <PlusCircle className="w-5 h-5 mr-2"/> Dodaj Kontakt
                    </button>
                </div>
            </div>

            {/* Instrukcje importu i zarządzania */}
            {showInstructions && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6 border border-indigo-100 dark:border-indigo-900 animate-fade-in">
                    <h2 className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mb-3 flex items-center">
                        <HelpCircle className="w-6 h-6 mr-2" /> Instrukcja oraz specyfikacja importu kontaktów
                    </h2>

                    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                        <p>
                            System umożliwia masowy import oraz pełne zarządzanie kontaktami w bazie CRM za pomocą plików <strong>CSV</strong>.
                        </p>

                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                            <h3 className="font-semibold text-base mb-2 text-gray-900 dark:text-white">Format i wymagania pliku CSV:</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Kodowanie:</strong> UTF-8</li>
                                <li><strong>Ogranicznik:</strong> Przecinek (<code>,</code>) lub średnik (<code>;</code>)</li>
                                <li><strong>Pierwsza linia:</strong> Nagłówek (jest automatycznie pomijany podczas importu)</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-base mb-2 text-gray-900 dark:text-white">Kolejność kolumn w pliku:</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border border-gray-200 dark:border-gray-700">
                                    <thead className="bg-gray-100 dark:bg-gray-700 font-semibold">
                                        <tr>
                                            <th className="p-2 border">Kolumna</th>
                                            <th className="p-2 border">Pole</th>
                                            <th className="p-2 border">Wymagane</th>
                                            <th className="p-2 border">Opis / Dozwolone wartości</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="p-2 border font-mono">1</td>
                                            <td className="p-2 border font-bold">name</td>
                                            <td className="p-2 border text-red-600 font-bold">TAK</td>
                                            <td className="p-2 border">Nazwa / Imię i nazwisko kontaktu (wiersze bez nazwy zostaną pominięte)</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 border font-mono">2</td>
                                            <td className="p-2 border">company</td>
                                            <td className="p-2 border">Nie</td>
                                            <td className="p-2 border">Nazwa firmy / klienta</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 border font-mono">3</td>
                                            <td className="p-2 border">email</td>
                                            <td className="p-2 border">Nie</td>
                                            <td className="p-2 border">Adres e-mail kontaktowy</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 border font-mono">4</td>
                                            <td className="p-2 border">phone</td>
                                            <td className="p-2 border">Nie</td>
                                            <td className="p-2 border">Numer telefonu</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 border font-mono">5</td>
                                            <td className="p-2 border">address</td>
                                            <td className="p-2 border">Nie</td>
                                            <td className="p-2 border">Adres fizyczny / dostawy</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 border font-mono">6</td>
                                            <td className="p-2 border">status</td>
                                            <td className="p-2 border">Nie</td>
                                            <td className="p-2 border">Status CRM: <code>Lead</code>, <code>Klient</code>, <code>Utracony</code>, <code>Partner</code> (Domyślnie: Lead)</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 border font-mono">7</td>
                                            <td className="p-2 border">notes</td>
                                            <td className="p-2 border">Nie</td>
                                            <td className="p-2 border">Notatki oraz dodatkowe uwagi do kontaktu</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 border font-mono">8</td>
                                            <td className="p-2 border">accountManager</td>
                                            <td className="p-2 border">Nie</td>
                                            <td className="p-2 border">Nazwa użytkownika opiekuna klienta (np. janusz)</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-indigo-50 dark:bg-indigo-950 p-4 rounded-md border-l-4 border-indigo-500">
                            <h4 className="font-semibold text-indigo-900 dark:text-indigo-200">Zasady aktualizacji i zapobiegania duplikatom:</h4>
                            <p className="mt-1 text-xs">
                                Podczas importu system dopasowuje rekordy po adresie <strong>e-mail</strong> lub parze <strong>nazwa + firma</strong>. Jeśli dany kontakt istnieje w bazie, zostaje automatycznie zaktualizowany o nowe dane z pliku CSV. W przeciwnym razie tworzony jest nowy kontakt.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Filtry */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg mb-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            name="search"
                            value={filters.search}
                            onChange={handleFilterChange}
                            placeholder="Szukaj nazwy, firmy, email, tel..."
                            className="pl-10 p-2 w-full border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <select
                        name="status"
                        value={filters.status}
                        onChange={handleFilterChange}
                        className="p-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    >
                        <option value="">Wszystkie statusy</option>
                        <option value="Lead">Lead</option>
                        <option value="Klient">Klient</option>
                        <option value="Utracony">Utracony</option>
                        <option value="Partner">Partner</option>
                    </select>
                    <select
                        name="accountManager"
                        value={filters.accountManager}
                        onChange={handleFilterChange}
                        className="p-2 border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    >
                        <option value="">Wszyscy opiekunowie</option>
                        {users.map(u => <option key={u._id} value={u.username}>{u.username}</option>)}
                    </select>
                    <button
                        onClick={resetFilters}
                        className="flex items-center justify-center px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" /> Resetuj filtry
                    </button>
                </div>
            </div>

            {/* Tabela kontaktów */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto border border-gray-200 dark:border-gray-700">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        <tr>
                            <th className="p-4 border-b dark:border-gray-600 font-semibold">Nazwa / Imię i nazwisko</th>
                            <th className="p-4 border-b dark:border-gray-600 font-semibold">Firma</th>
                            <th className="p-4 border-b dark:border-gray-600 font-semibold">Email</th>
                            <th className="p-4 border-b dark:border-gray-600 font-semibold">Telefon</th>
                            <th className="p-4 border-b dark:border-gray-600 font-semibold">Status</th>
                            <th className="p-4 border-b dark:border-gray-600 font-semibold">Opiekun</th>
                            <th className="p-4 border-b dark:border-gray-600 font-semibold text-right">Akcje</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {isLoading ? (
                            <tr><td colSpan="7" className="p-8 text-center text-gray-500">Ładowanie bazy kontaktów...</td></tr>
                        ) : contacts.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-gray-500">Brak kontaktów spełniających kryteria.</td></tr>
                        ) : contacts.map(contact => (
                            <tr key={contact._id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                <td className="p-4 font-medium text-gray-900 dark:text-white">{contact.name}</td>
                                <td className="p-4 text-gray-600 dark:text-gray-300">{contact.company || '-'}</td>
                                <td className="p-4 text-gray-600 dark:text-gray-300">{contact.email || '-'}</td>
                                <td className="p-4 text-gray-600 dark:text-gray-300">{contact.phone || '-'}</td>
                                <td className="p-4">
                                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                        contact.status === 'Klient' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                        contact.status === 'Lead' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                        contact.status === 'Partner' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>
                                        {contact.status || 'Lead'}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-600 dark:text-gray-300">{contact.accountManager || '-'}</td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => setModalState({ isOpen: true, contact })}
                                        className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-2 rounded hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                                        title="Edytuj kontakt"
                                    >
                                        <Edit className="w-5 h-5"/>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(contact._id)}
                                        className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                                        title="Usuń kontakt"
                                    >
                                        <Trash2 className="w-5 h-5"/>
                                    </button>
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

export default AdminContactsView;
