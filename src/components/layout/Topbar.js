import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, KeyRound, LogOut, Sun, Moon, Menu } from 'lucide-react';
import Tooltip from '../common/Tooltip';

const Topbar = ({ user, onLogout, onOpenPasswordModal, isDarkMode, toggleTheme, setIsNavOpen }) => {
    const navigate = useNavigate();

    return (
        <div className="bg-white dark:bg-gray-800 shadow-md p-2 flex justify-between items-center sticky top-0 z-30">
            <div className="flex items-center gap-2">
                <button onClick={() => setIsNavOpen(true)} className="p-2 rounded-md lg:hidden">
                    <Menu className="w-6 h-6" />
                </button>
                <Tooltip text="Panel Główny">
                    <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <Home className="w-6 h-6" />
                    </button>
                </Tooltip>
                <Tooltip text="Cofnij">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                </Tooltip>
            </div>
            <div className="flex items-center gap-2">
                <div className="text-right">
                    <p className="font-semibold text-sm">{user.username}</p>
                    <p className="text-xs text-gray-500">{user.role}</p>
                </div>
                <Tooltip text="Zmień hasło">
                    <button onClick={onOpenPasswordModal} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <KeyRound className="h-6 w-6 text-gray-500" />
                    </button>
                </Tooltip>
                <Tooltip text="Wyloguj">
                    <button onClick={onLogout} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <LogOut className="h-6 w-6 text-gray-500" />
                    </button>
                </Tooltip>
                <Tooltip text="Zmień motyw">
                    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        {isDarkMode ? <Sun className="h-6 w-6 text-yellow-400" /> : <Moon className="h-6 w-6 text-indigo-500" />}
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};

export default Topbar;
