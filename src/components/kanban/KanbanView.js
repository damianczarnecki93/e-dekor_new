import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../common/Modal';
import Tooltip from '../common/Tooltip';

const TaskModal = ({ isOpen, onClose, onSave, task, users, currentUser }) => {
    const [formData, setFormData] = useState({
        title: '', content: '', subtasks: [], priority: 'Normalny', deadline: '', assignedToId: ''
    });
    const [newSubtask, setNewSubtask] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (task) {
                setFormData({
                    title: task.title || '',
                    content: task.content || '',
                    subtasks: task.subtasks || [],
                    priority: task.priority || 'Normalny',
                    deadline: task.deadline ? format(parseISO(task.deadline), "yyyy-MM-dd'T'HH:mm") : '',
                    assignedToId: task.assignedToId?._id || task.assignedToId || ''
                });
            } else {
                setFormData({
                    title: '', content: '', subtasks: [], priority: 'Normalny', deadline: '', assignedToId: currentUser.id
                });
            }
        }
    }, [task, isOpen, currentUser.id]);

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
                    <label className="font-semibold">Zadanie *</label>
                    <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                </div>
                <div>
                    <label className="font-semibold">Szczególy</label>
                    <textarea name="content" value={formData.content} onChange={handleChange} className="w-full p-2 border rounded-md min-h-[100px]"/>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="font-semibold">Priorytet</label>
                        <select name="priority" value={formData.priority} onChange={handleChange} className="w-full p-2 border rounded-md">
                            <option>Niski</option><option>Normalny</option><option>Wysoki</option>
                        </select>
                    </div>
                    <div>
                        <label className="font-semibold">Deadline (opcjonalnie)</label>
                        <input type="datetime-local" name="deadline" value={formData.deadline} onChange={handleChange} className="w-full p-2 border rounded-md" />
                    </div>
                </div>
                {currentUser.role === 'administrator' && (
                    <div>
                        <label className="font-semibold">Przypisz do</label>
                        <select name="assignedToId" value={formData.assignedToId} onChange={handleChange} className="w-full p-2 border rounded-md">
                            {users.map(u => <option key={u._id} value={u._id}>{u.username}</option>)}
                        </select>
                    </div>
                )}
                <div>
                    <label className="font-semibold">Podpunkty</label>
                    {formData.subtasks.map((st, i) => (
                        <div key={i} className="flex items-center gap-2 mt-1">
                            <input type="checkbox" checked={st.isDone} onChange={() => handleToggleSubtask(i)} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" />
                            <span className={`flex-grow p-2 bg-gray-100 dark:bg-gray-700 rounded-md ${st.isDone ? 'line-through text-gray-500' : ''}`}>{st.content}</span>
                            <button type="button" onClick={() => handleRemoveSubtask(i)} className="text-red-500"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                        <input type="text" value={newSubtask} onChange={e => setNewSubtask(e.target.value)} placeholder="Dodaj nowy podpunkt..." className="w-full p-2 border rounded-md" />
                        <button type="button" onClick={handleAddSubtask} className="px-3 bg-gray-200 dark:bg-gray-600 rounded-md">Dodaj</button>
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-4 border-t dark:border-gray-700">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg">Anuluj</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz zadanie</button>
                </div>
            </form>
        </Modal>
    );
};

const TaskCard = ({ task, isExpanded, onToggleExpand, onEdit, onDelete, onUpdateTask }) => {
    const isOverdue = task.deadline && new Date(task.deadline) < new Date();
    const priorityClass = { 'Wysoki': 'border-red-500', 'Normalny': 'border-yellow-500', 'Niski': 'border-green-500' };

    const handleSubtaskToggle = (e, index) => {
        e.stopPropagation();
        const newSubtasks = [...task.subtasks];
        newSubtasks[index].isDone = !newSubtasks[index].isDone;
        onUpdateTask(task._id, { subtasks: newSubtasks });
    };

    return (
        <div onClick={onToggleExpand} className={`p-3 mb-3 rounded-lg shadow-md bg-white dark:bg-gray-800 border-l-4 ${isOverdue ? 'border-purple-600' : priorityClass[task.priority]} cursor-pointer group`}>
            <div className="flex justify-between items-start">
                <div className="flex-grow mr-2">
                    <p className="font-semibold">{task.title}</p>
                    {task.deadline && <p className={`text-xs mt-1 ${isOverdue ? 'text-purple-600 font-bold' : 'text-gray-400'}`}>Termin: {format(parseISO(task.deadline), 'dd.MM.yy HH:mm')}</p>}
                </div>
                <div className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip text="Edytuj"><button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 text-gray-500 hover:text-blue-500"><Edit size={16}/></button></Tooltip>
                    <Tooltip text="Usuń"><button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-gray-500 hover:text-red-500"><Trash2 size={16}/></button></Tooltip>
                </div>
            </div>
            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    {task.content && <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{task.content}</p>}
                    {task.subtasks?.length > 0 && (
                        <div className="space-y-1">
                            {task.subtasks.map((subtask, index) => (
                                <label key={index} className="flex items-center gap-2 cursor-pointer text-sm">
                                    <input type="checkbox" checked={subtask.isDone} onChange={(e) => handleSubtaskToggle(e, index)} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" />
                                    <span className={subtask.isDone ? 'line-through text-gray-400' : ''}>{subtask.content}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const KanbanColumn = ({ status, column, tasks, expandedTasks, onToggleExpand, onEditTask, onDeleteTask, onUpdateTask }) => (
    <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
        <h2 className="text-lg font-bold mb-4 text-center">{column.name} ({tasks.length})</h2>
        <Droppable droppableId={status}>
            {(provided, snapshot) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className={`min-h-[400px] p-2 rounded-md transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
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
    const [modalState, setModalState] = useState({ isOpen: false, task: null });
    const { showNotification } = useNotification();
    const [expandedTasks, setExpandedTasks] = useState(new Set());

    const fetchUsers = useCallback(async () => {
        if (user.role === 'administrator') {
            try {
                const userList = await api.getUsersList();
                setUsers(userList);
            } catch (error) { showNotification(error.message, 'error'); }
        }
    }, [user.role, showNotification]);

    const fetchTasks = useCallback(async () => {
        setIsLoading(true);
        try {
            const userIdToFetch = user.role === 'administrator' ? (selectedUserId === 'all' ? '' : selectedUserId) : user.id;
            const data = await api.getKanbanTasks(userIdToFetch);
            setTasks(data);
        } catch (error) { showNotification(error.message, 'error'); }
        finally { setIsLoading(false); }
    }, [user.role, user.id, selectedUserId, showNotification]);

    useEffect(() => { fetchUsers(); fetchTasks(); }, [fetchUsers, fetchTasks]);

    const columns = useMemo(() => ({
        todo: { name: 'Do zrobienia', items: tasks.filter(t => t.status === 'todo') },
        inprogress: { name: 'W trakcie', items: tasks.filter(t => t.status === 'inprogress') },
        done: { name: 'Gotowe', items: tasks.filter(t => t.status === 'done') },
    }), [tasks]);

    const handleDragEnd = async (result) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;
        if (source.droppableId === destination.droppableId) return;

        try {
            const taskToUpdate = tasks.find(t => t._id === draggableId);
            const updatedTask = { ...taskToUpdate, status: destination.droppableId };
            setTasks(prev => prev.map(t => t._id === draggableId ? updatedTask : t));
            await api.updateKanbanTask(draggableId, { status: destination.droppableId });
            showNotification('Status zadania zaktualizowany', 'success');
        } catch (error) { showNotification(error.message, 'error'); fetchTasks(); }
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

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold">Tablica Zadań</h1>
                <div className="flex items-center gap-4">
                    {user.role === 'administrator' && (
                        <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="p-2 border rounded-md bg-white dark:bg-gray-700">
                            <option value="all">Wszyscy użytkownicy</option>
                            {users.map(u => <option key={u._id} value={u._id}>{u.username}</option>)}
                        </select>
                    )}
                    <button onClick={() => setModalState({ isOpen: true, task: null })} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
                        <PlusCircle size={20} /> Nowe zadanie
                    </button>
                </div>
            </div>
            {isLoading ? <div className="text-center">Ładowanie zadań...</div> : (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Object.entries(columns).map(([status, column]) => (
                            <KanbanColumn
                                key={status}
                                status={status}
                                column={column}
                                tasks={column.items}
                                expandedTasks={expandedTasks}
                                onToggleExpand={handleToggleExpand}
                                onEditTask={(task) => setModalState({ isOpen: true, task })}
                                onDeleteTask={handleDeleteTask}
                                onUpdateTask={handleUpdateTask}
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
            />
        </div>
    );
};

export default KanbanView;