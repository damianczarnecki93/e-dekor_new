TEST ZMIAN - 23.07.2025
# System Zarządzania Magazynem

Prosta aplikacja Full-Stack (React + Node.js) do zarządzania magazynem, zamówieniami, kompletacją i inwentaryzacją.

## Funkcjonalności

-   Logowanie użytkowników (role: Użytkownik, Administrator)
-   Szybkie wyszukiwanie produktów
-   Tworzenie i zarządzanie zamówieniami
-   Kompletacja zamówień
-   Przeprowadzanie inwentaryzacji
-   Panel administratora do zarządzania bazą danych (pliki CSV)

## Struktura Projektu

-   **Frontend:** Folder główny, stworzony za pomocą `create-react-app`.
-   **Backend:** Folder `/server`, oparty na Node.js i Express.

---

## Instalacja i Uruchomienie Lokalne

### Wymagania

-   [Node.js](https://nodejs.org/) (wersja 16 lub nowsza)
-   [Git](https://git-scm.com/)

### Kroki

1.  **Klonuj repozytorium:**
    ```bash
    git clone [adres-twojego-repozytorium]
    cd system-magazynowy
    ```

2.  **Zainstaluj zależności frontendu:**
    ```bash
    npm install
    ```

3.  **Zainstaluj zależności backendu:**
    ```bash
    cd server
    npm install
    cd ..
    ```

4.  **Uruchom serwer backendu:**
    Otwórz jeden terminal i wykonaj:
    ```bash
    cd server
    node server.js
    ```
    Serwer powinien działać na `http://localhost:3001`.

5.  **Uruchom aplikację frontendu:**
    Otwórz **drugi** terminal i wykonaj:
    ```bash
    npm start
    ```
    Aplikacja otworzy się w przeglądarce pod adresem `http://localhost:3000`.

---

## Wdrożenie na Render.com

Projekt jest przygotowany do wdrożenia na platformie Render.

1.  **Backend (Web Service):**
    -   **Root Directory:** `server`
    -   **Build Command:** `npm install`
    -   **Start Command:** `node server.js`

2.  **Frontend (Static Site):**
    -   **Root Directory:** (pozostaw puste)
    -   **Build Command:** `npm install && npm run build`
    -   **Publish Directory:** `build`
    -   Dodaj **Rewrite Rule** dla `/*` do `/index.html`.
