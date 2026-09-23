import { Home, Search, PlusCircle, Archive, List, Wrench, ClipboardList, Plane, Users, Settings, ClipboardCheck, Printer } from 'lucide-react';

export const navConfig = (onNewOrder) => [
    {
        category: 'Główne',
        items: [
            { id: 'dashboard', label: 'Panel Główny', icon: Home, roles: ['user', 'administrator'], alwaysVisible: true, color: 'bg-blue-200' },
            { id: 'search', label: 'Wyszukiwarka', icon: Search, roles: ['user', 'administrator'], color: 'bg-green-200' },
        ]
    },
    {
        category: 'Sprzedaż',
        items: [
            { id: 'order', label: 'Nowe Zamówienie', icon: PlusCircle, roles: ['user', 'administrator'], action: onNewOrder, color: 'bg-yellow-200' },
            { id: 'orders', label: 'Zamówienia', icon: Archive, roles: ['user', 'administrator'], color: 'bg-red-200' },
        ]
    },
    {
        category: 'Magazyn',
        items: [
            { id: 'picking', label: 'Kompletacja', icon: List, roles: ['user', 'administrator'], color: 'bg-purple-200' },
            { id: 'inventory', label: 'Inwentaryzacja', icon: Wrench, roles: ['user', 'administrator'], color: 'bg-pink-200' },
            { id: 'labels', label: 'Etykiety', icon: Printer, roles: ['user', 'administrator'], color: 'bg-orange-200' },
        ]
    },
    {
        category: 'Organizacyjne',
        items: [
            { id: 'kanban', label: 'Tablica Zadań', icon: ClipboardList, roles: ['user', 'administrator'], color: 'bg-indigo-200' },
            { id: 'delegations', label: 'Delegacje', icon: Plane, roles: ['user', 'administrator'], color: 'bg-gray-200' },
            { id: 'crm', label: 'Kontakty', icon: Users, roles: ['user', 'administrator'], color: 'bg-blue-200' },
        ]
    },
    {
        category: 'Raporty',
        items: [
            { id: 'shortage-report', label: 'Raport Braków', icon: ClipboardCheck, roles: ['user', 'administrator'], color: 'bg-green-200' },
        ]
    },
    {
        category: 'Administracja',
        items: [
            { id: 'admin', label: 'Panel Admina', icon: Settings, roles: ['administrator'], color: 'bg-red-200' },
        ]
    }
];