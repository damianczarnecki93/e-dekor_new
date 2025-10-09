import React from 'react';
import { Users, Package, Mail } from 'lucide-react';

const AdminView = ({ onNavigate }) => {
    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Panel Administratora</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md cursor-pointer hover:shadow-xl transition-shadow" onClick={() => onNavigate('admin-users')}>
                    <div className="flex items-center">
                        <Users className="w-10 h-10 text-indigo-500 mr-4"/>
                        <div>
                            <h2 className="text-2xl font-semibold">Zarządzanie Użytkownikami</h2>
                            <p className="text-gray-500">Akceptuj, usuwaj i zarządzaj rolami użytkowników.</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md cursor-pointer hover:shadow-xl transition-shadow" onClick={() => onNavigate('admin-products')}>
				<div className="flex items-center">
                        <Package className="w-10 h-10 text-green-500 mr-4"/>
                        <div>
                            <h2 className="text-2xl font-semibold">Zarządzanie Produktami</h2>
                            <p className="text-gray-500">Przeglądaj, importuj i synchronizuj bazę produktów.</p>
                        </div>
                    </div>
				</div>
				<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md cursor-pointer hover:shadow-xl transition-shadow" onClick={() => onNavigate('admin-email')}>
				<div className="flex items-center">
						<Mail className="w-10 h-10 text-orange-500 mr-4"/>
						<div>
							<h2 className="text-2xl font-semibold">Ustawienia E-mail</h2>
							<p className="text-gray-500">Zarządzaj konfiguracją wysyłki powiadomień.</p>
						</div>
					</div>
				</div>
            </div>
        </div>
    );
};

export default AdminView;