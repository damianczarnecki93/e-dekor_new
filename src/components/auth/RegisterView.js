import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';

const RegisterView = ({ showLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { showNotification } = useNotification();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password.length < 6) {
            setError('Hasło musi mieć co najmniej 6 znaków.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const data = await api.register(username, password);
            showNotification(data.message, 'success');
            showLogin();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <div className="text-center">
                <UserPlus className="mx-auto h-12 w-12 text-indigo-500" />
                <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Stwórz nowe konto</h2>
            </div>
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Nazwa użytkownika</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Hasło</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                <div>
                    <button type="submit" disabled={isLoading} className="w-full px-4 py-3 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400">
                        {isLoading ? 'Rejestracja...' : 'Zarejestruj się'}
                    </button>
                </div>
            </form>
            <div className="text-center">
                <button onClick={showLogin} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Masz już konto? Zaloguj się</button>
            </div>
        </div>
    );
};

export default RegisterView;