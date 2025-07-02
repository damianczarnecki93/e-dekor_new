// server/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
app.use(cors());
app.use(express.json());

let products = [];

const loadProducts = () => {
    products = [];
    const files = ['produkty.csv', 'produkty2.csv'];
    let filesProcessed = 0;

    files.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => {
                    products.push({
                        ...data,
                        id: data.id || data.barcode,
                        price: parseFloat(data.price) || 0,
                        quantity: parseInt(data.quantity) || 0,
                        availability: (data.availability || 'true').toLowerCase() === 'true'
                    });
                })
                .on('end', () => {
                    filesProcessed++;
                    if (filesProcessed === files.length) {
                        console.log('Wszystkie produkty załadowane.');
                    }
                });
        } else {
             console.log(`Plik ${file} nie znaleziony.`);
             filesProcessed++;
        }
    });
};

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        return res.json({ user: { username: 'admin', role: 'administrator' }, token: 'mock-jwt-token-admin' });
    }
    if (username === 'user' && password === 'user123') {
        return res.json({ user: { username: 'user', role: 'user' }, token: 'mock-jwt-token-user' });
    }
    return res.status(401).json({ message: 'Nieprawidłowe dane logowania' });
});

app.get('/api/products', (req, res) => {
    res.json(products);
});

// TODO: Zaimplementować resztę endpointów (zamówienia, upload, etc.)

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
    loadProducts();
});
