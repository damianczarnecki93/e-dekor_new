// Ten plik jest "bramą" dla Netlify do uruchomienia Twojego serwera Express.

const serverless = require('serverless-http');
const app = require('../../server/app'); // Ścieżka do Twojej aplikacji Express

// Eksportujemy handler, który Netlify może uruchomić
module.exports.handler = serverless(app);