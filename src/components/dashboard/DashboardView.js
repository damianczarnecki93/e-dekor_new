import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { navConfig } from '../../navConfig';

const colorClasses = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-900/40', hoverBg: 'hover:bg-blue-200 dark:hover:bg-blue-900/60', text: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'bg-green-100 dark:bg-green-900/40', hoverBg: 'hover:bg-green-200 dark:hover:bg-green-900/60', text: 'text-green-600 dark:text-green-400' },
    yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', hoverBg: 'hover:bg-yellow-200 dark:hover:bg-yellow-900/60', text: 'text-yellow-600 dark:text-yellow-400' },
    red: { bg: 'bg-red-100 dark:bg-red-900/40', hoverBg: 'hover:bg-red-200 dark:hover:bg-red-900/60', text: 'text-red-600 dark:text-red-400' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-900/40', hoverBg: 'hover:bg-purple-200 dark:hover:bg-purple-900/60', text: 'text-purple-600 dark:text-purple-400' },
    pink: { bg: 'bg-pink-100 dark:bg-pink-900/40', hoverBg: 'hover:bg-pink-200 dark:hover:bg-pink-900/60', text: 'text-pink-600 dark:text-pink-400' },
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/40', hoverBg: 'hover:bg-indigo-200 dark:hover:bg-indigo-900/60', text: 'text-indigo-600 dark:text-indigo-400' },
    gray: { bg: 'bg-gray-100 dark:bg-gray-700/40', hoverBg: 'hover:bg-gray-200 dark:hover:bg-gray-700/60', text: 'text-gray-600 dark:text-gray-400' },
};

const DashboardView = ({ user, onNewOrder }) => {
    const navigate = useNavigate();
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleNavigate = (path, action) => {
        if (action) action();
        else navigate(`/${path}`);
    };

    const availableNav = useMemo(() => {
        if (!user) return [];
        const config = navConfig(onNewOrder);
        return config.map(category => ({
            ...category,
            items: category.items.filter(item =>
                item.id !== 'dashboard' &&
                (user.role === 'administrator' || (item.roles.includes(user.role) && (item.alwaysVisible || user.visibleModules?.includes(item.id))))
            )
        })).filter(category => category.items.length > 0);
    }, [user, onNewOrder]);

    return (
        <div className="p-4 md:p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">{currentDateTime.toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h1>
                <p className="text-2xl font-mono">{currentDateTime.toLocaleTimeString('pl-PL')}</p>
            </div>
            <div className="space-y-6">
                {availableNav.map(category => (
                    <div key={category.category}>
                        <h2 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">{category.category}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {category.items.map(item => {
                                const colors = colorClasses[item.color] || colorClasses.gray;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleNavigate(item.id, item.action)}
                                        className={`group bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 flex items-center`}
                                    >
                                        <div className={`rounded-full p-3 transition-colors duration-200 ${colors.bg} ${colors.hoverBg}`}>
                                            <item.icon className={`h-6 w-6 ${colors.text}`} />
                                        </div>
                                        <span className="font-semibold text-md ml-4 text-gray-800 dark:text-gray-200">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DashboardView;
