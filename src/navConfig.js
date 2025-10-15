import { Home, Search, PlusCircle, Archive, List, Wrench, ClipboardList, Plane, Users, Settings, ClipboardCheck } from 'lucide-react';

export const navConfig = (onNewOrder) => [
    {
        category: 'Główne',
        items: [
            { id: 'dashboard', label: 'Panel Główny', icon: Home, roles: ['user', 'administrator'], alwaysVisible: true },
            { id: 'search', label: 'Wyszukiwarka', icon: Search, roles: ['user', 'administrator'] },
        ]
    },
    {
        category: 'Sprzedaż',
        items: [
            { id: 'order', label: 'Nowe Zamówienie', icon: PlusCircle, roles: ['user', 'administrator'], action: onNewOrder },
            { id: 'orders', label: 'Zamówienia', icon: Archive, roles: ['user', 'administrator'] },
        ]
    },
    {
        category: 'Magazyn',
        items: [
            { id: 'picking', label: 'Kompletacja', icon: List, roles: ['user', 'administrator'] },
            { id: 'inventory', label: 'Inwentaryzacja', icon: Wrench, roles: ['user', 'administrator'] },
        ]
    },
    {
        category: 'Organizacyjne',
        items: [
            { id: 'kanban', label: 'Tablica Zadań', icon: ClipboardList, roles: ['user', 'administrator'] },
            { id: 'delegations', label: 'Delegacje', icon: Plane, roles: ['user', 'administrator'] },
            { id: 'crm', label: 'Kontakty', icon: Users, roles: ['user', 'administrator'] },
        ]
    },
    {
        category: 'Raporty',
        items: [
            { id: 'shortage-report', label: 'Raport Braków', icon: ClipboardCheck, roles: ['user', 'administrator'] },
        ]
    },
    {
        category: 'Administracja',
        items: [
            { id: 'admin', label: 'Panel Admina', icon: Settings, roles: ['administrator'] },
        ]
    }
];