import React, { useState } from 'react';
import { api } from '../../api';

const LoginView = ({ onLogin, showRegister }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const data = await api.login(username, password);
            onLogin(data);
        } catch (err) {
            setError(err.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <div className="text-center">
                <img src="/logo.png" onError={(e) => { e.currentTarget.src = 'https://placehold.co/150x50/4f46e5/ffffff?text=Logo'; }} alt="Logo" className="mx-auto mb-4 h-12" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Zaloguj się do systemu</h2>
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
                        {isLoading ? 'Logowanie...' : 'Zaloguj się'}
                    </button>
                </div>
            </form>
            <div className="text-center">
                <button onClick={showRegister} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Nie masz konta? Zarejestruj się</button>
            </div>
        </div>
    );
};

export default LoginView;