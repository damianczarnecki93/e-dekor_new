import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';

const AdminEmailConfigView = () => {
    const [config, setConfig] = useState({
        host: '', port: 587, secure: true, user: '', pass: '', recipientEmail: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const data = await api.getEmailConfig();
                if (data) setConfig(prev => ({...prev, ...data}));
            } catch (error) {
                showNotification(error.message, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchConfig();
    }, [showNotification]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setConfig(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { message } = await api.saveEmailConfig(config);
            showNotification(message, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleTestEmail = async () => {
        setIsTesting(true);
        try {
            await api.saveEmailConfig(config);
            const { message } = await api.testEmailConfig();
            showNotification(message, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center">Ładowanie...</div>;

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-2xl font-semibold mb-4">Konfiguracja serwera E-mail (SMTP)</h2>
            <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <div>
                    <label className="block text-sm font-medium">Adres lub adresy e-mail odbiorców (oddzielone przecinkami)</label>
                    <input
                        type="text"
                        name="recipientEmail"
                        value={config.recipientEmail || ''}
                        onChange={handleChange}
                        className="mt-1 w-full p-2 border rounded-md"
                        placeholder="np. adres1@example.com, adres2@example.com"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">Host SMTP</label>
                    <input type="text" name="host" value={config.host || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Port</label>
                    <input type="number" name="port" value={config.port || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Użytkownik (adres e-mail nadawcy)</label>
                    <input type="email" name="user" value={config.user || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" required />
                </div>
                 <div>
                    <label className="block text-sm font-medium">Hasło</label>
                    <input type="password" name="pass" value={config.pass || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Wprowadź, jeśli chcesz zmienić" />
                </div>
                <div className="flex items-center">
                    <input type="checkbox" name="secure" checked={config.secure} onChange={handleChange} className="h-4 w-4 rounded" />
                    <label className="ml-2 text-sm">Używaj SSL/TLS (secure)</label>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t dark:border-gray-700">
                    <button
                        type="button"
                        onClick={handleTestEmail}
                        disabled={isTesting}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                        {isTesting ? 'Wysyłanie...' : 'Testuj wysyłkę'}
                    </button>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Zapisz konfigurację</button>
                </div>
            </form>
        </div>
    );
};

export default AdminEmailConfigView;