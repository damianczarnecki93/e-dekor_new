import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';

const ContactFormModal = ({ isOpen, onClose, onSave, contact }) => {
    const [formData, setFormData] = useState({});
    const [users, setUsers] = useState([]);
    const { showNotification } = useNotification();

    useEffect(() => {
        if (isOpen) {
            const fetchUsers = async () => {
                try {
                    const userList = await api.getUsersList();
                    setUsers(userList);
                } catch (error) {
                    showNotification('Nie udało się wczytać listy użytkowników', 'error');
                }
            };
            fetchUsers();

            if (contact) {
                setFormData(contact);
            } else {
                setFormData({ name: '', company: '', email: '', phone: '', address: '', status: 'Lead', notes: '', accountManager: '' });
            }
        }
    }, [contact, isOpen, showNotification]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={contact ? "Edytuj Kontakt" : "Nowy Kontakt"} maxWidth="2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Imię i nazwisko / Nazwa *" required className="p-2 border rounded-md"/>
                    <input name="company" value={formData.company || ''} onChange={handleChange} placeholder="Firma" className="p-2 border rounded-md"/>
                    <input name="email" value={formData.email || ''} onChange={handleChange} placeholder="Email" type="email" className="p-2 border rounded-md"/>
                    <input name="phone" value={formData.phone || ''} onChange={handleChange} placeholder="Telefon" className="p-2 border rounded-md"/>
                </div>
                <input name="address" value={formData.address || ''} onChange={handleChange} placeholder="Adres" className="w-full p-2 border rounded-md"/>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select name="status" value={formData.status || 'Lead'} onChange={handleChange} className="w-full p-2 border rounded-md">
                        <option>Lead</option>
                        <option>Klient</option>
                        <option>Utracony</option>
                        <option>Partner</option>
                    </select>
                    <select name="accountManager" value={formData.accountManager || ''} onChange={handleChange} className="w-full p-2 border rounded-md">
                        <option value="">-- Brak opiekuna --</option>
                        {users.map(user => (
                            <option key={user._id} value={user.username}>{user.username}</option>
                        ))}
                    </select>
                </div>
                <textarea name="notes" value={formData.notes || ''} onChange={handleChange} placeholder="Notatki..." className="w-full p-2 border rounded-md min-h-[100px]"/>
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Anuluj</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz</button>
                </div>
            </form>
        </Modal>
    );
};

export default ContactFormModal;