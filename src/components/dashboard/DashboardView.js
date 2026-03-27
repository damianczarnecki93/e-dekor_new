import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Settings, BarChart2, Zap, ListChecks, Trophy, Crown, StickyNote, Package, List, CheckCircle, PlusCircle, Save, XCircle } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';

const DashboardView = ({ user, onNavigate, onUpdateUser }) => {
    const [stats, setStats] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();
    const [layout, setLayout] = useState(user.dashboardLayout || []);
    const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);

    const fetchDashboardData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [statsData, tasksData] = await Promise.all([
                api.getDashboardStats(),
                api.getKanbanTasks(user.id)
            ]);
            setStats(statsData);
            setTasks(tasksData.filter(t => t.status !== 'done'));
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [user.id, showNotification]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const availableWidgets = useMemo(() => ({
        'stats_products': { name: 'Liczba Produktów', component: (props) => <StatCard {...props} title="Produktów w bazie" value={stats?.productCount} icon={<Package />} /> },
        'stats_pending_orders': { name: 'Zamówienia Oczekujące', component: (props) => <StatCard {...props} title="Zamówień do skompletowania" value={stats?.pendingOrders} icon={<List />} onClick={() => onNavigate('picking')} /> },
        'stats_completed_orders': { name: 'Zamówienia Zrealizowane', component: (props) => <StatCard {...props} title="Zamówień skompletowanych" value={stats?.completedOrders} icon={<CheckCircle />} onClick={() => onNavigate('orders')} /> },
        'sales_goals': { name: 'Cele Sprzedażowe', component: (props) => <SalesGoalsWidget {...props} stats={stats} user={user} onUpdate={fetchDashboardData} /> },
        'quick_actions': { name: 'Szybkie Akcje', component: (props) => <QuickActionsWidget {...props} onNavigate={onNavigate} /> },
        'my_tasks': { name: 'Moje Zadania', component: (props) => <MyTasksWidget {...props} tasks={tasks} onNavigate={onNavigate} /> },
        'top_products': { name: 'Najlepsze Produkty', component: (props) => <TopProductsWidget {...props} stats={stats} /> },
        'top_customers': { name: 'Najlepsi Klienci', component: (props) => <TopCustomersWidget {...props} stats={stats} /> },
        'notes_widget': { name: 'Notatki', component: (props) => <NotesWidget {...props} /> },
    }), [stats, tasks, onNavigate, user, fetchDashboardData]);

    const handleLayoutChange = async (newLayout) => {
        setLayout(newLayout);
        try {
            const { user: updatedUser } = await api.updateUserDashboardLayout(newLayout);
            onUpdateUser(updatedUser);
            showNotification('Układ pulpitu został zapisany.', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const draggedItem = useRef(null);
    const onDragStart = (e, index) => {
        draggedItem.current = index;
        e.dataTransfer.effectAllowed = 'move';
    };
    const onDragOver = (e, index) => {
        e.preventDefault();
        const draggedOverItem = index;
        if (draggedItem.current === draggedOverItem) {
            return;
        }
        const items = [...layout];
        const item = items.splice(draggedItem.current, 1)[0];
        items.splice(draggedOverItem, 0, item);
        draggedItem.current = draggedOverItem;
        setLayout(items);
    };
    const onDragEnd = () => {
        handleLayoutChange(layout);
        draggedItem.current = null;
    };

    if (isLoading) return <div className="text-center p-8">Ładowanie pulpitu...</div>;

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Panel Główny</h1>
                <button onClick={() => setIsCustomizeModalOpen(true)} className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-sm rounded-lg">
                    <Settings className="w-4 h-4 mr-2"/>Dostosuj
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {layout.map((widgetId, index) => {
                    const Widget = availableWidgets[widgetId];
                    if (!Widget) return null;
                    const Component = Widget.component;
                    return (
                        <div
                            key={widgetId}
                            draggable
                            onDragStart={(e) => onDragStart(e, index)}
                            onDragOver={(e) => onDragOver(e, index)}
                            onDragEnd={onDragEnd}
                            className="cursor-move"
                        >
                           <Component />
                        </div>
                    );
                })}
            </div>
            <CustomizeDashboardModal
                isOpen={isCustomizeModalOpen}
                onClose={() => setIsCustomizeModalOpen(false)}
                availableWidgets={availableWidgets}
                currentLayout={layout}
                onSave={handleLayoutChange}
            />
        </div>
    );
};

const StatCard = ({ title, value, icon, onClick }) => (
    <div onClick={onClick} className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex items-center text-left transition-all hover:shadow-xl hover:scale-105 ${onClick ? 'cursor-pointer' : ''}`}>
        <div className="p-4 bg-gray-100 dark:bg-gray-900/30 rounded-full">{React.cloneElement(icon, { className: "h-8 w-8 text-indigo-500" })}</div>
        <div className="ml-4">
            <p className="text-3xl font-bold">{value ?? '...'}</p>
            <p className="text-gray-500 dark:text-gray-400">{title}</p>
        </div>
    </div>
);

const SalesGoalsWidget = ({ stats, user, onUpdate }) => {
    const { showNotification } = useNotification();
    const [goalInput, setGoalInput] = useState(stats?.individualSalesGoal || 0);
    const [manualSaleInput, setManualSaleInput] = useState('');

    useEffect(() => {
        setGoalInput(stats?.individualSalesGoal || 0);
    }, [stats]);

    const handleSetGoal = async (e) => {
        e.preventDefault();
        const goalValue = parseFloat(goalInput);
        if (isNaN(goalValue) || goalValue < 0) {
            showNotification('Wprowadź poprawną wartość celu.', 'error');
            return;
        }
        try {
            await api.setUserGoal(goalValue);
            showNotification('Cel miesięczny został zaktualizowany!', 'success');
            onUpdate();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleAddManualSale = async (e) => {
        e.preventDefault();
        const saleValue = parseFloat(manualSaleInput);
        if (isNaN(saleValue)) {
            showNotification('Wprowadź poprawną wartość sprzedaży.', 'error');
            return;
        }
        try {
            await api.addManualSales(saleValue);
            showNotification('Sprzedaż została dodana!', 'success');
            setManualSaleInput('');
            onUpdate();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const individualGoalProgress = stats?.individualSalesGoal > 0 ? ((stats?.individualMonthlySales || 0) / stats.individualSalesGoal) * 100 : 0;
    const totalGoalProgress = stats?.totalSalesGoal > 0 ? ((stats?.totalMonthlySales || 0) / stats.totalSalesGoal) * 100 : 0;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full flex flex-col justify-between">
            <div>
                <h3 className="font-bold mb-4 flex items-center"><BarChart2 className="w-5 h-5 mr-2 text-indigo-500"/>Cele Sprzedażowe</h3>
                <div className="space-y-4">
                    <div>
                        <h4 className="text-sm font-semibold">Twój cel miesięczny</h4>
                        <div className="flex justify-between mb-1 text-xs">
                            <span>{(stats?.individualMonthlySales || 0).toFixed(2)} / {(stats?.individualSalesGoal || 0).toFixed(2)} PLN</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${Math.min(individualGoalProgress, 100)}%` }}></div>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold">Cel ogólny</h4>
                        <div className="flex justify-between mb-1 text-xs">
                            <span>{(stats?.totalMonthlySales || 0).toFixed(2)} / {(stats?.totalSalesGoal || 0).toFixed(2)} PLN</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${Math.min(totalGoalProgress, 100)}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                <form onSubmit={handleSetGoal} className="flex items-center gap-2">
                    <input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} className="p-2 border rounded-md w-full text-sm bg-gray-50 dark:bg-gray-700" placeholder="Ustaw cel..."/>
                    <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm"><Save size={16}/></button>
                </form>
                <form onSubmit={handleAddManualSale} className="flex items-center gap-2">
                    <input type="number" value={manualSaleInput} onChange={(e) => setManualSaleInput(e.target.value)} className="p-2 border rounded-md w-full text-sm bg-gray-50 dark:bg-gray-700" placeholder="Dodaj sprzedaż..."/>
                    <button type="submit" className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm"><PlusCircle size={16}/></button>
                </form>
            </div>
        </div>
    );
};

const QuickActionsWidget = ({ onNavigate }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full">
        <h3 className="font-bold mb-4 flex items-center"><Zap className="w-5 h-5 mr-2 text-yellow-500"/>Szybkie Akcje</h3>
        <div className="grid grid-cols-2 gap-4">
            <button onClick={() => onNavigate('order')} className="p-3 bg-blue-500 text-white rounded-lg text-sm">Nowe Zamówienie</button>
            <button onClick={() => onNavigate('orders')} className="p-3 bg-red-500 text-white rounded-lg text-sm">Zamówienia</button>
        </div>
    </div>
);

const MyTasksWidget = ({ tasks, onNavigate }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full">
        <h3 className="font-bold mb-4 flex items-center"><ListChecks className="w-5 h-5 mr-2 text-red-500"/>Tablica zadań</h3>
        <div className="space-y-2 text-sm">
            {tasks.length > 0 ? tasks.slice(0, 3).map(task => (
                <p key={task._id} className="truncate">{task.content}</p>
            )) : <p className="text-gray-400">Brak zadań.</p>}
        </div>
        <button onClick={() => onNavigate('kanban')} className="text-sm text-indigo-500 mt-4">Zobacz wszystkie</button>
    </div>
);

const TopProductsWidget = ({ stats }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full">
        <h3 className="font-bold mb-4 flex items-center"><Trophy className="w-5 h-5 mr-2 text-yellow-500"/>Najlepsze Produkty</h3>
        <ul className="space-y-2 text-sm">
            {stats?.topProducts.map(p => <li key={p._id} className="flex justify-between"><span>{p._id}</span><strong>{p.totalSold} szt.</strong></li>)}
        </ul>
    </div>
);

const TopCustomersWidget = ({ stats }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full">
        <h3 className="font-bold mb-4 flex items-center"><Crown className="w-5 h-5 mr-2 text-blue-500"/>Najlepsi Klienci</h3>
        <ul className="space-y-2 text-sm">
            {stats?.topCustomers.map(c => <li key={c._id} className="flex justify-between"><span>{c._id}</span><strong>{c.orderCount} zam.</strong></li>)}
        </ul>
    </div>
);

const CustomizeDashboardModal = ({ isOpen, onClose, availableWidgets, currentLayout, onSave }) => {
    const [layout, setLayout] = useState(currentLayout);

    useEffect(() => {
        setLayout(currentLayout);
    }, [currentLayout, isOpen]);

    const toggleWidget = (widgetId) => {
        setLayout(prev =>
            prev.includes(widgetId) ? prev.filter(id => id !== widgetId) : [...prev, widgetId]
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Dostosuj Pulpit">
            <div className="space-y-4">
                <p className="text-sm text-gray-500">Zaznacz komponenty, które mają być widoczne na Twoim pulpicie.</p>
                {Object.entries(availableWidgets).map(([id, { name }]) => (
                    <label key={id} className="flex items-center">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded"
                            checked={layout.includes(id)}
                            onChange={() => toggleWidget(id)}
                        />
                        <span className="ml-3">{name}</span>
                    </label>
                ))}
            </div>
            <div className="flex justify-end mt-6">
                <button onClick={() => { onSave(layout); onClose(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz</button>
            </div>
        </Modal>
    );
};

const NotesWidget = () => {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const { showNotification } = useNotification();

    useEffect(() => {
        const fetchNotes = async () => {
            try {
                const data = await api.getNotes();
                setNotes(data);
            } catch (error) {
                showNotification(error.message, 'error');
            }
        };
        fetchNotes();
    }, [showNotification]);

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!newNote.trim()) return;
        try {
            const addedNote = await api.addNote({ content: newNote, color: 'yellow' });
            setNotes([...notes, addedNote]);
            setNewNote('');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    const handleDeleteNote = async (id) => {
        try {
            await api.deleteNote(id);
            setNotes(notes.filter(n => n._id !== id));
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-4 flex items-center"><StickyNote className="mr-2 text-yellow-400"/> Notatki</h2>
            <div className="flex-grow space-y-3 overflow-y-auto pr-2">
                {notes.map(note => (
                    <div key={note._id} className="bg-yellow-100 dark:bg-yellow-900/40 p-3 rounded-md shadow-sm relative group">
                        <p className="text-yellow-800 dark:text-yellow-200">{note.content}</p>
                        <button onClick={() => handleDeleteNote(note._id)} className="absolute top-1 right-1 p-1 text-yellow-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <XCircle className="w-4 h-4"/>
                        </button>
                    </div>
                ))}
            </div>
            <form onSubmit={handleAddNote} className="mt-4 flex gap-2">
                <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Nowa notatka..." className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700"/>
                <button type="submit" className="p-2 bg-yellow-400 text-yellow-900 rounded-md hover:bg-yellow-500"><PlusCircle/></button>
            </form>
        </div>
    );
};

export default DashboardView;