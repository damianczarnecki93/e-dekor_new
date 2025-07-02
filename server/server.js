require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// --- Połączenie z bazą danych MongoDB ---
mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Połączono z MongoDB Atlas!'))
  .catch(err => console.error('Błąd połączenia z MongoDB:', err));

// --- Definicje schematów i modeli ---
const productSchema = new mongoose.Schema({
    id: String,
    name: String,
    product_code: String,
    barcode: String,
    price: Number,
    quantity: Number,
    availability: Boolean
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    id: { type: String, required: true },
    customerName: String,
    items: Array,
    total: Number,
    status: String,
    date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// --- API Endpoints ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        return res.status(200).json({ user: { username: 'admin', role: 'administrator' }, token: 'mock-jwt-token-for-admin' });
    }
    if (username === 'user' && password === 'user123') {
        return res.status(200).json({ user: { username: 'user', role: 'user' }, token: 'mock-jwt-token-for-user' });
    }
    return res.status(401).json({ message: 'Nieprawidłowe dane logowania' });
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania produktów', error });
    }
});

app.post('/api/orders', async (req, res) => {
    const orderData = req.body;
    const newOrder = new Order({
        id: `ZAM-${Date.now()}`,
        customerName: orderData.customerName,
        items: orderData.items,
        total: orderData.total,
        status: 'Zapisane'
    });
    try {
        const savedOrder = await newOrder.save();
        res.status(201).json({ message: 'Zamówienie zapisane!', order: savedOrder });
    } catch (error) {
        res.status(400).json({ message: 'Błąd zapisywania zamówienia', error });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ date: -1 }); // Sortuj od najnowszych
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania zamówień', error });
    }
});

// --- Start serwera ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
