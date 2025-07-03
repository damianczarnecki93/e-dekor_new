require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// --- Konfiguracja i połączenie z bazą danych ---
const dbUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET || 'super-tajny-klucz-do-zmiany'; // Zmień to w zmiennych środowiskowych!

if (!dbUrl) {
  console.error('BŁĄD KRYTYCZNY: Zmienna środowiskowa DATABASE_URL nie jest ustawiona!');
  process.exit(1); 
}

mongoose.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Połączono z MongoDB Atlas!'))
  .catch(err => console.error('Błąd połączenia z MongoDB:', err));

// --- Definicje schematów i modeli ---

// Model Użytkownika
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    status: { type: String, enum: ['oczekujący', 'zaakceptowany'], default: 'oczekujący' }
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

// Model Produktu
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

// Model Zamówienia
const orderSchema = new mongoose.Schema({
    id: { type: String, required: true },
    customerName: String,
    items: Array,
    total: Number,
    status: String,
    date: { type: Date, default: Date.now }
});
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);


// --- API Endpoints - Uwierzytelnianie ---

// Rejestracja
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Nazwa użytkownika i hasło są wymagane.' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Użytkownik o tej nazwie już istnieje.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        
        // Pierwszy zarejestrowany użytkownik staje się adminem
        const userCount = await User.countDocuments();
        if (userCount === 0) {
            newUser.role = 'administrator';
            newUser.status = 'zaakceptowany';
        }

        await newUser.save();
        res.status(201).json({ message: 'Rejestracja pomyślna! Poczekaj na akceptację administratora.' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd serwera podczas rejestracji.', error: error.message });
    }
});

// Logowanie
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username: username.toLowerCase() });

        if (!user) {
            return res.status(401).json({ message: 'Nieprawidłowe dane logowania.' });
        }

        if (user.status !== 'zaakceptowany') {
            return res.status(403).json({ message: 'Konto nie zostało jeszcze aktywowane.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Nieprawidłowe dane logowania.' });
        }

        const token = jwt.sign({ userId: user._id, role: user.role }, jwtSecret, { expiresIn: '1d' });

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Błąd serwera podczas logowania.', error: error.message });
    }
});


// --- API Endpoints - Admin ---

// Pobieranie listy użytkowników
app.get('/api/admin/users', async (req, res) => {
    // TODO: Dodać middleware do weryfikacji tokenu JWT i roli admina
    try {
        const users = await User.find({}, '-password'); // Pobierz wszystkich użytkowników bez haseł
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania użytkowników.' });
    }
});

// Akceptacja użytkownika
app.post('/api/admin/users/:id/approve', async (req, res) => {
    // TODO: Dodać middleware do weryfikacji tokenu JWT i roli admina
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { status: 'zaakceptowany' }, { new: true });
        if (!user) {
            return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        }
        res.json({ message: 'Użytkownik zaakceptowany.', user });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas akceptacji użytkownika.' });
    }
});


// --- Pozostałe API Endpoints ---
app.get('/api/products', async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};
        if (search) {
            query = { $or: [ { name: { $regex: search, $options: 'i' } }, { product_code: { $regex: search, $options: 'i' } }, { barcode: { $regex: search, $options: 'i' } } ] };
        }
        const products = await Product.find(query).limit(20);
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania produktów', error: error.message });
    }
});

app.post('/api/orders', async (req, res) => {
    const newOrder = new Order({ id: `ZAM-${Date.now()}`, ...req.body, status: 'Zapisane' });
    try {
        const savedOrder = await newOrder.save();
        res.status(201).json({ message: 'Zamówienie zapisane!', order: savedOrder });
    } catch (error) {
        res.status(400).json({ message: 'Błąd zapisywania zamówienia', error: error.message });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ date: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania zamówień', error: error.message });
    }
});

app.post('/api/orders/:mongoId/complete', async (req, res) => {
    try {
        const order = await Order.findById(req.params.mongoId);
        if (!order) {
            return res.status(404).json({ message: 'Nie znaleziono zamówienia.' });
        }
        order.status = 'Skompletowane';
        await order.save();
        res.status(200).json({ message: 'Zamówienie skompletowane pomyślnie!', order });
    } catch (error) {
        res.status(500).json({ message: 'Wystąpił błąd serwera.', error: error.message });
    }
});


// --- Start serwera ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
