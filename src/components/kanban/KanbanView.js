import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { PlusCircle, Edit, Trash2, Calendar, Clock, CheckCircle2, User as UserIcon } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';
import Tooltip from '../common/Tooltip';

const TaskModal = ({ isOpen, onClose, onSave, task, users, currentUser, initialStatus = 'todo' }) => {
    const [formData, setFormData] = useState({
        content: '', details: '', subtasks: [], priority: 'Normalny', deadline: '', assignedToId: '', status: 'todo'
    });
    const [newSubtask, setNewSubtask] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (task) {
                setFormData({
                    content: task.content || '',
                    details: task.details || '',
                    subtasks: task.subtasks || [],
                    priority: task.priority || 'Normalny',
                    deadline: task.deadline ? format(parseISO(task.deadline), "yyyy-MM-dd'T'HH:mm") : '',
                    assignedToId: task.assignedToId?._id || task.assignedToId || currentUser.id,
                    status: task.status || 'todo'
                });
            } else {
                setFormData({
                    content: '', details: '', subtasks: [], priority: 'Normalny', deadline: '', assignedToId: currentUser.id, status: initialStatus
                });
            }
        }
    }, [task, isOpen, currentUser.id, initialStatus]);

    const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleAddSubtask = () => {
        if (newSubtask.trim()) {
            setFormData(prev => ({ ...prev, subtasks: [...prev.subtasks, { content: newSubtask, isDone: false }] }));
            setNewSubtask('');
        }
    };

    const handleRemoveSubtask = index => {
        setFormData(prev => ({ ...prev, subtasks: prev.subtasks.filter((_, i) => i !== index) }));
    };

    const handleToggleSubtask = index => {
        setFormData(prev => {
            const newSubtasks = [...prev.subtasks];
            newSubtasks[index].isDone = !newSubtasks[index].isDone;
            return { ...prev, subtasks: newSubtasks };
        });
    };

    const handleSubmit = e => {
        e.preventDefault();
        onSave({ ...formData, _id: task?._id });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={task ? 'Edytuj zadanie' : 'Nowe zadanie'} maxWidth="2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold mb-1">Zadanie *</label>
                    <input type="text" name="content" value={formData.content} onChange={handleChange} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" required placeholder="Co jest do zrobienia?" />
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Szczegóły</label>
                    <textarea name="details" value={formData.details} onChange={handleChange} className="w-full p-2 border rounded-md min-h-[100px] dark:bg-gray-700 dark:border-gray-600" placeholder="Dodaj opcjonalny opis..."/>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-semibold mb-1">Priorytet</label>
                        <select name="priority" value={formData.priority} onChange={handleChange} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                            <option value="Niski">Niski</option>
                            <option value="Normalny">Normalny</option>
                            <option value="Wysoki">Wysoki</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Status</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                            <option value="todo">Do zrobienia</option>
                            <option value="today">Na dziś</option>
                            <option value="inprogress">W trakcie</option>
                            <option value="done">Gotowe</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Termin</label>
                        <input type="datetime-local" name="deadline" value={formData.deadline} onChange={handleChange} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Przypisz do</label>
                    <select name="assignedToId" value={formData.assignedToId} onChange={handleChange} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                        {users.map(u => <option key={u._id} value={u._id}>{u.username}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold mb-1">Podpunkty</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
                        {formData.subtasks.map((st, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <input type="checkbox" checked={st.isDone} onChange={() => handleToggleSubtask(i)} className="h-4 w-4 rounded text-blue-600" />
                                <span className={`flex-grow text-sm ${st.isDone ? 'line-through text-gray-500' : ''}`}>{st.content}</span>
                                <button type="button" onClick={() => handleRemoveSubtask(i)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input type="text" value={newSubtask} onChange={e => setNewSubtask(e.target.value)} placeholder="Dodaj nowy podpunkt..." className="flex-grow p-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600" onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} />
                        <button type="button" onClick={handleAddSubtask} className="px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md text-sm">Dodaj</button>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Anuluj</button>
                    <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Zapisz zadanie</button>
                </div>
            </form>
        </Modal>
    );
};

const TaskCard = ({ task, isExpanded, onToggleExpand, onEdit, onDelete, onUpdateTask }) => {
    const isOverdue = task.deadline && isPast(parseISO(task.deadline)) && task.status !== 'done';
    const priorityColors = { 'Wysoki': 'bg-red-500', 'Normalny': 'bg-yellow-500', 'Niski': 'bg-green-500' };

    const completedSubtasks = task.subtasks?.filter(st => st.isDone).length || 0;
    const totalSubtasks = task.subtasks?.length || 0;

    const handleSubtaskToggle = (e, index) => {
        e.stopPropagation();
        const newSubtasks = [...task.subtasks];
        newSubtasks[index].isDone = !newSubtasks[index].isDone;
        onUpdateTask(task._id, { subtasks: newSubtasks });
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    return (
        <div onClick={onToggleExpand} className="group relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer overflow-hidden mb-3">
            <div className={`h-1.5 w-full ${priorityColors[task.priority] || 'bg-gray-300'}`} />
            <div className="p-3">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-sm leading-tight flex-grow pr-2">{task.content}</h3>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 text-gray-400 hover:text-blue-500"><Edit size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                    {task.deadline && (
                        <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-bold' : ''}`}>
                            <Clock size={12} />
                            {format(parseISO(task.deadline), 'dd.MM HH:mm')}
                        </div>
                    )}

                    {totalSubtasks > 0 && (
                        <div className={`flex items-center gap-1 ${completedSubtasks === totalSubtasks ? 'text-green-500 font-bold' : ''}`}>
                            <CheckCircle2 size={12} />
                            {completedSubtasks}/{totalSubtasks}
                        </div>
                    )}

                    <div className="flex-grow" />

                    <Tooltip text={task.assignedTo || 'Nieprzypisane'}>
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-bold text-[10px] border border-white dark:border-gray-700">
                            {getInitials(task.assignedTo)}
                        </div>
                    </Tooltip>
                </div>

                {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                        {task.details && <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{task.details}</p>}
                        {totalSubtasks > 0 && (
                            <div className="space-y-1.5 mt-2">
                                {task.subtasks.map((subtask, index) => (
                                    <label key={index} className="flex items-center gap-2 cursor-pointer text-xs group/sub">
                                        <input type="checkbox" checked={subtask.isDone} onChange={(e) => handleSubtaskToggle(e, index)} className="h-3.5 w-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                                        <span className={subtask.isDone ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}>{subtask.content}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const KanbanColumn = ({ status, title, tasks, expandedTasks, onToggleExpand, onEditTask, onDeleteTask, onUpdateTask, onAddTask }) => (
    <div className="flex flex-col h-full min-w-[280px] bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">{title}</h2>
                <span className="px-2 py-0.5 text-[10px] bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500">{tasks.length}</span>
            </div>
            <button onClick={() => onAddTask(status)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors">
                <PlusCircle size={18} />
            </button>
        </div>

        <Droppable droppableId={status}>
            {(provided, snapshot) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className={`flex-1 overflow-y-auto p-3 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    {tasks.map((task, index) => (
                        <Draggable key={task._id} draggableId={task._id} index={index}>
                            {(provided) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                    <TaskCard
                                        task={task}
                                        isExpanded={expandedTasks.has(task._id)}
                                        onToggleExpand={() => onToggleExpand(task._id)}
                                        onEdit={() => onEditTask(task)}
                                        onDelete={() => onDeleteTask(task._id)}
                                        onUpdateTask={onUpdateTask}
                                    />
                                </div>
                            )}
                        </Draggable>
                    ))}
                    {provided.placeholder}
                </div>
            )}
        </Droppable>
    </div>
);

const KanbanView = ({ user }) => {
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(user.id);
    const [isLoading, setIsLoading] = useState(true);
    const [modalState, setModalState] = useState({ isOpen: false, task: null, initialStatus: 'todo' });
    const { showNotification } = useNotification();
    const [expandedTasks, setExpandedTasks] = useState(new Set());

    const fetchUsers = useCallback(async () => {
        try {
            const userList = await api.getUsersList();
            setUsers(userList);
        } catch (error) { showNotification(error.message, 'error'); }
    }, [showNotification]);

    const fetchTasks = useCallback(async () => {
        setIsLoading(true);
        try {
            const userIdToFetch = user.role === 'administrator' ? selectedUserId : user.id;
            const data = await api.getKanbanTasks(userIdToFetch);
            setTasks(data);
        } catch (error) { showNotification(error.message, 'error'); }
        finally { setIsLoading(false); }
    }, [user.role, user.id, selectedUserId, showNotification]);

    useEffect(() => { fetchUsers(); fetchTasks(); }, [fetchUsers, fetchTasks]);

    const columns = useMemo(() => [
        { id: 'todo', title: 'Do zrobienia', tasks: tasks.filter(t => t.status === 'todo') },
        { id: 'today', title: 'Na dziś', tasks: tasks.filter(t => t.status === 'today') },
        { id: 'inprogress', title: 'W trakcie', tasks: tasks.filter(t => t.status === 'inprogress') },
        { id: 'done', title: 'Gotowe', tasks: tasks.filter(t => t.status === 'done') },
    ], [tasks]);

    const handleDragEnd = async (result) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        // Optimistic UI update
        const updatedTasks = Array.from(tasks);
        const taskIndex = updatedTasks.findIndex(t => t._id === draggableId);
        const task = { ...updatedTasks[taskIndex], status: destination.droppableId };

        updatedTasks.splice(taskIndex, 1);

        // Find insertion point in the target column
        const targetColumnTasks = updatedTasks.filter(t => t.status === destination.droppableId);
        const globalInsertIndex = updatedTasks.indexOf(targetColumnTasks[destination.index]);

        if (globalInsertIndex === -1) {
            updatedTasks.push(task);
        } else {
            updatedTasks.splice(globalInsertIndex, 0, task);
        }

        setTasks(updatedTasks);

        try {
            await api.updateKanbanTask(draggableId, {
                status: destination.droppableId,
                order: destination.index
            });
        } catch (error) {
            showNotification(error.message, 'error');
            fetchTasks();
        }
    };

    const handleSaveTask = async (taskData) => {
        try {
            const promise = taskData._id ? api.updateKanbanTask(taskData._id, taskData) : api.addKanbanTask(taskData);
            await promise;
            showNotification('Zadanie zapisane!', 'success');
            fetchTasks();
        } catch (error) { showNotification(error.message, 'error'); }
    };

    const handleDeleteTask = async (taskId) => {
        if (window.confirm("Czy na pewno chcesz usunąć to zadanie?")) {
            try {
                setTasks(prev => prev.filter(t => t._id !== taskId));
                await api.deleteKanbanTask(taskId);
                showNotification('Zadanie usunięte', 'success');
            } catch (error) { showNotification(error.message, 'error'); fetchTasks(); }
        }
    };

    const handleUpdateTask = async (taskId, updateData) => {
        try {
            setTasks(prev => prev.map(t => t._id === taskId ? {...t, ...updateData} : t));
            await api.updateKanbanTask(taskId, updateData);
        } catch (error) { showNotification('Błąd aktualizacji zadania', 'error'); fetchTasks(); }
    };

    const handleToggleExpand = (taskId) => {
        setExpandedTasks(prev => {
            const newSet = new Set(prev);
            newSet.has(taskId) ? newSet.delete(taskId) : newSet.add(taskId);
            return newSet;
        });
    };

    const handleAddTaskToColumn = (status) => {
        setModalState({ isOpen: true, task: null, initialStatus: status });
    };

    return (
        <div className="flex flex-col h-full p-4 md:p-6 bg-white dark:bg-gray-900">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Tablica Zadań</h1>
                    <p className="text-sm text-gray-500 mt-1">Zarządzaj swoimi zadaniami i śledź postępy</p>
                </div>
                <div className="flex items-center gap-3">
                    {user.role === 'administrator' && (
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                            <UserIcon size={16} className="ml-2 text-gray-400" />
                            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="p-1.5 text-sm bg-transparent focus:outline-none min-w-[150px]">
                                <option value="all">Wszyscy użytkownicy</option>
                                {users.map(u => <option key={u._id} value={u._id}>{u.username}</option>)}
                            </select>
                        </div>
                    )}
                    <button onClick={() => setModalState({ isOpen: true, task: null, initialStatus: 'todo' })} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium">
                        <PlusCircle size={18} /> Nowe zadanie
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="flex-1 flex gap-4 overflow-x-auto pb-4 items-start">
                        {columns.map(column => (
                            <KanbanColumn
                                key={column.id}
                                status={column.id}
                                title={column.title}
                                tasks={column.tasks}
                                expandedTasks={expandedTasks}
                                onToggleExpand={handleToggleExpand}
                                onEditTask={(task) => setModalState({ isOpen: true, task })}
                                onDeleteTask={handleDeleteTask}
                                onUpdateTask={handleUpdateTask}
                                onAddTask={handleAddTaskToColumn}
                            />
                        ))}
                    </div>
                </DragDropContext>
            )}

            <TaskModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ isOpen: false, task: null })}
                onSave={handleSaveTask}
                task={modalState.task}
                users={users}
                currentUser={user}
                initialStatus={modalState.initialStatus}
            />
        </div>
    );
};

export default KanbanView;
