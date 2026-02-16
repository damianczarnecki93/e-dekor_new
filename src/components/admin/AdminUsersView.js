import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';
import Tooltip from '../common/Tooltip';

const AdminUsersView = ({ user }) => {
    const [users, setUsers] = useState([]);
    const { showNotification } = useNotification();
    const [modalState, setModalState] = useState({ isOpen: false, user: null, type: '' });
    const [newPassword, setNewPassword] = useState('');

    const allModules = [
        { id: 'search', label: 'Wyszukiwarka' },
        { id: 'order', label: 'Nowe Zamówienie' },
        { id: 'orders', label: 'Zamówienia' },
        { id: 'picking', label: 'Kompletacja' },
        { id: 'inventory', label: 'Inwentaryzacja' },
        { id: 'kanban', label: 'Tablica Zadań' },
        { id: 'delegations', label: 'Delegacje' },
        { id: 'labels', label: 'Etykiety' },
		{ id: 'shortage-report', label: 'Raport Braków' }
    ];

    const fetchUsers = useCallback(async () => {
        try {
            const userList = await api.getUsers();
            setUsers(userList);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }, [showNotification]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleModuleChange = async (userId, moduleId, isVisible) => {
        const targetUser = users.find(u => u._id === userId);
        if (!targetUser) return;

        let updatedModules;
        const currentModules = targetUser.visibleModules || [];

        if (isVisible) {
            updatedModules = [...currentModules, moduleId];
        } else {
            updatedModules = currentModules.filter(m => m !== moduleId);
        }

        try {
            await api.updateUserModules(userId, updatedModules);
            showNotification('Uprawnienia zaktualizowane', 'success');
            setUsers(users.map(u => u._id === userId ? {...u, visibleModules: updatedModules} : u));
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleApproveUser = async (userId) => {
        try { await api.approveUser(userId); showNotification('Użytkownik został zaakceptowany!', 'success'); fetchUsers(); }
        catch (error) { showNotification(error.message, 'error'); }
    };

    const handleRoleChange = async (userId, newRole) => {
        try { await api.changeUserRole(userId, newRole); showNotification('Rola użytkownika została zmieniona!', 'success'); fetchUsers(); }
        catch (error) { showNotification(error.message, 'error'); }
    };

    const handleDeleteUser = async (userId) => {
        try { await api.deleteUser(userId); showNotification('Użytkownik został usunięty!', 'success'); setModalState({ isOpen: false, user: null, type: '' }); fetchUsers(); }
        catch (error) { showNotification(error.message, 'error'); }
    };

    const handleChangePassword = async () => {
        if (newPassword.length < 6) { showNotification('Nowe hasło musi mieć co najmniej 6 znaków.', 'error'); return; }
        try { await api.changePassword(modalState.user._id, newPassword); showNotification('Hasło zostało zmienione!', 'success'); setModalState({ isOpen: false, user: null, type: '' }); setNewPassword(''); }
        catch (error) { showNotification(error.message, 'error'); }
    };

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-2xl font-semibold mb-4">Zarządzanie Użytkownikami</h2>
            <div className="space-y-4 lg:space-y-0 lg:bg-white lg:dark:bg-gray-800 lg:rounded-lg lg:shadow">
                 <div className="hidden lg:grid grid-cols-10 gap-4 font-bold p-3 bg-gray-50 dark:bg-gray-700 rounded-t-lg">
                    <div className="col-span-2">Użytkownik</div>
                    <div className="col-span-2">Rola</div>
                    <div className="col-span-4">Dostępne moduły</div>
                    <div className="col-span-2 text-center">Akcje</div>
                </div>
                <div className="lg:divide-y lg:divide-gray-200 lg:dark:divide-gray-700">
                    {users.map(u => (
                        <div key={u._id} className="bg-white dark:bg-gray-800 rounded-lg shadow lg:shadow-none lg:grid lg:grid-cols-10 lg:gap-4 lg:items-center p-4 lg:p-3">
                            <div className="lg:col-span-2 font-medium">
                                <p>{u.username}</p>
                                <span className={`text-xs font-semibold rounded-full capitalize ${u.status === 'oczekujący' ? 'text-yellow-500' : 'text-green-500'}`}>{u.status}</span>
                            </div>
                            <div className="mt-2 lg:mt-0 lg:col-span-2">
                                <label className="lg:hidden font-bold text-sm">Rola</label>
                                <select value={u.role} onChange={(e) => handleRoleChange(u._id, e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" disabled={user.id === u._id}><option value="user">Użytkownik</option><option value="administrator">Administrator</option></select>
                            </div>
                            <div className="mt-4 lg:mt-0 lg:col-span-4">
                                 <label className="lg:hidden font-bold text-sm mb-2 block">Dostępne moduły</label>
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                    {allModules.map(module => (
                                        <label key={module.id} className="flex items-center text-sm">
                                            <input type="checkbox" className="form-checkbox h-4 w-4 text-indigo-600 rounded" checked={u.visibleModules?.includes(module.id) || false} onChange={(e) => handleModuleChange(u._id, module.id, e.target.checked)} disabled={u.role === 'administrator'}/>
                                            <span className="ml-2">{module.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-4 lg:mt-0 lg:col-span-2 text-right lg:text-center whitespace-nowrap border-t lg:border-0 pt-3 lg:pt-0">
                                {u.status === 'oczekujący' && (<button onClick={() => handleApproveUser(u._id)} className="px-3 py-1 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 mr-2">Akceptuj</button>)}
                                <Tooltip text="Zmień hasło"><button onClick={() => setModalState({ isOpen: true, user: u, type: 'password' })} className="p-2 text-gray-500 hover:text-blue-500"><KeyRound className="w-5 h-5" /></button></Tooltip>
                                {user.id !== u._id && (<Tooltip text="Usuń użytkownika"><button onClick={() => setModalState({ isOpen: true, user: u, type: 'delete' })} className="p-2 text-gray-500 hover:text-red-500"><Trash2 className="w-5 h-5" /></button></Tooltip>)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <Modal isOpen={modalState.isOpen && modalState.type === 'delete'} onClose={() => setModalState({isOpen: false, user: null, type: ''})} title="Potwierdź usunięcie"><p>Czy na pewno chcesz usunąć użytkownika <strong>{modalState.user?.username}</strong>? Tej operacji nie można cofnąć.</p><div className="flex justify-end gap-4 mt-6"><button onClick={() => setModalState({isOpen: false, user: null, type: ''})} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={() => handleDeleteUser(modalState.user._id)} className="px-4 py-2 bg-red-600 text-white rounded-lg">Usuń</button></div></Modal>
            <Modal isOpen={modalState.isOpen && modalState.type === 'password'} onClose={() => setModalState({isOpen: false, user: null, type: ''})} title={`Zmień hasło dla ${modalState.user?.username}`}><div><label className="block mb-2 text-sm font-medium">Nowe hasło</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"/></div><div className="flex justify-end gap-4 mt-6"><button onClick={() => setModalState({isOpen: false, user: null, type: ''})} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button><button onClick={handleChangePassword} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zmień hasło</button></div></Modal>
        </div>
    );
};

export default AdminUsersView;