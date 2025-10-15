import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { navConfig } from '../../navConfig';

const DashboardView = ({ user, onNewOrder }) => {
    const navigate = useNavigate();

    const handleNavigate = (path, action) => {
        if (action) action();
        else navigate(`/${path}`);
    };

    const availableNavItems = useMemo(() => {
        if (!user) return [];
        const config = navConfig(onNewOrder);
        return config.flatMap(category =>
            category.items.filter(item =>
                item.id !== 'dashboard' &&
                (user.role === 'administrator' || (item.roles.includes(user.role) && (item.alwaysVisible || user.visibleModules?.includes(item.id))))
            )
        );
    }, [user, onNewOrder]);

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 h-full gap-0">
            {availableNavItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id, item.action)}
                    className={`flex flex-col items-center justify-center text-center p-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white ${item.color} text-gray-800 font-semibold aspect-square rounded-none`}
                >
                    <item.icon className="h-12 w-12 mb-2" />
                    <span>{item.label}</span>
                </button>
            ))}
        </div>
    );
};

export default DashboardView;
