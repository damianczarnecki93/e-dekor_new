import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { navConfig } from '../../navConfig';

const DashboardView = ({ user }) => {
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
        const config = navConfig(() => handleNavigate('order', () => { }));
        return config.map(category => ({
            ...category,
            items: category.items.filter(item =>
                item.id !== 'dashboard' &&
                (user.role === 'administrator' ||
                    (item.roles.includes(user.role) && (item.alwaysVisible || user.visibleModules?.includes(item.id))))
            )
        })).filter(category => category.items.length > 0);
    }, [user]);

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Panel Główny</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {availableNav.flatMap(category =>
                    category.items.map(item => (
                        <button
                            key={item.id}
                            onClick={() => handleNavigate(item.id, item.action)}
                            className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex flex-col items-center justify-center text-center transition-all hover:shadow-xl hover:scale-105"
                        >
                            <item.icon className="h-12 w-12 text-indigo-500 mb-2" />
                            <span className="font-semibold text-sm">{item.label}</span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};

export default DashboardView;