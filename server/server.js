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
const nodemailer = require('nodemailer');
const axios = require('axios');

const app = express();
const corsOptions = {
  origin: '*', // Pozwala na żądania z dowolnego źródła
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Umożliwia obsługę zapytań preflight (OPTIONS)

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

// --- Konfiguracja i połączenie z bazą danych ---
const dbUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET || 'domyslny-sekret-jwt-zmien-to-w-produkcji';

if (!dbUrl) {
    console.error('BŁĄD KRYTYCZNY: Zmienna środowiskowa DATABASE_URL nie jest ustawiona!');
    process.exit(1);
}

mongoose.connect(dbUrl)
    .then(() => console.log('Połączono z MongoDB Atlas!'))
    .catch(err => console.error('Błąd połączenia z MongoDB:', err));

// --- Definicje schematów i modeli ---

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user', enum: ['user', 'administrator'] },
    status: { type: String, enum: ['oczekujący', 'zaakceptowany'], default: 'oczekujący' },
    salesGoal: { type: Number, default: 0 },
    manualSales: { type: Number, default: 0 },
    visibleModules: { type: [String], default: [] },
	dashboardLayout: { type: [String], default: ['stats_products', 'stats_pending_orders', 'stats_completed_orders', 'quick_actions', 'my_tasks'] }
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
    status: { 
        type: String, 
        default: 'Zapisane', 
        // Dodajemy nowe statusy
        enum: ['Zapisane', 'Skompletowane', 'Zakończono', 'Braki'] 
    },
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

const kanbanTaskSchema = new mongoose.Schema({
    content: { type: String, required: true },
    status: { type: String, required: true, enum: ['todo', 'inprogress', 'done'], default: 'todo' },
    author: String,
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTo: String,
    assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
    isAccepted: { type: Boolean, default: false },
    details: { type: String, default: '' },
    subtasks: [{
        content: String,
        isDone: { type: Boolean, default: false }
    }]
});
const KanbanTask = mongoose.models.KanbanTask || mongoose.model('KanbanTask', kanbanTaskSchema);

const delegationSchema = new mongoose.Schema({
    destination: { type: String, required: true },
    purpose: { type: String, required: true },
    dateFrom: { type: Date, required: true },
    dateTo: { type: Date, required: true },
    author: String,
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['Oczekująca', 'Zaakceptowana', 'Odrzucona', 'W trakcie', 'Zakończona'], default: 'Oczekująca' },
    notes: String,
    kms: Number,
    advancePayment: Number,
    transport: String,
    clients: [{
        name: String,
        address: String,
        lat: Number,
        lng: Number,
        note: String,
        startTime: Date,
        endTime: Date,
        visitNotes: String,
        ordered: Boolean,
    }],
    startTime: Date,
    endTime: Date
});
const Delegation = mongoose.models.Delegation || mongoose.model('Delegation', delegationSchema);

const emailConfigSchema = new mongoose.Schema({
    host: { type: String, required: true },
    port: { type: Number, required: true },
    secure: { type: Boolean, default: true },
    user: { type: String, required: true },
    pass: { type: String, required: true },
    // Dodajemy to pole
    recipientEmail: { type: String, required: true }, 
});
const EmailConfig = mongoose.models.EmailConfig || mongoose.model('EmailConfig', emailConfigSchema);

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

async function sendNotificationEmail(subject, htmlContent) {
    try {
        const config = await EmailConfig.findOne();
        if (!config || !config.host || !config.recipientEmail) {
            console.log('Powiadomienie email pominięte - brak pełnej konfiguracji w bazie danych.');
            return { success: false, error: 'Brak konfiguracji email.' };
        }

        // --- POCZĄTEK POPRAWKI ---
        // Automatycznie ustawiamy 'secure' na podstawie portu.
        // Tylko port 465 używa bezpiecznego połączenia od samego początku.
        const isSecurePort = parseInt(config.port, 10) === 465;
        // --- KONIEC POPRAWKI ---

        let transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            // Używamy naszej nowej zmiennej zamiast wartości z bazy danych
            secure: isSecurePort,
            auth: {
                user: config.user,
                pass: config.pass,
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        await transporter.verify();

        const info = await transporter.sendMail({
            from: `"System E-Dekor" <${config.user}>`,
            to: config.recipientEmail,
            subject: subject,
            html: htmlContent,
        });

        console.log(`Wysłano e-mail z powiadomieniem: ${subject}, Message ID: ${info.messageId}`);
        return { success: true };

    } catch (error) {
        console.error('BŁĄD NODEMAILER:', error);
        return { success: false, error: error.message || 'Nieznany błąd podczas wysyłania e-maila.' };
    }
}

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
async function geocodeAddress(address) {
    if (!address) return null;
    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: address,
                key: process.env.Maps_API_KEY,
            },
        });
        const { results } = response.data;
        if (results && results.length > 0) {
            const { lat, lng } = results[0].geometry.location;
            return { lat, lng };
        }
        return null;
    } catch (error) {
        console.error('Błąd geokodowania dla adresu:', address, error.message);
        return null;
    }
}

app.post('/api/orders/:id/process-completion', authMiddleware, async (req, res) => {
    try {
        const { pickedItems, allItems } = req.body;
        const originalOrder = await Order.findById(req.params.id);

        if (!originalOrder) {
            return res.status(404).json({ message: 'Nie znaleziono oryginalnego zamówienia.' });
        }

        const pickedItemIds = new Set(pickedItems.map(p => p._id));
        const unpickedItems = allItems.filter(item => !pickedItemIds.has(item._id));

        // 1. Jeśli są niezebrane produkty, utwórz nowe zamówienie na braki
        if (unpickedItems.length > 0) {
            const shortageOrderTotal = unpickedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const shortageOrder = new Order({
                id: `BRAKI-${originalOrder.id}`,
                customerName: `[BRAKI] ${originalOrder.customerName}`,
                author: originalOrder.author, // lub req.user.username, zależy od logiki
                items: unpickedItems,
                total: shortageOrderTotal,
				status: 'Braki', // ZMIANA Z 'Zapisane' NA 'Braki'
				isDirty: false
            });
            await shortageOrder.save();
        }

        // 2. Zaktualizuj oryginalne zamówienie, aby zawierało tylko zebrane produkty
        originalOrder.items = pickedItems;
        originalOrder.total = pickedItems.reduce((sum, item) => sum + (item.price * (item.pickedQuantity || item.quantity)), 0);
        originalOrder.status = 'Skompletowane';
        await originalOrder.save();
        
        res.status(200).json({ message: 'Kompletacja zakończona. Utworzono zamówienie na braki, jeśli to konieczne.' });

    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas przetwarzania kompletacji.', error: error.message });
    }
});


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
        // UPEWNIJ SIĘ, ŻE ZWRACASZ TUTAJ `visibleModules`
        res.json({ token, user: { id: user._id, username: user.username, role: user.role, salesGoal: user.salesGoal, manualSales: user.manualSales, visibleModules: user.visibleModules, dashboardLayout: user.dashboardLayout } });
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

app.post('/api/user/goal', authMiddleware, async (req, res) => {
    try {
        const { goal } = req.body;
        const user = await User.findByIdAndUpdate(req.user.userId, { salesGoal: goal }, { new: true });
        res.json({ salesGoal: user.salesGoal });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas ustawiania celu.' });
    }
});

app.post('/api/user/manual-sales', authMiddleware, async (req, res) => {
    try {
        const { sales } = req.body;
        const user = await User.findByIdAndUpdate(req.user.userId, { $inc: { manualSales: sales } }, { new: true });
        res.json({ manualSales: user.manualSales });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas dodawania sprzedaży.' });
    }
});

app.put('/api/orders/:id/status', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        // Walidacja, czy status jest jednym z dozwolonych
        if (!['Zapisane', 'Skompletowane', 'Zakończono', 'Braki'].includes(status)) {
            return res.status(400).json({ message: 'Nieprawidłowy status.' });
        }
        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!updatedOrder) return res.status(404).json({ message: 'Nie znaleziono zamówienia.' });
		 if (status === 'Zakończono') {
            const emailSubject = `Zamówienie dla ${updatedOrder.customerName} zostało zakończone`;
            const emailHtml = `
                <h1>Status zamówienia został zmieniony na "Zakończono"</h1>
                <p><strong>Klient:</strong> ${updatedOrder.customerName}</p>
                <p><strong>Wartość:</strong> ${updatedOrder.total.toFixed(2)} PLN</p>
                <p>Zamówienie zostało zakończone przez: ${req.user.username}</p>
				<p>Szczegóły zamówienia dostępne w Panelu Sprzedaży</p>
            `;
            sendNotificationEmail(emailSubject, emailHtml).catch(console.error);
        }
        res.json({ message: 'Status zamówienia zaktualizowany!', order: updatedOrder });
    } catch (error) {
        res.status(400).json({ message: 'Błąd aktualizacji statusu', error: error.message });
    }
});

app.put('/api/user/dashboard-layout', authMiddleware, async (req, res) => {
    try {
        const { layout } = req.body;
        const user = await User.findByIdAndUpdate(req.user.userId, { dashboardLayout: layout }, { new: true });
        
        if (!user) {
            return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        }
        
        // Zwracamy zaktualizowany obiekt użytkownika, aby frontend mógł zsynchronizować stan
        const userData = {
             id: user._id,
             username: user.username,
             role: user.role,
             salesGoal: user.salesGoal,
             manualSales: user.manualSales,
             visibleModules: user.visibleModules,
             dashboardLayout: user.dashboardLayout,
        };

        res.json({ message: 'Układ pulpitu zapisany.', user: userData });
    } catch (error) {
        res.status(500).json({ message: 'Błąd zapisywania układu pulpitu.' });
    }
});

// --- API Endpoints - Admin ---
app.get('/api/admin/email-config', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // Zawsze szukamy jednego dokumentu konfiguracyjnego
        const config = await EmailConfig.findOne();
        res.json(config || {});
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania konfiguracji email.' });
    }
});

app.post('/api/admin/test-email', authMiddleware, adminMiddleware, async (req, res) => {
    const testSubject = 'E-mail testowy z systemu E-Dekor';
    const testHtml = '<h1>Wiadomość testowa</h1><p>Jeśli to widzisz, konfiguracja Twojej poczty e-mail działa poprawnie.</p>';
    
    const result = await sendNotificationEmail(testSubject, testHtml);

    if (result.success) {
        res.json({ message: 'E-mail testowy został wysłany!' });
    } else {
        res.status(500).json({ message: 'Nie udało się wysłać e-maila.', error: result.error });
    }
});

app.post('/api/admin/email-config', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // Używamy findOneAndUpdate z opcją 'upsert' aby stworzyć nowy dokument, jeśli nie istnieje,
        // lub zaktualizować istniejący. To zapewnia, że zawsze jest tylko jedna konfiguracja.
        const config = await EmailConfig.findOneAndUpdate({}, req.body, { new: true, upsert: true });
        res.json({ message: 'Konfiguracja email zapisana!', config });
    } catch (error) {
        res.status(500).json({ message: 'Błąd zapisywania konfiguracji email.' });
    }
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania użytkowników.' });
    }
});

app.get('/api/users/list', authMiddleware, async (req, res) => {
    try {
        const users = await User.find({ status: 'zaakceptowany' }).select('_id username');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania listy użytkowników.' });
    }
});

app.put('/api/admin/users/:id/modules', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { modules } = req.body;
        const user = await User.findByIdAndUpdate(req.params.id, { visibleModules: modules }, { new: true });
        if (!user) return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        res.json({ message: 'Moduły zaktualizowane.', user });
    } catch (error) {
        res.status(500).json({ message: 'Błąd aktualizacji modułów.' });
    }
});


app.post('/api/admin/users/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { status: 'zaakceptowany' }, { new: true });
        if (!user) return res.status(404).json({ message: 'Użytkownik zaakceptowany.', user });
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
        const decodedBuffer = req.file.buffer.toString('utf8');
        const readableStream = Readable.from(decodedBuffer);
        
        await new Promise((resolve, reject) => {
            readableStream.pipe(csv({ headers: csvHeaders, separator: ';', skipLines: 1 }))
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

app.get('/api/admin/all-products', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const query = search ? {
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { product_code: { $regex: search, $options: 'i' } },
                { barcodes: { $regex: search, $options: 'i' } }
            ]
        } : {};

        const products = await Product.find(query)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();
        
        const count = await Product.countDocuments(query);

        res.json({
            products,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page, 10),
            totalProducts: count
        });
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania produktów' });
    }
});

app.get('/api/reports/shortages', authMiddleware, async (req, res) => {
    try {
        // 1. Znajdź wszystkie zamówienia ze statusem 'Zapisane'
        const activeOrders = await Order.find({ 
        status: { $in: ['Zakończono', 'Braki'] } // <-- ZMIANA
    }).lean();

        if (activeOrders.length === 0) {
            return res.json([]);
        }

        // 2. Zbierz unikalne kody wszystkich produktów z tych zamówień
        const allProductCodes = [...new Set(
            activeOrders.flatMap(order => order.items.map(item => item.product_code))
        )];

        // 3. Pobierz aktualne stany magazynowe dla tych produktów w jednym zapytaniu
        const productsInDb = await Product.find({ product_code: { $in: allProductCodes } });
        const productAvailabilityMap = new Map(
            productsInDb.map(p => [p.product_code, p.quantity || 0])
        );
        
        const reportByOrder = [];

        // 4. Przetwórz każde zamówienie osobno
        for (const order of activeOrders) {
            const shortagesForThisOrder = [];
            for (const item of order.items) {
                const available = productAvailabilityMap.get(item.product_code) || 0;
                const required = item.quantity;

                if (required > available) {
                    shortagesForThisOrder.push({
                        _id: item._id, // Używamy ID z pozycji zamówienia dla unikalności
                        name: item.name,
                        product_code: item.product_code,
                        required: required,
                        available: available,
                        shortage: required - available
                    });
                }
            }

            // 5. Jeśli w zamówieniu są braki, dodaj je do raportu
            if (shortagesForThisOrder.length > 0) {
                reportByOrder.push({
                    _id: order._id,
                    orderId: order.id,
                    customerName: order.customerName,
                    shortages: shortagesForThisOrder
                });
            }
        }

        res.json(reportByOrder);

    } catch (error) {
        res.status(500).json({ message: 'Błąd generowania raportu braków.', error: error.message });
    }
});

// --- API Endpoints - Dashboard ---
app.get('/api/dashboard-stats', authMiddleware, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.userId);
        if (!currentUser) {
            return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        }

        const productCount = await Product.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: { $in: ['Zakończono', 'Braki'] } });
        const completedOrders = await Order.countDocuments({ status: 'Skompletowane' });
        
        const ordersByAuthor = await Order.aggregate([
            { $group: { _id: '$author', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const topProducts = await Order.aggregate([
            { $unwind: "$items" },
            { $group: { _id: "$items.name", totalSold: { $sum: "$items.quantity" } } },
            { $sort: { totalSold: -1 } },
            { $limit: 5 }
        ]);

        const topCustomers = await Order.aggregate([
            { $group: { _id: "$customerName", orderCount: { $sum: 1 } } },
            { $sort: { orderCount: -1 } },
            { $limit: 5 }
        ]);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);

        // Individual sales
        const individualSalesResult = await Order.aggregate([
            { $match: { date: { $gte: startOfMonth, $lt: endOfMonth }, author: req.user.username } },
            { $group: { _id: null, total: { $sum: "$total" } } }
        ]);
        const individualOrderSales = individualSalesResult.length > 0 ? individualSalesResult[0].total : 0;
        const totalIndividualSales = individualOrderSales + (currentUser.manualSales || 0);

        // Global sales
        const allUsers = await User.find({});
        const totalManualSales = allUsers.reduce((sum, user) => sum + (user.manualSales || 0), 0);
        const totalSalesGoal = allUsers.reduce((sum, user) => sum + (user.salesGoal || 0), 0);
        
        const globalOrderSalesResult = await Order.aggregate([
            { $match: { date: { $gte: startOfMonth, $lt: endOfMonth } } },
            { $group: { _id: null, total: { $sum: "$total" } } }
        ]);
        const globalOrderSales = globalOrderSalesResult.length > 0 ? globalOrderSalesResult[0].total : 0;
        const totalGlobalSales = globalOrderSales + totalManualSales;

        res.json({ 
            productCount,
            pendingOrders, 
            completedOrders, 
            ordersByAuthor,
            topProducts,
            topCustomers,
            individualMonthlySales: totalIndividualSales,
            individualSalesGoal: currentUser.salesGoal,
            totalMonthlySales: totalGlobalSales,
            totalSalesGoal: totalSalesGoal,
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

app.post('/api/orders/import-csv', authMiddleware, upload.single('orderFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Nie przesłano pliku.' });
    try {
        const itemsFromCsv = await parseCsv(req.file.buffer);

        if (itemsFromCsv.length === 0) {
            return res.status(400).json({ message: 'Plik CSV jest pusty lub ma nieprawidłowy format. Wymagane kolumny: ean,ilosc (oddzielone przecinkiem lub średnikiem).' });
        }
        
        const barcodes = itemsFromCsv.map(item => item.identifier);
        const foundProducts = await Product.find({ barcodes: { $in: barcodes } }).lean();
        const productMap = new Map();
        foundProducts.forEach(p => {
            p.barcodes.forEach(b => productMap.set(b, p));
        });

        const orderItems = [];
        const notFoundBarcodes = [];
        for (const csvItem of itemsFromCsv) {
            const product = productMap.get(csvItem.identifier);
            if (product) {
                orderItems.push({ ...product, quantity: csvItem.quantity });
            } else {
                notFoundBarcodes.push(csvItem.identifier);
            }
        }
        res.json({ items: orderItems, notFound: notFoundBarcodes });
    } catch (error) { 
        console.error("Błąd importu CSV zamówienia:", error);
        res.status(500).json({ message: 'Wystąpił błąd serwera podczas importu zamówienia.', error: error.message }); 
    }
});

app.post('/api/orders/import-multiple-csv', authMiddleware, upload.array('orderFiles'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Nie przesłano plików.' });
    }

    try {
        let createdCount = 0;
        for (const file of req.files) {
            const itemsFromCsv = await parseCsv(file.buffer);
            if (itemsFromCsv.length > 0) {
                const barcodes = itemsFromCsv.map(item => item.identifier);
                const foundProducts = await Product.find({ barcodes: { $in: barcodes } }).lean();
                const productMap = new Map();
                foundProducts.forEach(p => p.barcodes.forEach(b => productMap.set(b, p)));

                const orderItems = [];
                for (const csvItem of itemsFromCsv) {
                    const product = productMap.get(csvItem.identifier);
                    if (product) {
                        orderItems.push({ ...product, quantity: csvItem.quantity });
                    }
                }
                
                if (orderItems.length > 0) {
                    const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    const customerName = file.originalname.replace(/\.csv$/i, '');
                    const newOrder = new Order({
                        id: `ZAM-${Date.now()}-${createdCount}`,
                        customerName: customerName,
                        items: orderItems,
                        total: total,
                        author: req.user.username,
                        status: 'Zapisane',
                        isDirty: false
                    });
                    await newOrder.save();
                    createdCount++;
                }
            }
        }
        res.status(201).json({ message: `Pomyślnie zaimportowano i utworzono ${createdCount} zamówień.` });
    } catch (error) {
        console.error("Błąd importu wielu plików CSV:", error);
        res.status(500).json({ message: 'Wystąpił błąd serwera podczas importu zamówień.', error: error.message });
    }
});


app.post('/api/orders', authMiddleware, async (req, res) => {
    const orderData = req.body;
    const total = (orderData.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const newOrder = new Order({ id: `ZAM-${Date.now()}`, ...orderData, total: total, author: req.user.username, status: 'Zapisane', isDirty: false });
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
        orderData.isDirty = false;
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
		if (status && status.length > 0) {
            if (Array.isArray(status)) {
                query.status = { $in: status };
            } else {
                query.status = status;
            }
        }
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
app.post('/api/orders/:id/revert', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Nie znaleziono zamówienia.' });
        }
        order.status = 'Zapisane';
        await order.save();
        res.status(200).json({ message: 'Przywrócono zamówienie do kompletacji.', order });
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


// --- API Endpoints - Inwentaryzacja ---
app.post('/api/inventories', authMiddleware, async (req, res) => {
    try {
        const { name, items } = req.body;
        if (!name || !items) return res.status(400).json({ message: 'Nazwa i lista produktów są wymagane.' });
        const totalItems = items.length;
        const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const newInventory = new Inventory({ name, items, author: req.user.username, totalItems, totalQuantity, isDirty: false });
        await newInventory.save();
        res.status(201).json({ message: 'Inwentaryzacja została zapisana.', inventory: newInventory });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas zapisywania inwentaryzacji.', error: error.message });
    }
});

app.put('/api/inventories/:id', authMiddleware, async (req, res) => {
    try {
        const { name, items } = req.body;
        if (!name || !items) return res.status(400).json({ message: 'Nazwa i lista produktów są wymagane.' });
        const totalItems = items.length;
        const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const updatedInventory = await Inventory.findByIdAndUpdate(req.params.id, { name, items, totalItems, totalQuantity, isDirty: false }, { new: true });
        if (!updatedInventory) return res.status(404).json({ message: 'Nie znaleziono inwentaryzacji.' });
        res.status(200).json({ message: 'Inwentaryzacja zaktualizowana.', inventory: updatedInventory });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas aktualizacji inwentaryzacji.', error: error.message });
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

app.delete('/api/inventories/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const inventory = await Inventory.findByIdAndDelete(req.params.id);
        if (!inventory) return res.status(404).json({ message: 'Nie znaleziono inwentaryzacji.' });
        res.status(200).json({ message: 'Inwentaryzacja usunięta.' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas usuwania inwentaryzacji.' });
    }
});

app.post('/api/inventories/import-sheet', authMiddleware, upload.single('sheetFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Nie przesłano pliku.' });
    try {
        const itemsFromCsv = await parseCsv(req.file.buffer);

        if (itemsFromCsv.length === 0) {
            return res.status(400).json({ message: 'Plik CSV jest pusty lub ma nieprawidłowy format. Wymagane kolumny: kod_produktu,ilosc' });
        }
        
        const productCodes = itemsFromCsv.map(item => item.identifier);
        const foundProducts = await Product.find({ product_code: { $in: productCodes } }).lean();
        const productMap = new Map();
        foundProducts.forEach(p => {
            productMap.set(p.product_code, p);
        });

        const inventoryItems = [];
        for (const csvItem of itemsFromCsv) {
            const product = productMap.get(csvItem.identifier);
            if (product) {
                inventoryItems.push({ ...product, quantity: 0, expectedQuantity: csvItem.quantity });
            } else {
                // Jeżeli nie znaleziono, stwórz pozycję bez nazwy
                inventoryItems.push({
                    _id: `custom-${Date.now()}-${csvItem.identifier}`,
                    name: '',
                    product_code: csvItem.identifier,
                    barcodes: [],
                    price: 0,
                    quantity: 0,
                    expectedQuantity: csvItem.quantity,
                    isCustom: true,
                });
            }
        }
        res.json({ items: inventoryItems });
    } catch (error) { 
        console.error("Błąd importu arkusza inwentaryzacyjnego:", error);
        res.status(500).json({ message: 'Wystąpił błąd serwera podczas importu arkusza.', error: error.message }); 
    }
});

app.post('/api/inventories/import-multiple-sheets', authMiddleware, upload.array('sheetFiles'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Nie przesłano plików.' });
    }

    try {
        let createdCount = 0;
        for (const file of req.files) {
            const itemsFromCsv = await parseCsv(file.buffer);
            if (itemsFromCsv.length > 0) {
                const productCodes = itemsFromCsv.map(item => item.identifier);
                const foundProducts = await Product.find({ product_code: { $in: productCodes } }).lean();
                const productMap = new Map();
                foundProducts.forEach(p => productMap.set(p.product_code, p));

                const inventoryItems = [];
                for (const csvItem of itemsFromCsv) {
                    const product = productMap.get(csvItem.identifier);
                    if (product) {
                        inventoryItems.push({ ...product, quantity: 0, expectedQuantity: csvItem.quantity });
                    } else {
                        inventoryItems.push({
                            _id: `custom-${Date.now()}-${csvItem.identifier}`,
                            name: '',
                            product_code: csvItem.identifier,
                            barcodes: [],
                            price: 0,
                            quantity: 0,
                            expectedQuantity: csvItem.quantity,
                            isCustom: true,
                        });
                    }
                }
                
                if (inventoryItems.length > 0) {
                    const totalItems = inventoryItems.length;
                    const totalQuantity = inventoryItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
                    const name = file.originalname.replace(/\.csv$/i, '');
                    const newInventory = new Inventory({
                        name,
                        items: inventoryItems,
                        author: req.user.username,
                        totalItems,
                        totalQuantity,
                        isDirty: false
                    });
                    await newInventory.save();
                    createdCount++;
                }
            }
        }
        res.status(201).json({ message: `Pomyślnie zaimportowano i utworzono ${createdCount} arkuszy inwentaryzacyjnych.` });
    } catch (error) {
        console.error("Błąd importu wielu arkuszy:", error);
        res.status(500).json({ message: 'Wystąpił błąd serwera podczas importu arkuszy.', error: error.message });
    }
});


// --- API Endpoints - Notatki ---
app.get('/api/notes', authMiddleware, async (req, res) => {
    try {
        const notes = await Note.find({ userId: req.user.userId });
        res.json(notes);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania notatek' });
    }
});

app.post('/api/notes', authMiddleware, async (req, res) => {
    try {
        const { content, color, position } = req.body;
        const newNote = new Note({ userId: req.user.userId, content, color, position });
        await newNote.save();
        res.status(201).json(newNote);
    } catch (error) {
        res.status(500).json({ message: 'Błąd tworzenia notatki' });
    }
});

app.put('/api/notes/:id', authMiddleware, async (req, res) => {
    try {
        const { content, color, position } = req.body;
        const note = await Note.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { content, color, position },
            { new: true }
        );
        if (!note) return res.status(404).json({ message: "Nie znaleziono notatki" });
        res.json(note);
    } catch (error) {
        res.status(500).json({ message: 'Błąd aktualizacji notatki' });
    }
});


app.delete('/api/notes/:id', authMiddleware, async (req, res) => {
    try {
        const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
        if (!note) return res.status(404).json({ message: "Nie znaleziono notatki" });
        res.json({ message: "Notatka usunięta" });
    } catch (error) {
        res.status(500).json({ message: 'Błąd usuwania notatki' });
    }
});

// --- NOWE I ZAKTUALIZOWANE ENDPOINTY KANBAN ---

// --- NOWE I ZAKTUALIZOWANE ENDPOINTY KANBAN ---

app.get('/api/kanban/tasks', authMiddleware, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'administrator' && req.query.userId) {
            query = { authorId: req.query.userId };
        } else {
            query = { authorId: req.user.userId };
        }
        const tasks = await KanbanTask.find(query).sort({ date: -1 });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania zadań' });
    }
});

app.post('/api/kanban/tasks', authMiddleware, async (req, res) => {
    try {
        const { content, details, subtasks, priority, authorId, author } = req.body;
        
        const newTask = new KanbanTask({
            content,
            details: details || '',
            subtasks: subtasks || [],
            priority: priority || 'normal',
            status: 'todo',
            author: author,
            authorId: authorId,
            assignedTo: author, 
            assignedToId: authorId,
            isAccepted: true 
        });
        await newTask.save();
        res.status(201).json(newTask);
    } catch (error) {
        res.status(500).json({ message: 'Błąd tworzenia zadania' });
    }
});

app.put('/api/kanban/tasks/:id', authMiddleware, async (req, res) => {
    try {
        const { content, status, details, subtasks, priority } = req.body;
        const task = await KanbanTask.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ message: 'Nie znaleziono zadania' });
        }
        
        if (task.authorId.toString() !== req.user.userId && req.user.role !== 'administrator') {
            return res.status(403).json({ message: 'Brak uprawnień do edycji tego zadania' });
        }

        if (content !== undefined) task.content = content;
        if (status !== undefined) task.status = status;
        if (details !== undefined) task.details = details;
        if (subtasks !== undefined) task.subtasks = subtasks;
        if (priority !== undefined) task.priority = priority;

        const updatedTask = await task.save();
        res.json(updatedTask);
    } catch (error) {
        res.status(500).json({ message: 'Błąd aktualizacji zadania' });
    }
});

app.delete('/api/kanban/tasks/:id', authMiddleware, async (req, res) => {
    try {
        const task = await KanbanTask.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Nie znaleziono zadania' });

        if (task.authorId.toString() !== req.user.userId && req.user.role !== 'administrator') {
            return res.status(403).json({ message: 'Brak uprawnień do usunięcia zadania' });
        }
        
        await task.deleteOne();
        res.json({ message: 'Zadanie usunięte' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd usuwania zadania' });
    }
});




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
        const { destination, purpose, dateFrom, dateTo, notes, kms, advancePayment, transport, clients } = req.body;
        
        const geocodedClients = await Promise.all(
            (clients || []).map(async (client) => {
                const location = await geocodeAddress(client.address);
                return {
                    ...client,
                    lat: location ? location.lat : null,
                    lng: location ? location.lng : null,
                };
            })
        );

        const newDelegation = new Delegation({
            destination, purpose, dateFrom, dateTo, notes, kms, advancePayment, transport, 
            clients: geocodedClients,
            author: req.user.username,
            authorId: req.user.userId,
        });
        await newDelegation.save();
		const emailSubject = `Nowa delegacja do akceptacji: ${newDelegation.destination}`;
        const emailHtml = `
            <h1>Nowa delegacja czeka na akceptację</h1>
            <p><strong>Autor:</strong> ${newDelegation.author}</p>
            <p><strong>Cel:</strong> ${newDelegation.destination}</p>
            <p><strong>Termin:</strong> od ${new Date(newDelegation.dateFrom).toLocaleDateString()} do ${new Date(newDelegation.dateTo).toLocaleDateString()}</p>
            <p>Proszę o weryfikację w panelu.</p>
        `;
        sendNotificationEmail(emailSubject, emailHtml).catch(console.error);
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

app.put('/api/delegations/:id', authMiddleware, async (req, res) => {
    try {
        const delegationData = req.body;
        const updatedDelegation = await Delegation.findByIdAndUpdate(req.params.id, delegationData, { new: true });
        if (!updatedDelegation) return res.status(404).json({ message: 'Nie znaleziono delegacji.' });
        res.json({ message: 'Delegacja zaktualizowana!', delegation: updatedDelegation });
    } catch (error) {
        res.status(500).json({ message: 'Błąd aktualizacji delegacji' });
    }
});

app.delete('/api/delegations/:id', authMiddleware, async (req, res) => {
    try {
        const delegation = await Delegation.findById(req.params.id);
        if (!delegation) return res.status(404).json({ message: 'Nie znaleziono delegacji' });

        if (req.user.role !== 'administrator' && delegation.authorId.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Brak uprawnień do usunięcia tej delegacji' });
        }
        
        await delegation.deleteOne();
        res.json({ message: 'Delegacja usunięta' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd usuwania delegacji' });
    }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.post('/api/delegations/:id/start', authMiddleware, async (req, res) => {
    try {
        const delegation = await Delegation.findByIdAndUpdate(req.params.id, { startTime: new Date(), status: 'W trakcie' }, { new: true });
        if (!delegation) return res.status(404).json({ message: 'Nie znaleziono delegacji' });
        res.json(delegation);
    } catch (error) {
        res.status(500).json({ message: 'Błąd rozpoczęcia delegacji' });
    }
});

app.post('/api/delegations/:id/end', authMiddleware, async (req, res) => {
    try {
        const delegation = await Delegation.findByIdAndUpdate(req.params.id, { endTime: new Date(), status: 'Zakończona' }, { new: true });
        if (!delegation) return res.status(404).json({ message: 'Nie znaleziono delegacji' });
        res.json(delegation);
    } catch (error) {
        res.status(500).json({ message: 'Błąd zakończenia delegacji' });
    }
});

app.post('/api/delegations/:id/visits/:clientIndex/start', authMiddleware, async (req, res) => {
    try {
        const delegation = await Delegation.findById(req.params.id);
        if (!delegation) return res.status(404).json({ message: 'Nie znaleziono delegacji' });
        
        delegation.clients[req.params.clientIndex].startTime = new Date();
        await delegation.save();
        res.json(delegation);
    } catch (error) {
        res.status(500).json({ message: 'Błąd rozpoczęcia wizyty' });
    }
});

app.post('/api/delegations/:id/visits/:clientIndex/end', authMiddleware, async (req, res) => {
    try {
        const { visitNotes, ordered } = req.body;
        const delegation = await Delegation.findById(req.params.id);
        if (!delegation) return res.status(404).json({ message: 'Nie znaleziono delegacji' });

        const client = delegation.clients[req.params.clientIndex];
        client.endTime = new Date();
        client.visitNotes = visitNotes;
        client.ordered = ordered;
        
        await delegation.save();
        res.json(delegation);
    } catch (error) {
        res.status(500).json({ message: 'Błąd zakończenia wizyty' });
    }
});

// --- Start serwera ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});