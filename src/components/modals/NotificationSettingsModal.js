import React, { useState, useEffect } from 'react';
import Modal from './Modal';
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

    useEffect(() => {
        if (isOpen) {
            const checkSubscriptionAndFetchPreferences = async () => {
                setLoading(true);
                try {
                    const registration = await navigator.serviceWorker.ready;
                    const existingSubscription = await registration.pushManager.getSubscription();
                    setIsSubscribed(!!existingSubscription);

                    const fetchedPreferences = await api.getNotificationPreferences();
                    setPreferences(fetchedPreferences);
                } catch (error) {
                    console.error("Błąd podczas sprawdzania subskrypcji lub pobierania preferencji:", error);
                } finally {
                    setLoading(false);
                }
            };
            checkSubscriptionAndFetchPreferences();
        }
    }, [isOpen]);

    const handleSubscribe = async () => {
        if (isSubscribed) {
            // Anuluj subskrypcję
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    await api.unsubscribeFromPush(subscription.endpoint);
                    await subscription.unsubscribe();
                    console.log("Subskrypcja anulowana.");
                    setIsSubscribed(false);
                }
            } catch (error) {
                console.error("Błąd podczas anulowania subskrypcji:", error);
            }
        } else {
            // Zasubskrybuj
            try {
                await subscribeUser();
                setIsSubscribed(true);
                console.log("Subskrypcja pomyślna.");
            } catch (error) {
                console.error("Błąd podczas subskrypcji:", error);
            }
        }
    };

    const handlePreferenceChange = (e) => {
        setPreferences({
            ...preferences,
            [e.target.name]: e.target.checked,
        });
    };

    const handleSave = async () => {
        try {
            await api.updateNotificationPreferences(preferences);
            console.log("Preferencje zapisane.");
            onClose();
        } catch (error) {
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

                    {isSubscribed && (
                        <div>
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

                    <div className="mt-6 flex justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Anuluj</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded-md">Zapisz</button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default NotificationSettingsModal;
