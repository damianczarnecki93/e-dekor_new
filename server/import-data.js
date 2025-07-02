require('dotenv').config();
const fs = 'fs';
const path = 'path';
const mongoose = 'mongoose';
const csv = 'csv-parser';

// --- Definicja schematu produktu (musi być taka sama jak w server.js) ---
const productSchema = new mongoose.Schema({
    id: String,
    name: String,
    product_code: String,
    barcode: String,
    price: Number,
    quantity: Number,
    availability: Boolean
});

const Product = mongoose.model('Product', productSchema);

// --- Główna funkcja importująca ---
async function importData() {
    // Sprawdzenie, czy adres do bazy danych jest ustawiony
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('BŁĄD: Zmienna środowiskowa DATABASE_URL nie jest ustawiona!');
        process.exit(1);
    }

    try {
        // Połączenie z bazą danych
        await mongoose.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Połączono z MongoDB Atlas w celu importu danych...');

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
            } else {
                console.log(`Pominięto, plik nie istnieje: ${file}`);
            }
        }

        // 3. Zapisywanie nowych danych do bazy
        if (productsToImport.length > 0) {
            console.log(`Importowanie ${productsToImport.length} produktów do bazy danych...`);
            await Product.insertMany(productsToImport);
            console.log('Import zakończony sukcesem!');
        } else {
            console.log('Nie znaleziono produktów do importu.');
        }

    } catch (error) {
        console.error('Wystąpił błąd podczas importu:', error);
    } finally {
        // Zawsze zamykaj połączenie z bazą danych
        await mongoose.connection.close();
        console.log('Rozłączono z bazą danych.');
    }
}

// Uruchomienie funkcji importującej
importData();
