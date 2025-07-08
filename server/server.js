require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Readable } = require('stream');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// --- Konfiguracja i połączenie z bazą danych ---
const dbUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET || 'domyslny-sekret-jwt-zmien-to-w-produkcji';

if (!dbUrl) {
    console.error('BŁĄD KRYTYCZNY: Zmienna środowiskowa DATABASE_URL nie jest ustawiona!');
    process.exit(1);
}

mongoose.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Połączono z MongoDB Atlas!'))
    .catch(err => console.error('Błąd połączenia z MongoDB:', err));

// --- Definicje schematów i modeli ---

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user', enum: ['user', 'administrator'] },
    status: { type: String, enum: ['oczekujący', 'zaakceptowany'], default: 'oczekujący' },
    salesGoal: { type: Number, default: 0 },
    manualSales: { type: Number, default: 0 } 
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

const productSchema = new mongoose.Schema({
    name: String,
    product_code: { type: String, index: true },
    barcodes: { type: [String], index: true },
    price: Number,
    quantity: Number,
    availability: Boolean
});
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    customerName: String,
    author: String,
    items: Array,
    total: Number,
    status: String,
    date: { type: Date, default: Date.now },
    isDirty: { type: Boolean, default: false }
});
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

const inventorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    author: String,
    items: Array,
    totalItems: Number,
    totalQuantity: Number,
    date: { type: Date, default: Date.now },
    isDirty: { type: Boolean, default: false }
});
const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);

const noteSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    color: String,
    position: { x: Number, y: Number },
    date: { type: Date, default: Date.now }
});
const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);

// NOWE SCHEMATY
const kanbanTaskSchema = new mongoose.Schema({
    content: { type: String, required: true },
    status: { type: String, required: true, enum: ['todo', 'inprogress', 'done'], default: 'todo' },
    author: String,
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTo: String,
    assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now }
});
const KanbanTask = mongoose.models.KanbanTask || mongoose.model('KanbanTask', kanbanTaskSchema);

const delegationSchema = new mongoose.Schema({
    destination: { type: String, required: true },
    purpose: { type: String, required: true },
    dateFrom: { type: Date, required: true },
    dateTo: { type: Date, required: true },
    author: String,
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['Oczekująca', 'Zaakceptowana', 'Odrzucona'], default: 'Oczekująca' },
    notes: String
});
const Delegation = mongoose.models.Delegation || mongoose.model('Delegation', delegationSchema);


// --- Middleware ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Brak tokenu, autoryzacja odrzucona.' });
    }
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token jest nieprawidłowy.' });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'administrator') {
        next();
    } else {
        res.status(403).json({ message: 'Brak uprawnień administratora.' });
    }
};

// --- Funkcja pomocnicza do importu CSV ---
const parseCsv = (buffer) => {
    return new Promise((resolve, reject) => {
        const items = [];
        const decodedBuffer = buffer.toString('utf8');
        const firstLine = decodedBuffer.split('\n')[0];
        const separator = firstLine.includes(';') ? ';' : ',';

        const readableStream = Readable.from(decodedBuffer);
        readableStream
            .pipe(csv({ headers: false, separator: separator }))
            .on('data', (row) => {
                const identifier = row[0]?.trim(); // Może być EAN lub kod produktu
                const quantityStr = row[1]?.trim();
                if (identifier && quantityStr) {
                    const quantity = parseInt(quantityStr, 10);
                    if (!isNaN(quantity)) {
                        items.push({ identifier, quantity });
                    }
                }
            })
            .on('end', () => resolve(items))
            .on('error', (err) => reject(err));
    });
};


// --- API Endpoints - Uwierzytelnianie (bez zmian) ---
// ...

// --- API Endpoints - Admin (bez zmian) ---
// ...

// --- API Endpoints - Dashboard (bez zmian) ---
// ...

// --- API Endpoints - Produkty i Zamówienia (bez zmian) ---
// ...

// --- API Endpoints - Inwentaryzacja (bez zmian) ---
// ...

// --- API Endpoints - Notatki (bez zmian) ---
// ...

// --- NOWE ENDPOINTY - KANBAN ---
app.get('/api/kanban/tasks', authMiddleware, async (req, res) => {
    try {
        let tasks;
        if (req.user.role === 'administrator') {
            tasks = await KanbanTask.find().sort({ date: -1 });
        } else {
            tasks = await KanbanTask.find({ assignedToId: req.user.userId }).sort({ date: -1 });
        }
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania zadań' });
    }
});

app.post('/api/kanban/tasks', authMiddleware, async (req, res) => {
    try {
        const { content, assignedToId, assignedTo } = req.body;
        const newTask = new KanbanTask({
            content,
            assignedTo,
            assignedToId,
            author: req.user.username,
            authorId: req.user.userId,
            status: 'todo'
        });
        await newTask.save();
        res.status(201).json(newTask);
    } catch (error) {
        res.status(500).json({ message: 'Błąd tworzenia zadania' });
    }
});

app.put('/api/kanban/tasks/:id', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const task = await KanbanTask.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!task) return res.status(404).json({ message: 'Nie znaleziono zadania' });
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: 'Błąd aktualizacji zadania' });
    }
});

app.delete('/api/kanban/tasks/:id', authMiddleware, async (req, res) => {
    try {
        const task = await KanbanTask.findByIdAndDelete(req.params.id);
        if (!task) return res.status(404).json({ message: 'Nie znaleziono zadania' });
        res.json({ message: 'Zadanie usunięte' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd usuwania zadania' });
    }
});

// --- NOWE ENDPOINTY - DELEGACJE ---
app.get('/api/delegations', authMiddleware, async (req, res) => {
    try {
        let delegations;
        if (req.user.role === 'administrator') {
            delegations = await Delegation.find().sort({ dateFrom: -1 });
        } else {
            delegations = await Delegation.find({ authorId: req.user.userId }).sort({ dateFrom: -1 });
        }
        res.json(delegations);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania delegacji' });
    }
});

app.post('/api/delegations', authMiddleware, async (req, res) => {
    try {
        const { destination, purpose, dateFrom, dateTo, notes } = req.body;
        const newDelegation = new Delegation({
            destination,
            purpose,
            dateFrom,
            dateTo,
            notes,
            author: req.user.username,
            authorId: req.user.userId,
            status: 'Oczekująca'
        });
        await newDelegation.save();
        res.status(201).json(newDelegation);
    } catch (error) {
        res.status(500).json({ message: 'Błąd tworzenia delegacji' });
    }
});

app.put('/api/delegations/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Zaakceptowana', 'Odrzucona'].includes(status)) {
            return res.status(400).json({ message: 'Nieprawidłowy status' });
        }
        const delegation = await Delegation.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!delegation) return res.status(404).json({ message: 'Nie znaleziono delegacji' });
        res.json(delegation);
    } catch (error) {
        res.status(500).json({ message: 'Błąd aktualizacji statusu delegacji' });
    }
});

app.delete('/api/delegations/:id', authMiddleware, async (req, res) => {
    try {
        const delegation = await Delegation.findById(req.params.id);
        if (!delegation) return res.status(404).json({ message: 'Nie znaleziono delegacji' });
        
        // Tylko autor lub admin może usunąć
        if (delegation.authorId.toString() !== req.user.userId && req.user.role !== 'administrator') {
            return res.status(403).json({ message: 'Brak uprawnień do usunięcia tej delegacji' });
        }
        
        await delegation.deleteOne();
        res.json({ message: 'Delegacja usunięta' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd usuwania delegacji' });
    }
});


// --- Start serwera ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
