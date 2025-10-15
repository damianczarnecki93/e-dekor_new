import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { navConfig } from '../../navConfig';

const Sidebar = ({ user, onNewOrder, isNavOpen, setIsNavOpen }) => {
    const [expandedCategories, setExpandedCategories] = useState(['Główne']);
    const location = useLocation();
    const isDarkMode = document.documentElement.classList.contains('dark');

    const toggleCategory = (category) => {
        setExpandedCategories(prev =>
            prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
        );
    };

    const memoizedNavConfig = useMemo(() => navConfig(onNewOrder), [onNewOrder]);

    const availableNav = useMemo(() => {
        if (!user) return [];
        return memoizedNavConfig.map(category => ({
            ...category,
            items: category.items.filter(item =>
                user.role === 'administrator' ||
                (item.roles.includes(user.role) && (item.alwaysVisible || user.visibleModules?.includes(item.id)))
            )
        })).filter(category => category.items.length > 0);
    }, [user, memoizedNavConfig]);

    return (
        <nav className={`w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col flex-shrink-0 transition-transform duration-300 ease-in-out z-40 fixed lg:static h-full ${isNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
             <div className="flex items-center justify-center h-20 border-b border-gray-200 dark:border-gray-700">
                <img src={isDarkMode ? "/logo-dark.png" : "/logo.png"} alt="Logo" className="h-10" />
            </div>
            <ul className="flex-grow overflow-y-auto">
                {availableNav.map(category => (
                    <div key={category.category} className="my-2">
                        <h3 onClick={() => toggleCategory(category.category)} className="px-6 mt-4 mb-2 text-xs font-semibold text-gray-400 uppercase flex justify-between items-center cursor-pointer">
                            {category.category}
                            {expandedCategories.includes(category.category) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </h3>
                        {expandedCategories.includes(category.category) && category.items.map(item => (
                            <li key={item.id}>
                                <Link to={`/${item.id}`} onClick={() => { if(item.action) item.action(); setIsNavOpen(false); }} className={`w-full flex items-center justify-start h-12 px-6 text-base transition-colors duration-200 text-left ${location.pathname.startsWith(`/${item.id}`) ? 'bg-indigo-50 dark:bg-gray-700 text-indigo-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                    <item.icon className="h-5 w-5" />
                                    <span className="ml-4">{item.label}</span>
                                </Link>
                            </li>
                        ))}
                    </div>
                ))}
            </ul>
        </nav>
    );
};

export default Sidebar;
