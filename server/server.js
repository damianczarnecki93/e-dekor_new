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
const fs = require('fs');
const path = require('path');

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

// ZMIANA SCHEMATU: barcode -> barcodes
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
    totalItems: Number,
    totalQuantity: Number,
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


// --- API Endpoints - Uwierzytelnianie (bez zmian) ---
app.post('/api/register', async (req, res) => { /* ... */ });
app.post('/api/login', async (req, res) => { /* ... */ });
app.post('/api/user/password', authMiddleware, async (req, res) => { /* ... */ });


// --- API Endpoints - Admin ---
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => { /* ... */ });
app.post('/api/admin/users/:id/approve', authMiddleware, adminMiddleware, async (req, res) => { /* ... */ });
app.post('/api/admin/users/:id/role', authMiddleware, adminMiddleware, async (req, res) => { /* ... */ });
app.post('/api/admin/users/:id/password', authMiddleware, adminMiddleware, async (req, res) => { /* ... */ });
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => { /* ... */ });

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ZAKTUALIZOWANY UPLOAD PRODUKTÓW
app.post('/api/admin/upload-products', authMiddleware, adminMiddleware, upload.single('productsFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Nie przesłano pliku.' });
    const { mode } = req.query;
    if (!['overwrite', 'append'].includes(mode)) return res.status(400).json({ message: 'Nieprawidłowy tryb importu.' });
    try {
        const productsToImport = [];
        const csvHeaders = ['barcode', 'name', 'price', 'product_code', 'quantity', 'availability'];
        const decodedBuffer = iconv.decode(req.file.buffer, 'win1250');
        const readableStream = Readable.from(decodedBuffer);
        await new Promise((resolve, reject) => {
            readableStream.pipe(csv({ headers: csvHeaders, skipLines: 1 }))
                .on('data', (row) => {
                    if (!row.barcode) return;
                    productsToImport.push({
                        name: row.name || 'Brak nazwy',
                        product_code: row.product_code || '',
                        barcodes: [row.barcode], // Zawsze jako tablica
                        price: parseFloat((row.price || '0').replace(',', '.')) || 0,
                        quantity: parseInt(row.quantity) || 0,
                        availability: String(row.availability).toLowerCase() === 'true'
                    });
                }).on('end', resolve).on('error', reject);
        });
        if (productsToImport.length === 0) return res.status(400).json({ message: 'Plik CSV jest pusty lub nie zawiera poprawnych danych.' });

        if (mode === 'overwrite') {
            await Product.deleteMany({});
            await Product.insertMany(productsToImport);
            res.status(200).json({ message: `Import zakończony. Nadpisano bazę ${productsToImport.length} produktami.` });
        } else { // append
            const bulkOps = productsToImport.map(p => ({
                updateOne: {
                    filter: { product_code: p.product_code },
                    update: {
                        $set: { name: p.name, price: p.price, quantity: p.quantity, availability: p.availability },
                        $addToSet: { barcodes: p.barcodes[0] } // Dodaj nowy kod EAN do istniejących
                    },
                    upsert: true
                }
            }));
            const result = await Product.bulkWrite(bulkOps);
            res.status(200).json({ message: `Import zakończony. Zmodyfikowano ${result.modifiedCount + result.upsertedCount} produktów.` });
        }
    } catch (error) { res.status(500).json({ message: 'Wystąpił błąd serwera podczas importu.', error: error.message }); }
});

// NOWY ENDPOINT - ŁĄCZENIE PRODUKTÓW
app.post('/api/admin/merge-products', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const productInfo = new Map();
        const p2Path = path.join(__dirname, 'produkty2.csv');
        const stream2 = fs.createReadStream(p2Path).pipe(iconv.decodeStream('win1250')).pipe(csv({ separator: ';' }));
        for await (const row of stream2) {
            if (row.product_code) {
                productInfo.set(row.product_code, { name: row.name });
            }
        }

        const aggregation = await Product.aggregate([
            { $unwind: "$barcodes" },
            {
                $group: {
                    _id: "$product_code",
                    allBarcodes: { $addToSet: "$barcodes" },
                    originalDocs: { $push: "$$ROOT" }
                }
            }
        ]);

        let mergedCount = 0;
        const bulkOps = [];

        for (const group of aggregation) {
            if (!group._id) continue; // Pomiń produkty bez kodu produktu

            const firstDoc = group.originalDocs[0];
            const preferredInfo = productInfo.get(group._id) || { name: firstDoc.name };
            const totalQuantity = group.originalDocs.reduce((sum, doc) => sum + doc.quantity, 0);

            const mergedProduct = {
                name: preferredInfo.name,
                product_code: group._id,
                barcodes: group.allBarcodes,
                price: firstDoc.price,
                quantity: totalQuantity,
                availability: totalQuantity > 0
            };
            
            // Operacja usunięcia starych dokumentów z grupy
            const idsToDelete = group.originalDocs.map(doc => doc._id);
            bulkOps.push({ deleteMany: { filter: { _id: { $in: idsToDelete } } } });
            
            // Operacja wstawienia nowego, połączonego dokumentu
            bulkOps.push({ insertOne: { document: mergedProduct } });
            mergedCount++;
        }

        if (bulkOps.length > 0) {
            await Product.bulkWrite(bulkOps);
        }

        res.status(200).json({ message: `Operacja zakończona. Połączono ${mergedCount} grup produktów.` });
    } catch (error) {
        console.error("Błąd podczas łączenia produktów:", error);
        res.status(500).json({ message: 'Wystąpił błąd serwera.', error: error.message });
    }
});


// --- API Endpoints - Dashboard (ZAKTUALIZOWANY) ---
app.get('/api/dashboard-stats', authMiddleware, async (req, res) => {
    try {
        const pendingOrders = await Order.countDocuments({ status: 'Zapisane' });
        const completedOrders = await Order.countDocuments({ status: 'Skompletowane' });
        
        const ordersByAuthor = await Order.aggregate([
            { $group: { _id: '$author', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        res.json({
            pendingOrders,
            completedOrders,
            ordersByAuthor
        });
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania statystyk.' });
    }
});


// --- API Endpoints - Produkty i Zamówienia ---
app.get('/api/products', authMiddleware, async (req, res) => {
    try {
        const { search, filterByQuantity } = req.query;
        let query = {};
        if (search) {
            query = { $or: [{ name: { $regex: search, $options: 'i' } }, { product_code: { $regex: search, $options: 'i' } }, { barcodes: { $regex: search, $options: 'i' } }] };
        }
        if (filterByQuantity === 'true') {
            query.quantity = { $gt: 0 };
        }
        const products = await Product.find(query).limit(20);
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania produktów', error: error.message });
    }
});

// ZAKTUALIZOWANY IMPORT ZAMÓWIENIA
app.post('/api/orders/import-csv', authMiddleware, upload.single('orderFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Nie przesłano pliku.' });
    try {
        const itemsFromCsv = [];
        const decodedBuffer = iconv.decode(req.file.buffer, 'win1250');
        const readableStream = Readable.from(decodedBuffer);
        await new Promise((resolve, reject) => {
            readableStream.pipe(csv({
                mapHeaders: ({ header }) => {
                    const lowerCaseHeader = header.toLowerCase().trim();
                    if (lowerCaseHeader.includes('kod_kreskowy') || lowerCaseHeader.includes('barcode')) return 'barcode';
                    if (lowerCaseHeader.includes('ilość') || lowerCaseHeader.includes('quantity')) return 'quantity';
                    return null;
                },
                separator: /[,;]/ // Akceptuj przecinek lub średnik
            }))
            .on('data', (row) => {
                if (row.barcode && row.quantity) {
                    itemsFromCsv.push({ barcode: row.barcode.trim(), quantity: parseInt(row.quantity.trim(), 10) });
                }
            }).on('end', resolve).on('error', reject);
        });
        if (itemsFromCsv.length === 0) return res.status(400).json({ message: 'Plik CSV jest pusty lub ma nieprawidłowy format. Wymagane kolumny: barcode/kod_kreskowy, quantity/ilość' });
        
        const barcodes = itemsFromCsv.map(item => item.barcode);
        const foundProducts = await Product.find({ barcodes: { $in: barcodes } }).lean();
        const productMap = new Map();
        foundProducts.forEach(p => {
            p.barcodes.forEach(b => productMap.set(b, p));
        });

        const orderItems = [];
        const notFoundBarcodes = [];
        for (const csvItem of itemsFromCsv) {
            const product = productMap.get(csvItem.barcode);
            if (product) {
                orderItems.push({ ...product, quantity: csvItem.quantity });
            } else {
                notFoundBarcodes.push(csvItem.barcode);
            }
        }
        res.json({ items: orderItems, notFound: notFoundBarcodes });
    } catch (error) { res.status(500).json({ message: 'Wystąpił błąd serwera podczas importu zamówienia.', error: error.message }); }
});

app.post('/api/orders', authMiddleware, async (req, res) => { /* ... */ });
app.put('/api/orders/:id', authMiddleware, async (req, res) => { /* ... */ });
app.get('/api/orders', authMiddleware, async (req, res) => { /* ... */ });
app.get('/api/orders/:id', authMiddleware, async (req, res) => { /* ... */ });
app.post('/api/orders/:id/complete', authMiddleware, async (req, res) => { /* ... */ });
app.delete('/api/orders/:id', authMiddleware, async (req, res) => { /* ... */ });


// --- NOWE API Endpoints - Inwentaryzacja ---
app.post('/api/inventories', authMiddleware, async (req, res) => {
    try {
        const { name, items } = req.body;
        if (!name || !items) return res.status(400).json({ message: 'Nazwa i lista produktów są wymagane.' });
        const totalItems = items.length;
        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
        const newInventory = new Inventory({ name, items, author: req.user.username, totalItems, totalQuantity });
        await newInventory.save();
        res.status(201).json({ message: 'Inwentaryzacja została zapisana.', inventory: newInventory });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas zapisywania inwentaryzacji.', error: error.message });
    }
});

app.get('/api/inventories', authMiddleware, async (req, res) => {
    try {
        const inventories = await Inventory.find().sort({ date: -1 });
        res.json(inventories);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania inwentaryzacji.' });
    }
});

app.get('/api/inventories/:id', authMiddleware, async (req, res) => {
    try {
        const inventory = await Inventory.findById(req.params.id);
        if (!inventory) return res.status(404).json({ message: 'Nie znaleziono inwentaryzacji.' });
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania inwentaryzacji.' });
    }
});


// --- Start serwera ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});
