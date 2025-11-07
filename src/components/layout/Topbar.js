import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, KeyRound, LogOut, Sun, Moon, ChevronDown, RefreshCw, CheckCircle, XCircle, AlertTriangle, Bell } from 'lucide-react';

const SyncStatusIndicator = ({ progress, onForceSync }) => {
    if (!progress || progress.status === 'idle') return null;

    const getStatusInfo = () => {
        switch (progress.status) {
            case 'starting_all':
                return { text: 'Rozpoczynam synchronizację...', icon: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />, color: 'text-blue-500' };
            case 'fetching_count':
                return { text: `Pobieram listę: ${progress.table}...`, icon: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />, color: 'text-blue-500' };
            case 'downloading':
                const percentage = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
                return { text: `Pobieram ${progress.table}: ${percentage}%`, icon: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />, color: 'text-blue-500' };
            case 'completed':
                return { text: `Tabela ${progress.table} gotowa`, icon: <CheckCircle className="w-4 h-4 text-green-500" />, color: 'text-green-500' };
            case 'finished_all':
                return { text: 'Wszystkie dane aktualne', icon: <CheckCircle className="w-4 h-4 text-green-500" />, color: 'text-green-500' };
            case 'failed':
                return { text: 'Błąd synchronizacji!', icon: <XCircle className="w-4 h-4 text-red-500" />, color: 'text-red-500' };
            case 'required':
                return { text: 'Wymagana synchronizacja', icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />, color: 'text-yellow-500' };
            default:
                return null;
        }
    };

    const info = getStatusInfo();
    if (!info) return null;

    const isSyncing = ['starting_all', 'fetching_count', 'downloading'].includes(progress.status);

    return (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300" title={info.text}>
            {info.icon}
            <span className="hidden md:inline">{info.text}</span>
            {(progress.status === 'failed' || progress.status === 'required') && (
                 <button onClick={onForceSync} disabled={isSyncing} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
            )}
        </div>
    );
};


const Topbar = ({ user, onLogout, onOpenPasswordModal, onOpenNotificationSettings, isDarkMode, toggleTheme, syncProgress, onForceSync }) => {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);

    return (
        <div className="bg-white dark:bg-gray-800 shadow-md p-2 flex justify-between items-center sticky top-0 z-30">
            <div className="flex items-center gap-2">
                <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <Home className="w-6 h-6" />
                </button>
                <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
            </div>
            <div className="flex-1 flex justify-center">
                <SyncStatusIndicator progress={syncProgress} onForceSync={onForceSync} />
            </div>
            <div className="flex items-center gap-4">
                <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    {isDarkMode ? <Sun className="h-6 w-6 text-yellow-400" /> : <Moon className="h-6 w-6 text-indigo-500" />}
                </button>
                <div className="relative" ref={menuRef}>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                        <div className="text-right">
                            <p className="font-semibold text-sm">{user.username}</p>
                            <p className="text-xs text-gray-500">{user.role}</p>
                        </div>
                        <ChevronDown className={`w-5 h-5 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50">
                            <button onClick={() => { onOpenPasswordModal(); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center">
                                <KeyRound className="w-4 h-4 mr-2" /> Zmień hasło
                            </button>
                            <button onClick={() => { onOpenNotificationSettings(); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center">
                                <Bell className="w-4 h-4 mr-2" /> Powiadomienia
                            </button>
                            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                            <button onClick={() => { onForceSync(); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center">
                                <RefreshCw className="w-4 h-4 mr-2" /> Odśwież dane
                            </button>
                            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                            <button onClick={() => { onLogout(); setIsMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center">
                                <LogOut className="w-4 h-4 mr-2" /> Wyloguj
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Topbar;