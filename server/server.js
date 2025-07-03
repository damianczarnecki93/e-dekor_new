require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt =require('jsonwebtoken');
const multer = require('multer');
const { Readable } = require('stream');
const csv = require('csv-parser');
const iconv = require('iconv-lite');

const app = express();
app.use(cors());
app.use(express.json());

// --- Konfiguracja i połączenie z bazą danych ---
const dbUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET || 'domyslny-sekret-zmien-to';

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
    role: { type: String, default: 'user' },
    status: { type: String, enum: ['oczekujący', 'zaakceptowany'], default: 'oczekujący' }
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

const productSchema = new mongoose.Schema({
    id: String,
    name: String,
    product_code: String,
    barcode: String,
    price: Number,
    quantity: Number,
    availability: Boolean
});
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    id: { type: String, required: true },
    customerName: String,
    author: String,
    items: Array,
    total: Number,
    status: String,
    date: { type: Date, default: Date.now }
});
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

// NOWY SCHEMAT: Inwentaryzacja
const inventorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    author: String,
    items: Array,
    date: { type: Date, default: Date.now }
});
const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);


// --- Middleware do weryfikacji tokenu JWT ---
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


// --- API Endpoints - Uwierzytelnianie ---
// ... (bez zmian)

// --- API Endpoints - Admin ---
// ... (bez zmian)

// --- API Endpoints - Zamówienia ---
// ... (bez zmian)


// --- NOWE API Endpoints - Inwentaryzacja ---

// Zapisywanie lub aktualizacja listy inwentaryzacyjnej
app.post('/api/inventory', authMiddleware, async (req, res) => {
    const inventoryData = req.body;
    try {
        let savedInventory;
        if (inventoryData._id) {
            // Aktualizacja istniejącej
            savedInventory = await Inventory.findByIdAndUpdate(inventoryData._id, inventoryData, { new: true });
        } else {
            // Tworzenie nowej
            const newInventory = new Inventory({ 
                ...inventoryData, 
                author: req.user.username 
            });
            savedInventory = await newInventory.save();
        }
        res.status(201).json({ message: 'Inwentaryzacja zapisana!', inventory: savedInventory });
    } catch (error) {
        res.status(400).json({ message: 'Błąd zapisywania inwentaryzacji', error: error.message });
    }
});

// Pobieranie wszystkich list inwentaryzacyjnych
app.get('/api/inventory', authMiddleware, async (req, res) => {
    try {
        const inventories = await Inventory.find().sort({ date: -1 });
        res.status(200).json(inventories);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania list inwentaryzacyjnych', error: error.message });
    }
});

// Pobieranie konkretnej listy
app.get('/api/inventory/:id', authMiddleware, async (req, res) => {
    try {
        const inventory = await Inventory.findById(req.params.id);
        if (!inventory) return res.status(404).json({ message: 'Nie znaleziono inwentaryzacji.' });
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania inwentaryzacji.' });
    }
});

// Usuwanie listy
app.delete('/api/inventory/:id', authMiddleware, async (req, res) => {
    try {
        const inventory = await Inventory.findByIdAndDelete(req.params.id);
        if (!inventory) return res.status(404).json({ message: 'Nie znaleziono inwentaryzacji.' });
        res.status(200).json({ message: 'Inwentaryzacja usunięta.' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas usuwania inwentaryzacji.' });
    }
});


// --- Start serwera ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
