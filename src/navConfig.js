import { Home, Search, PlusCircle, Archive, List, Wrench, ClipboardList, Plane, Users, Settings, ClipboardCheck } from 'lucide-react';

export const navConfig = (onNewOrder) => [
    {
        category: 'Główne',
        items: [
            { id: 'dashboard', label: 'Panel Główny', icon: Home, roles: ['user', 'administrator'], alwaysVisible: true, color: 'blue' },
            { id: 'search', label: 'Wyszukiwarka', icon: Search, roles: ['user', 'administrator'], color: 'green' },
        ]
    },
    {
        category: 'Sprzedaż',
        items: [
            { id: 'order', label: 'Nowe Zamówienie', icon: PlusCircle, roles: ['user', 'administrator'], action: onNewOrder, color: 'yellow' },
            { id: 'orders', label: 'Zamówienia', icon: Archive, roles: ['user', 'administrator'], color: 'red' },
        ]
    },
    {
        category: 'Magazyn',
        items: [
            { id: 'picking', label: 'Kompletacja', icon: List, roles: ['user', 'administrator'], color: 'purple' },
            { id: 'inventory', label: 'Inwentaryzacja', icon: Wrench, roles: ['user', 'administrator'], color: 'pink' },
        ]
    },
    {
        category: 'Organizacyjne',
        items: [
            { id: 'kanban', label: 'Tablica Zadań', icon: ClipboardList, roles: ['user', 'administrator'], color: 'indigo' },
            { id: 'delegations', label: 'Delegacje', icon: Plane, roles: ['user', 'administrator'], color: 'gray' },
            { id: 'crm', label: 'Kontakty', icon: Users, roles: ['user', 'administrator'], color: 'blue' },
        ]
    },
    {
        category: 'Raporty',
        items: [
            { id: 'shortage-report', label: 'Raport Braków', icon: ClipboardCheck, roles: ['user', 'administrator'], color: 'green' },
        ]
    },
    {
        category: 'Administracja',
        items: [
            { id: 'admin', label: 'Panel Admina', icon: Settings, roles: ['administrator'], color: 'red' },
        ]
    }
];