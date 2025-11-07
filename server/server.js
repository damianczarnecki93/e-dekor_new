// Ten plik jest używany tylko do uruchamiania serwera lokalnie.
// Dla środowiska produkcyjnego na Netlify, używana jest funkcja serwerowa.

const app = require('./app');

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Serwer lokalny działa na porcie ${PORT}`);
});