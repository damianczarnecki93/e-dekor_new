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
const webPush = require('web-push');

const app = express();
const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

// --- Web Push Configuration ---
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(
        `mailto:${process.env.VAPID_EMAIL || 'test@example.com'}`,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
    console.log("Web Push configured.");
} else {
    console.warn("VAPID keys are not set in .env. Push notifications will be disabled.");
}

// --- Database Configuration & Connection ---
const dbUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';

if (!dbUrl) {
    console.error('CRITICAL ERROR: DATABASE_URL environment variable is not set!');
    process.exit(1);
}

mongoose.connect(dbUrl)
    .then(() => console.log('Connected to MongoDB Atlas!'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Schema & Model Definitions ---

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user', enum: ['user', 'administrator'] },
    status: { type: String, enum: ['oczekujący', 'zaakceptowany'], default: 'oczekujący' },
    salesGoal: { type: Number, default: 0 },
    manualSales: { type: Number, default: 0 },
    visibleModules: { type: [String], default: [] },
    dashboardLayout: { type: [String], default: ['stats_products', 'stats_pending_orders', 'stats_completed_orders', 'quick_actions', 'my_tasks'] },
    pushNotificationsEnabled: { type: Boolean, default: true }
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

const pushSubscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subscription: {
        endpoint: { type: String, required: true, unique: true },
        expirationTime: { type: Date, default: null },
        keys: {
            p256dh: { type: String, required: true },
            auth: { type: String, required: true },
        },
    },
});
const PushSubscription = mongoose.models.PushSubscription || mongoose.model('PushSubscription', pushSubscriptionSchema);

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
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    author: String,
    items: Array,
    total: Number,
    status: { type: String, default: 'Zapisane', enum: ['Zapisane', 'Skompletowane', 'Zakończono', 'Braki'] },
    date: { type: Date, default: Date.now },
    isDirty: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false }
});
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

// ... other schemas ...
const inventorySchema = new mongoose.Schema({ name: { type: String, required: true }, author: String, items: Array, totalItems: Number, totalQuantity: Number, date: { type: Date, default: Date.now }, isDirty: { type: Boolean, default: false } });
const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
const noteSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, content: String, color: String, position: { x: Number, y: Number }, date: { type: Date, default: Date.now } });
const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
const kanbanTaskSchema = new mongoose.Schema({ content: { type: String, required: true }, status: { type: String, required: true, enum: ['todo', 'inprogress', 'done'], default: 'todo' }, author: String, authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, assignedTo: String, assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, date: { type: Date, default: Date.now }, isAccepted: { type: Boolean, default: false }, details: { type: String, default: '' }, subtasks: [{ content: String, isDone: { type: Boolean, default: false } }] });
const KanbanTask = mongoose.models.KanbanTask || mongoose.model('KanbanTask', kanbanTaskSchema);
const delegationSchema = new mongoose.Schema({ destination: { type: String, required: true }, purpose: { type: String, required: true }, dateFrom: { type: Date, required: true }, dateTo: { type: Date, required: true }, author: String, authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, status: { type: String, enum: ['Oczekująca', 'Zaakceptowana', 'Odrzucona', 'W trakcie', 'Zakończona'], default: 'Oczekująca' }, notes: String, kms: Number, advancePayment: Number, transport: String, clients: [{ name: String, address: String, lat: Number, lng: Number, note: String, startTime: Date, endTime: Date, visitNotes: String, ordered: Boolean, }], startTime: Date, endTime: Date });
const Delegation = mongoose.models.Delegation || mongoose.model('Delegation', delegationSchema);
const emailConfigSchema = new mongoose.Schema({ host: { type: String, required: true }, port: { type: Number, required: true }, secure: { type: Boolean, default: true }, user: { type: String, required: true }, pass: { type: String, required: true }, recipientEmail: { type: String, required: true }, });
const EmailConfig = mongoose.models.EmailConfig || mongoose.model('EmailConfig', emailConfigSchema);
const contactSchema = new mongoose.Schema({ name: { type: String, required: true }, company: String, email: String, phone: String, address: String, status: { type: String, default: 'Lead', enum: ['Lead', 'Klient', 'Utracony', 'Partner'] }, notes: String, ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, accountManager: { type: String }, createdAt: { type: Date, default: Date.now } });
const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);

// --- Middleware ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ message: 'Brak tokenu, autoryzacja odrzucona.' });
    try {
        const token = authHeader.split(' ')[1];
        req.user = jwt.verify(token, jwtSecret);
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token jest nieprawidłowy.' });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'administrator') next();
    else res.status(403).json({ message: 'Brak uprawnień administratora.' });
};

// --- Helper Functions (Email, CSV, Geocoding) ---
async function sendNotificationEmail(subject, htmlContent) { /* ... implementation ... */ }
const parseCsv = (buffer) => { /* ... implementation ... */ };
async function geocodeAddress(address) { /* ... implementation ... */ }

// --- API Endpoints ---

// Push Notifications
app.get('/api/push/vapid-public-key', authMiddleware, (req, res) => {
    if (!process.env.VAPID_PUBLIC_KEY) return res.status(500).json({ message: "Klucz VAPID nie jest skonfigurowany na serwerze." });
    res.send(process.env.VAPID_PUBLIC_KEY);
});

app.post('/api/push/subscribe', authMiddleware, async (req, res) => {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) return res.status(400).json({ message: "Nieprawidłowy obiekt subskrypcji." });
    try {
        await PushSubscription.findOneAndUpdate({ 'subscription.endpoint': subscription.endpoint }, { userId: req.user.userId, subscription }, { upsert: true });
        res.status(201).json({ message: 'Subskrypcja zapisana.' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd zapisu subskrypcji.', error: error.message });
    }
});

app.post('/api/push/unsubscribe', authMiddleware, async (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ message: "Brakujący endpoint subskrypcji." });
    try {
        await PushSubscription.findOneAndDelete({ 'subscription.endpoint': endpoint, userId: req.user.userId });
        res.status(200).json({ message: 'Subskrypcja usunięta.' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd usuwania subskrypcji.', error: error.message });
    }
});

// Orders
app.put('/api/orders/:id/status', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Zapisane', 'Skompletowane', 'Zakończono', 'Braki'].includes(status)) return res.status(400).json({ message: 'Nieprawidłowy status.' });

        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!updatedOrder) return res.status(404).json({ message: 'Nie znaleziono zamówienia.' });

        if (status === 'Zakończono') {
            const emailSubject = `Zamówienie dla ${updatedOrder.customerName} zostało zakończone`;
            const emailHtml = `<p>Zamówienie dla ${updatedOrder.customerName} zostało zakończone przez ${req.user.username}.</p>`;
            sendNotificationEmail(emailSubject, emailHtml).catch(console.error);

            try {
                const usersToNotify = await User.find({ pushNotificationsEnabled: true });
                const userIds = usersToNotify.map(u => u._id);
                const subscriptions = await PushSubscription.find({ userId: { $in: userIds } });

                const notificationPayload = JSON.stringify({
                    title: 'Zamówienie zakończone',
                    body: `Zamówienie dla ${updatedOrder.customerName} zostało zakończone przez ${req.user.username}.`,
                    data: { url: '/orders' }
                });

                const sendPromises = subscriptions.map(sub =>
                    webPush.sendNotification(sub.subscription, notificationPayload)
                        .catch(err => {
                            if (err.statusCode === 410) {
                                return PushSubscription.findByIdAndDelete(sub._id);
                            }
                            console.error('Błąd wysyłania powiadomienia:', err.statusCode);
                        })
                );
                await Promise.all(sendPromises);
            } catch (pushError) {
                console.error("Błąd podczas wysyłania powiadomień push:", pushError);
            }
        }
        res.json({ message: 'Status zamówienia zaktualizowany!', order: updatedOrder });
    } catch (error) {
        res.status(400).json({ message: 'Błąd aktualizacji statusu', error: error.message });
    }
});

// ... other existing endpoints ...
app.post('/api/register', async (req, res) => { /* ... */ });
app.post('/api/login', async (req, res) => { /* ... */ });
app.get('/api/products', authMiddleware, async (req, res) => { /* ... */ });
app.get('/api/pwa/all-products', authMiddleware, async (req, res) => {
    try {
        const products = await Product.find({});
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: 'Błąd pobierania wszystkich produktów dla PWA', error: error.message });
    }
});
// ... and so on for all other endpoints

// Serve React App
const buildPath = path.join(__dirname, '..', 'build');
app.use(express.static(buildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// --- Server Start ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});