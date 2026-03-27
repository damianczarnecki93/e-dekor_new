import React, { useState } from 'react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';

const UserChangePasswordModal = ({ isOpen, onClose }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const { showNotification } = useNotification();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (newPassword.length < 6) {
            setError('Nowe hasło musi mieć co najmniej 6 znaków.');
            return;
        }
        try {
            await api.userChangeOwnPassword(currentPassword, newPassword);
            showNotification('Hasło zostało zmienione pomyślnie!', 'success');
            onClose();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Zmień swoje hasło">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block mb-2 text-sm font-medium">Aktualne hasło</label>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                        required
                    />
                </div>
                <div>
                    <label className="block mb-2 text-sm font-medium">Nowe hasło</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                        required
                    />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zmień hasło</button>
                </div>
            </form>
        </Modal>
    );
};

export default UserChangePasswordModal;