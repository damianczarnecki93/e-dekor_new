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


// --- Endpoint diagnostyczny (TYMCZASOWY) ---
app.get('/api/diagnose-products', async (req, res) => {
    try {
        console.log('Uruchomiono diagnostykę produktów...');
        const sampleProducts = await Product.find().limit(5); // Pobierz 5 przykładowych produktów
        
        if (sampleProducts.length === 0) {
            return res.status(404).send('<h1>Diagnostyka: Baza danych jest pusta.</h1><p>Nie znaleziono żadnych produktów. Proszę, uruchom ponownie proces importu, jeśli to konieczne.</p>');
        }

        // Formatuj odpowiedź jako czytelny HTML
        let htmlResponse = '<h1>Diagnostyka Produktów</h1>';
        htmlResponse += `<p>Znaleziono ${sampleProducts.length} przykładowych produktów. Oto one:</p>`;
        htmlResponse += '<pre style="background-color: #f0f0f0; padding: 15px; border-radius: 5px;">' + JSON.stringify(sampleProducts, null, 2) + '</pre>';
        
        res.status(200).send(htmlResponse);
    } catch (error) {
        console.error('Błąd podczas diagnostyki:', error);
        res.status(500).send(`<h1>Wystąpił błąd podczas diagnostyki:</h1><pre>${error.message}</pre>`);
    }
});


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

app.get('/api/products', async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};

        console.log(`Otrzymano zapytanie o produkty. Szukana fraza: "${search}"`);

        if (search) {
            query = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { product_code: { $regex: search, $options: 'i' } },
                    { barcode: { $regex: search, $options: 'i' } }
                ]
            };
        }
        
        console.log('Wykonywane zapytanie do bazy:', JSON.stringify(query));
        const products = await Product.find(query).limit(20);
        console.log(`Znaleziono ${products.length} produktów.`);
        
        res.status(200).json(products);
    } catch (error) {
        console.error('Błąd w /api/products:', error);
        res.status(500).json({ message: 'Błąd pobierania produktów', error: error.message });
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
        console.log('Zamówienie zapisane pomyślnie:', savedOrder.id);
        res.status(201).json({ message: 'Zamówienie zapisane!', order: savedOrder });
    } catch (error) {
        console.error('Błąd w /api/orders (POST):', error);
        res.status(400).json({ message: 'Błąd zapisywania zamówienia', error: error.message });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        console.log('Otrzymano zapytanie o listę zamówień.');
        const orders = await Order.find().sort({ date: -1 });
        console.log(`Znaleziono ${orders.length} zamówień.`);
        res.status(200).json(orders);
    } catch (error) {
        console.error('Błąd w /api/orders (GET):', error);
        res.status(500).json({ message: 'Błąd pobierania zamówień', error: error.message });
    }
});

// --- Start serwera ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
