import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../api';
import { subscribeUser } from '../../pushNotifications';
import { Bell, Loader2 } from 'lucide-react';

const NotificationSettingsModal = ({ isOpen, onClose }) => {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [preferences, setPreferences] = useState({
        newOrder: true,
        orderCompleted: true,
        newDelegation: true,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState('');

    useEffect(() => {
        if (isOpen) {
            setError(null);
            setSaveStatus('');
            let isMounted = true;
            const loadSettings = async () => {
                if (!isMounted) return;
                setLoading(true);

                // Zawsze pobieraj preferencje
                try {
                    const fetchedPreferences = await api.getNotificationPreferences();
                    if (isMounted) setPreferences(fetchedPreferences);
                } catch (error) {
                    console.error("Błąd podczas pobierania preferencji:", error);
                }

                // Sprawdź status subskrypcji z timeoutem, aby uniknąć zawieszenia
                if ('serviceWorker' in navigator) {
                    try {
                        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker timeout')), 7000));
                        const registration = await Promise.race([navigator.serviceWorker.ready, timeout]);
                        const subscription = await registration.pushManager.getSubscription();
                        if (isMounted) setIsSubscribed(!!subscription);
                    } catch (error) {
                        console.error("Nie można zweryfikować subskrypcji push:", error.message);
                        if (isMounted) setIsSubscribed(false);
                    }
                } else {
                    if (isMounted) setIsSubscribed(false);
                }

                if (isMounted) setLoading(false);
            };

            loadSettings();
            return () => { isMounted = false; };
        }
    }, [isOpen]);

    const handleSubscribe = async () => {
        setError(null);
        try {
            if (isSubscribed) {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    await api.unsubscribeFromPush(subscription.endpoint);
                    await subscription.unsubscribe();
                    setIsSubscribed(false);
                }
            } else {
                 const subscribePromise = subscribeUser();
                 const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Operacja subskrypcji przekroczyła limit czasu.')), 7000)
                 );
                await Promise.race([subscribePromise, timeoutPromise]);
                setIsSubscribed(true);
            }
        } catch (err) {
            console.error("Operacja subskrypcji nie powiodła się:", err);
            setError(err.message || 'Nieznany błąd. Sprawdź konsolę przeglądarki.');
        }
    };

    const handlePreferenceChange = (e) => {
        setPreferences({
            ...preferences,
            [e.target.name]: e.target.checked,
        });
    };

    const handleSave = async () => {
        setSaveStatus('saving');
        try {
            await api.updateNotificationPreferences(preferences);
            setSaveStatus('success');
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (error) {
            setSaveStatus('error');
            console.error("Błąd podczas zapisywania preferencji:", error);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ustawienia Powiadomień">
            {loading ? (
                <div className="flex justify-center items-center p-8">
                    <Loader2 className="animate-spin h-8 w-8" />
                </div>
            ) : (
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center">
                            <Bell className="w-6 h-6 mr-3 text-blue-500" />
                            <p className="font-semibold">Włącz powiadomienia Push</p>
                        </div>
                        <button
                            onClick={handleSubscribe}
                            className={`px-4 py-2 rounded-md font-semibold text-white ${isSubscribed ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                        >
                            {isSubscribed ? 'Anuluj subskrypcję' : 'Zasubskrybuj'}
                        </button>
                    </div>

                    {error && (
                        <div className="mt-2 text-sm text-red-600 dark:text-red-400 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <strong>Błąd:</strong> {error}
                        </div>
                    )}

                    {isSubscribed && (
                        <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-2">Otrzymuj powiadomienia o:</h3>
                            <div className="space-y-2">
                                <label className="flex items-center">
                                    <input type="checkbox" name="newOrder" checked={preferences.newOrder} onChange={handlePreferenceChange} className="form-checkbox h-5 w-5" />
                                    <span className="ml-2">Nowych zamówieniach</span>
                                </label>
                                <label className="flex items-center">
                                    <input type="checkbox" name="orderCompleted" checked={preferences.orderCompleted} onChange={handlePreferenceChange} className="form-checkbox h-5 w-5" />
                                    <span className="ml-2">Zakończonych zamówieniach</span>
                                </label>
                                <label className="flex items-center">
                                    <input type="checkbox" name="newDelegation" checked={preferences.newDelegation} onChange={handlePreferenceChange} className="form-checkbox h-5 w-5" />
                                    <span className="ml-2">Nowych delegacjach</span>
                                </label>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex justify-end items-center gap-2">
                        {saveStatus === 'success' && <span className="text-sm text-green-500">Zapisano pomyślnie!</span>}
                        {saveStatus === 'error' && <span className="text-sm text-red-500">Błąd zapisu.</span>}
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Anuluj</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded-md" disabled={saveStatus === 'saving'}>
                            {saveStatus === 'saving' ? 'Zapisywanie...' : 'Zapisz'}
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default NotificationSettingsModal;
