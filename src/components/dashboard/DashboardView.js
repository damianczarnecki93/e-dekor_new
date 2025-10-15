import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { navConfig } from '../../navConfig';

const DashboardView = ({ user, onNewOrder }) => {
    const navigate = useNavigate();

    const handleNavigate = (path, action) => {
        if (action) {
            action();
        } else {
            navigate(`/${path}`);
        }
    };

    const availableNav = useMemo(() => {
        if (!user) return [];
        const config = navConfig(onNewOrder);
        return config.map(category => ({
            ...category,
            items: category.items.filter(item =>
                item.id !== 'dashboard' &&
                (user.role === 'administrator' ||
                    (item.roles.includes(user.role) && (item.alwaysVisible || user.visibleModules?.includes(item.id))))
            )
        })).filter(category => category.items.length > 0);
    }, [user, onNewOrder]);

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Panel Główny</h1>
            <div className="space-y-8">
                {availableNav.map(category => (
                    <div key={category.category}>
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">{category.category}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {category.items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavigate(item.id, item.action)}
                                    className="group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 flex flex-col items-center justify-center text-center"
                                >
                                    <div className="bg-indigo-100 dark:bg-indigo-900/40 rounded-full p-4 transition-colors duration-300 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/60">
                                        <item.icon className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <span className="font-semibold text-sm mt-3 text-gray-700 dark:text-gray-200">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DashboardView;
