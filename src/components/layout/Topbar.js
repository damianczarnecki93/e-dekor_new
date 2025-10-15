import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, KeyRound, LogOut, Sun, Moon, ChevronDown } from 'lucide-react';
import Tooltip from '../common/Tooltip';

const Topbar = ({ user, onLogout, onOpenPasswordModal, isDarkMode, toggleTheme }) => {
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
            <div className="flex items-center gap-4">
                <Tooltip text="Zmień motyw">
                    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        {isDarkMode ? <Sun className="h-6 w-6 text-yellow-400" /> : <Moon className="h-6 w-6 text-indigo-500" />}
                    </button>
                </Tooltip>
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
