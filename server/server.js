require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
app.use(cors());
app.use(express.json());

// --- Sprawdzenie, czy adres do bazy danych jest ustawiony ---
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('BŁĄD KRYTYCZNY: Zmienna środowiskowa DATABASE_URL nie jest ustawiona!');
  process.exit(1); 
}

// --- Połączenie z bazą danych MongoDB ---
mongoose.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true })
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
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    id: { type: String, required: true },
    customerName: String,
    items: Array,
    total: Number,
    status: String,
    date: { type: Date, default: Date.now }
});
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);


// --- Główne API Endpoints ---
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

// ZAKTUALIZOWANY ENDPOINT WYSZUKIWANIA
app.get('/api/products', async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};

        if (search) {
            const regex = new RegExp(search, 'i'); // 'i' for case-insensitive
            query = {
                $or: [
                    { name: { $regex: regex } },
                    { product_code: { $regex: regex } },
                    { barcode: { $regex: regex } }
                ]
            };
        }

        const products = await Product.find(query).limit(20); // Ograniczamy wyniki do 20 dla wydajności
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
        const orders = await Order.find().sort({ date: -1 });
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
