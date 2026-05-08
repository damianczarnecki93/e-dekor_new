# Instrukcja Wdrożenia: Frontend (Vercel) & Backend (Koyeb)

Ta instrukcja opisuje proces przeniesienia aplikacji z monorepo na dwie niezależne platformy: **Vercel** dla części klienckiej (React) oraz **Koyeb** dla części serwerowej (Node.js/Express).

---

## Krok 1: Przygotowanie Bazy Danych (MongoDB Atlas)

Jeśli Twoja baza danych nie jest jeszcze w chmurze:
1. Załóż darmowe konto na [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Stwórz nowy Cluster i bazę danych.
3. W sekcji "Database Access" stwórz użytkownika.
4. W sekcji "Network Access" dodaj adres IP `0.0.0.0/0` (Koyeb wymaga dostępu z różnych adresów IP).
5. Skopiuj swój **Connection String** (np. `mongodb+srv://...`).

---

## Krok 2: Backend na platformie Koyeb

Platforma Koyeb będzie obsługiwać Twój serwer Express znajdujący się w folderze `/server`.

1. Zaloguj się na [Koyeb](https://app.koyeb.com/).
2. Kliknij **Create Service**.
3. Wybierz **GitHub** jako źródło i wskaż swoje repozytorium.
4. W ustawieniach serwisu:
   - **Build Command**: `cd server && npm install`
   - **Run Command**: `cd server && npm start` (Koyeb powinien też automatycznie wykryć `Procfile`).
   - **Port**: `10000` (lub inny, jeśli zmienisz go w zmiennych środowiskowych).
5. Dodaj **Zmienne Środowiskowe (Environment Variables)**:
   - `DATABASE_URL`: Twój link do MongoDB Atlas.
   - `JWT_SECRET`: Dowolny, bezpieczny ciąg znaków.
   - `ALLOWED_ORIGINS`: Adres Twojego frontendu na Vercel (np. `https://twoja-aplikacja.vercel.app`). Możesz też wpisać `*` dla testów, ale docelowo podaj adres Vercel.
   - `VAPID_PUBLIC_KEY`: Klucz publiczny dla powiadomień.
   - `VAPID_PRIVATE_KEY`: Klucz prywatny dla powiadomień.
   - `VAPID_CONTACT_EMAIL`: Twój e-mail (np. `mailto:kontakt@example.com`).
   - `Maps_API_KEY`: Klucz Google Maps.
6. Po zakończeniu wdrożenia skopiuj adres publiczny swojej aplikacji na Koyeb (np. `https://twoja-aplikacja.koyeb.app`).

---

## Krok 3: Frontend na platformie Vercel

Vercel obsłuży Twój frontend stworzony w React.

1. Zaloguj się na [Vercel](https://vercel.com/).
2. Kliknij **Add New** -> **Project**.
3. Wybierz swoje repozytorium z GitHub.
4. W sekcji **Build & Development Settings**:
   - **Framework Preset**: `Create React App` (powinno wykryć automatycznie).
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
5. Dodaj **Zmienne Środowiskowe (Environment Variables)**:
   - `REACT_APP_API_URL`: Wklej tutaj adres skopiowany z **Koyeb** (pamiętaj o `https://` na początku i braku `/` na końcu, np. `https://twoja-aplikacja.koyeb.app`).
   - `REACT_APP_VAPID_PUBLIC_KEY`: Ten sam klucz publiczny VAPID, który dodałeś na Koyeb.
6. Kliknij **Deploy**.

---

## Krok 4: Weryfikacja

1. Otwórz adres swojej aplikacji na Vercel.
2. Spróbuj się zalogować lub zarejestrować.
3. Sprawdź w konsoli przeglądarki (F12), czy zapytania API trafiają pod właściwy adres (Twój adres na Koyeb).
4. Jeśli widzisz błąd CORS, upewnij się, że na Koyeb zmienna `ALLOWED_ORIGINS` zawiera dokładny adres Twojej strony na Vercel.

---

## Podsumowanie zmian w kodzie

W ramach przygotowań zostały wprowadzone następujące zmiany:
- `vercel.json`: Obsługa routingu SPA (aby odświeżanie strony działało poprawnie).
- `Procfile`: Instrukcja startowa dla Koyeb.
- `src/api/index.js`: Dynamiczny adres API oparty na zmiennej środowiskowej.
- `server/app.js`: Dynamiczna konfiguracja CORS.
- `server/package.json`: Kompletna lista bibliotek wymaganych przez serwer.
