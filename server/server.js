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
// Zapobiega tworzeniu nowego modelu przy każdym restarcie serwera na Render.com
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


// --- Endpoint do importu danych (TYMCZASOWY) ---
app.get('/api/import-data-now', async (req, res) => {
    try {
        console.log('Rozpoczęto proces importu danych...');

        // 1. Czyszczenie istniejącej kolekcji produktów
        console.log('Czyszczenie kolekcji produktów...');
        await Product.deleteMany({});
        console.log('Kolekcja wyczyszczona.');

        // 2. Wczytywanie danych z plików CSV
        const productsToImport = [];
        const files = ['produkty.csv', 'produkty2.csv'];

        for (const file of files) {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                console.log(`Wczytywanie pliku: ${file}...`);
                await new Promise((resolve, reject) => {
                    fs.createReadStream(filePath)
                        .pipe(csv())
                        .on('data', (data) => {
                            productsToImport.push({
                                ...data,
                                id: data.id || data.barcode,
                                price: parseFloat(data.price) || 0,
                                quantity: parseInt(data.quantity) || 0,
                                availability: (data.availability || 'true').toLowerCase() === 'true'
                            });
                        })
                        .on('end', resolve)
                        .on('error', reject);
                });
            }
        }

        // 3. Zapisywanie nowych danych do bazy
        if (productsToImport.length > 0) {
            console.log(`Importowanie ${productsToImport.length} produktów do bazy danych...`);
            await Product.insertMany(productsToImport);
            console.log('Import zakończony sukcesem!');
            res.status(200).send('<h1>Import danych zakończony sukcesem!</h1><p>Możesz teraz zamknąć tę kartę. Ten adres URL zadziałał tylko raz.</p>');
        } else {
            res.status(404).send('Nie znaleziono plików CSV do importu.');
        }

    } catch (error) {
        console.error('Wystąpił błąd podczas importu:', error);
        res.status(500).send(`<h1>Wystąpił błąd podczas importu:</h1><pre>${error.message}</pre>`);
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
