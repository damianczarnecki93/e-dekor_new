const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const multer = require('multer'); // Do obsługi uploadu plików

const app = express();
app.use(cors());
app.use(express.json());

// --- Zmienne przechowujące dane w pamięci ---
let products = [];
let orders = []; // Dodajemy tablicę na zamówienia

// --- Wczytywanie produktów z plików CSV ---
const loadProducts = () => {
    const tempProducts = [];
    const files = ['produkty.csv', 'produkty2.csv'];
    let filesToProcess = files.length;

    if (filesToProcess === 0) {
        console.log('Brak plików CSV do przetworzenia.');
        return;
    }

    files.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => {
                    tempProducts.push({
                        ...data,
                        id: data.id || data.barcode,
                        price: parseFloat(data.price) || 0,
                        quantity: parseInt(data.quantity) || 0,
                        availability: (data.availability || 'true').toLowerCase() === 'true'
                    });
                })
                .on('end', () => {
                    filesToProcess--;
                    if (filesToProcess === 0) {
                        products = tempProducts;
                        console.log(`Załadowano ${products.length} produktów.`);
                    }
                })
                .on('error', (error) => {
                    console.error(`Błąd podczas wczytywania pliku ${file}:`, error);
                    filesToProcess--;
                });
        } else {
            console.log(`Plik ${file} nie znaleziony.`);
            filesToProcess--;
        }
    });
};

// --- API Endpoints ---

// Endpoint logowania - ZAWSZE zwraca JSON
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`Próba logowania dla użytkownika: ${username}`);

    if (username === 'admin' && password === 'admin123') {
        console.log('Logowanie admina udane.');
        return res.status(200).json({ 
            user: { username: 'admin', role: 'administrator' }, 
            token: 'mock-jwt-token-for-admin' 
        });
    }
    if (username === 'user' && password === 'user123') {
        console.log('Logowanie użytkownika udane.');
        return res.status(200).json({ 
            user: { username: 'user', role: 'user' }, 
            token: 'mock-jwt-token-for-user' 
        });
    }
    
    console.log('Logowanie nieudane - nieprawidłowe dane.');
    // Zawsze zwracaj błąd w formacie JSON
    return res.status(401).json({ message: 'Nieprawidłowe dane logowania' });
});

// Endpoint zwracający produkty
app.get('/api/products', (req, res) => {
    res.status(200).json(products);
});

// Endpoint do zapisywania zamówień
app.post('/api/orders', (req, res) => {
    const newOrder = req.body;
    newOrder.id = `ZAM-${Date.now()}`;
    newOrder.date = new Date().toISOString();
    newOrder.status = 'Zapisane'; // Domyślny status
    orders.push(newOrder);
    console.log('Zapisano nowe zamówienie:', newOrder.id);
    res.status(201).json({ message: 'Zamówienie zapisane!', order: newOrder });
});

// Endpoint do pobierania zamówień
app.get('/api/orders', (req, res) => {
    res.status(200).json(orders);
});

// Endpoint do wgrywania plików (dla panelu admina)
const upload = multer({ dest: 'uploads/' }); // Pliki będą tymczasowo w folderze /uploads
app.post('/api/admin/upload', upload.single('products'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Nie wybrano pliku.' });
    }
    console.log('Otrzymano plik:', req.file.originalname);
    // Tutaj powinna być logika przetwarzania pliku i aktualizacji bazy `products`
    // Po przetworzeniu, można ponownie załadować produkty
    loadProducts();
    res.status(200).json({ message: `Plik ${req.file.originalname} został wgrany.` });
});


// --- Start serwera ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
    loadProducts(); // Wczytaj produkty przy starcie
});
```
Po podmianie tego pliku i ponownym wdrożeniu, problem z logowaniem powinien ostatecznie znikn
