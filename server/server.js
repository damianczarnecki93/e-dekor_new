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
    status: { type: String, enum: ['oczekujący', 'zaakceptowany'], default: 'oczekujący' }
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
    date: { type: Date, default: Date.now }
});
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

const inventorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    author: String,
    items: Array,
    totalItems: Number,
    totalQuantity: Number,
    date: { type: Date, default: Date.now }
});
const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);

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

// --- API Endpoints - Uwierzytelnianie ---
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'Nazwa użytkownika i hasło są wymagane.' });
        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) return res.status(400).json({ message: 'Użytkownik o tej nazwie już istnieje.' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
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

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) return res.status(401).json({ message: 'Nieprawidłowe dane logowania.' });
        if (user.status !== 'zaakceptowany') return res.status(403).json({ message: 'Konto nie zostało jeszcze aktywowane.' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Nieprawidłowe dane logowania.' });
        const token = jwt.sign({ userId: user._id, role: user.role, username: user.username }, jwtSecret, { expiresIn: '1d' });
        res.json({ token, user: { id: user._id, username: user.username, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: 'Błąd serwera podczas logowania.', error: error.message });
    }
});

app.post('/api/user/password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Aktualne hasło jest nieprawidłowe.' });
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ message: 'Hasło zostało zmienione.' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd serwera podczas zmiany hasła.' });
    }
});

// --- API Endpoints - Admin ---
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania użytkowników.' });
    }
});

app.post('/api/admin/users/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { status: 'zaakceptowany' }, { new: true });
        if (!user) return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        res.json({ message: 'Użytkownik zaakceptowany.', user });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas akceptacji użytkownika.' });
    }
});

app.post('/api/admin/users/:id/role', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { role } = req.body;
        if (!['user', 'administrator'].includes(role)) {
            return res.status(400).json({ message: 'Nieprawidłowa rola.' });
        }
        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
        if (!user) return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        res.json({ message: 'Rola zmieniona.', user });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas zmiany roli.' });
    }
});

app.post('/api/admin/users/:id/password', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 6) return res.status(400).json({ message: 'Hasło musi mieć co najmniej 6 znaków.' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });
        if (!user) return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        res.json({ message: 'Hasło zmienione.' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas zmiany hasła.' });
    }
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        if (req.params.id === req.user.userId) {
            return res.status(400).json({ message: 'Nie można usunąć własnego konta.' });
        }
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        res.json({ message: 'Użytkownik usunięty.' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas usuwania użytkownika.' });
    }
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/admin/upload-products', authMiddleware, adminMiddleware, upload.single('productsFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Nie przesłano pliku.' });
    const { mode } = req.query;
    if (!['overwrite', 'append'].includes(mode)) {
        return res.status(400).json({ message: 'Nieprawidłowy tryb importu.' });
    }
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
                        barcodes: [row.barcode],
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
                        $addToSet: { barcodes: p.barcodes[0] }
                    },
                    upsert: true
                }
            }));
            const result = await Product.bulkWrite(bulkOps);
            res.status(200).json({ message: `Import zakończony. Zmodyfikowano ${result.modifiedCount + result.upsertedCount} produktów.` });
        }
    } catch (error) { res.status(500).json({ message: 'Wystąpił błąd serwera podczas importu.', error: error.message }); }
});

app.post('/api/admin/merge-products', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const productInfo = new Map();
        const p2Path = path.join(__dirname, 'produkty2.csv');
        if (fs.existsSync(p2Path)) {
            const stream2 = fs.createReadStream(p2Path).pipe(iconv.decodeStream('win1250')).pipe(csv({ separator: ';' }));
            for await (const row of stream2) {
                if (row.product_code) {
                    productInfo.set(row.product_code, { name: row.name });
                }
            }
        }

        const aggregation = await Product.aggregate([
            { $unwind: "$barcodes" },
            { $group: { _id: "$product_code", allBarcodes: { $addToSet: "$barcodes" }, originalDocs: { $push: "$$ROOT" } } }
        ]);

        let mergedCount = 0;
        const bulkOps = [];
        for (const group of aggregation) {
            if (!group._id || group.originalDocs.length <= 1) continue;

            const firstDoc = group.originalDocs[0];
            const preferredInfo = productInfo.get(group._id) || { name: firstDoc.name };
            const totalQuantity = group.originalDocs.reduce((sum, doc) => sum + (doc.quantity || 0), 0);
            const idsToDelete = group.originalDocs.map(doc => doc._id);

            bulkOps.push({ deleteMany: { filter: { _id: { $in: idsToDelete } } } });
            bulkOps.push({
                insertOne: {
                    document: {
                        name: preferredInfo.name,
                        product_code: group._id,
                        barcodes: group.allBarcodes,
                        price: firstDoc.price,
                        quantity: totalQuantity,
                        availability: totalQuantity > 0
                    }
                }
            });
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


// --- API Endpoints - Dashboard ---
app.get('/api/dashboard-stats', authMiddleware, async (req, res) => {
    try {
        const pendingOrders = await Order.countDocuments({ status: 'Zapisane' });
        const completedOrders = await Order.countDocuments({ status: 'Skompletowane' });
        const ordersByAuthor = await Order.aggregate([
            { $group: { _id: '$author', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        res.json({ pendingOrders, completedOrders, ordersByAuthor });
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
                separator: /[,;]/
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

app.post('/api/orders', authMiddleware, async (req, res) => {
    const orderData = req.body;
    const total = (orderData.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const newOrder = new Order({ id: `ZAM-${Date.now()}`, ...orderData, total: total, author: req.user.username, status: 'Zapisane' });
    try {
        const savedOrder = await newOrder.save();
        res.status(201).json({ message: 'Zamówienie zapisane!', order: savedOrder });
    } catch (error) {
        res.status(400).json({ message: 'Błąd zapisywania zamówienia', error: error.message });
    }
});
app.put('/api/orders/:id', authMiddleware, async (req, res) => {
    try {
        const orderData = req.body;
        orderData.total = (orderData.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, orderData, { new: true });
        if (!updatedOrder) return res.status(404).json({ message: 'Nie znaleziono zamówienia.' });
        res.json({ message: 'Zamówienie zaktualizowane!', order: updatedOrder });
    } catch (error) {
        res.status(400).json({ message: 'Błąd aktualizacji zamówienia', error: error.message });
    }
});
app.get('/api/orders', authMiddleware, async (req, res) => {
    try {
        const { status, customer, author, dateFrom, dateTo } = req.query;
        let query = {};
        if (status) query.status = status;
        if (customer) query.customerName = { $regex: customer, $options: 'i' };
        if (author) query.author = { $regex: author, $options: 'i' };
        if (dateFrom || dateTo) {
            query.date = {};
            if (dateFrom) query.date.$gte = new Date(dateFrom);
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                query.date.$lte = endDate;
            }
        }
        const orders = await Order.find(query).sort({ date: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania zamówień', error: error.message });
    }
});
app.get('/api/orders/:id', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Nie znaleziono zamówienia.' });
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania zamówienia.' });
    }
});
app.post('/api/orders/:id/complete', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Nie znaleziono zamówienia.' });
        order.status = 'Skompletowane';
        await order.save();
        res.status(200).json({ message: 'Zamówienie skompletowane pomyślnie!', order });
    } catch (error) {
        res.status(500).json({ message: 'Wystąpił błąd serwera.', error: error.message });
    }
});
app.delete('/api/orders/:id', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Nie znaleziono zamówienia.' });
        }
        res.status(200).json({ message: 'Zamówienie usunięte pomyślnie.' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas usuwania zamówienia.' });
    }
});


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
