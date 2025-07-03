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


// --- Endpoint do importu danych (ULEPSZONY) ---
app.get('/api/import-data-now', async (req, res) => {
    try {
        console.log('Rozpoczęto proces importu danych (wersja 3)...');
        await Product.deleteMany({});
        console.log('Kolekcja produktów wyczyszczona.');

        const productsToImport = [];
        const files = ['produkty.csv', 'produkty2.csv'];

        for (const file of files) {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                console.log(`Wczytywanie pliku: ${file}...`);
                await new Promise((resolve, reject) => {
                    fs.createReadStream(filePath)
                        // POPRAWKA: Dodanie opcji `bom: true` do obsługi specjalnych znaków na początku pliku
                        .pipe(csv({ bom: true }))
                        .on('data', (row) => {
                            // Dodatkowe logowanie, aby zobaczyć, co odczytuje parser
                            console.log('Odczytany wiersz z CSV:', row); 
                            const product = {
                                id: row.id || row.barcode || `fallback-${Math.random()}`,
                                name: row.name,
                                product_code: row.product_code,
                                barcode: row.barcode,
                                price: parseFloat(row.price) || 0,
                                quantity: parseInt(row.quantity) || 0,
                                availability: String(row.availability).toLowerCase() === 'true'
                            };
                            productsToImport.push(product);
                        })
                        .on('end', resolve)
                        .on('error', reject);
                });
            }
        }

        if (productsToImport.length > 0) {
            console.log(`Importowanie ${productsToImport.length} produktów...`);
            await Product.insertMany(productsToImport);
            console.log('Import zakończony sukcesem!');
            res.status(200).send('<h1>Import danych zakończony sukcesem!</h1><p>Produkty zostały poprawnie zapisane w bazie danych.</p>');
        } else {
            res.status(404).send('Nie znaleziono plików CSV do importu.');
        }

    } catch (error) {
        console.error('Wystąpił błąd podczas importu:', error);
        res.status(500).send(`<h1>Wystąpił błąd podczas importu:</h1><pre>${error.message}</pre>`);
    }
});


// --- Endpoint diagnostyczny (TYMCZASOWY) ---
app.get('/api/diagnose-products', async (req, res) => {
    try {
        console.log('Uruchomiono diagnostykę produktów...');
        const sampleProducts = await Product.find().limit(5);
        
        if (sampleProducts.length === 0) {
            return res.status(404).send('<h1>Diagnostyka: Baza danych jest pusta.</h1>');
        }

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

        if (search) {
            query = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { product_code: { $regex: search, $options: 'i' } },
                    { barcode: { $regex: search, $options: 'i' } }
                ]
            };
        }
        
        const products = await Product.find(query).limit(20);
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

// --- Start serwera ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
