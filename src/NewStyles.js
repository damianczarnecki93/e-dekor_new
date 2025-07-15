/* src/NewStyles.css */

/* Definicja nowoczesnej palety kolorów i zmiennych */
:root {
    --primary-color: #4f46e5; /* Indigo */
    --primary-hover: #4338ca;
    --secondary-color: #10b981; /* Emerald */
    --secondary-hover: #059669;
    --danger-color: #ef4444; /* Red */
    --danger-hover: #dc2626;
    --background-light: #f9fafb; /* Very light gray */
    --background-dark: #111827; /* Very dark gray */
    --text-light: #1f2937; /* Dark gray */
    --text-dark: #f9fafb; /* Very light gray */
    --card-bg-light: #ffffff;
    --card-bg-dark: #1f2937;
    --border-light: #e5e7eb;
    --border-dark: #374151;
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

/* Podstawowe style dla body */
body {
    font-family: var(--font-sans);
    background-color: var(--background-light);
    color: var(--text-light);
    transition: background-color 0.3s, color 0.3s;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

/* Style dla trybu ciemnego */
.dark body {
    background-color: var(--background-dark);
    color: var(--text-dark);
}

/* Globalne style dla kontenera aplikacji */
.app-container {
    display: flex;
    height: 100vh;
    background-color: var(--background-light);
}

.dark .app-container {
    background-color: var(--background-dark);
}

/* Nowoczesny pasek boczny */
.sidebar {
    width: 260px;
    background-color: var(--card-bg-light);
    border-right: 1px solid var(--border-light);
    transition: background-color 0.3s, border-color 0.3s;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
}

.dark .sidebar {
    background-color: var(--card-bg-dark);
    border-right-color: var(--border-dark);
}

/* Logo w pasku bocznym */
.sidebar-logo {
    padding: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--border-light);
}

.dark .sidebar-logo {
    border-bottom-color: var(--border-dark);
}

/* Nawigacja */
.nav-list {
    flex-grow: 1;
    padding: 1rem 0;
}

.nav-item {
    display: flex;
    align-items: center;
    padding: 0.75rem 1.5rem;
    margin: 0.25rem 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    color: #4b5563; /* Gray-600 */
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;
}

.dark .nav-item {
    color: #d1d5db; /* Gray-300 */
}

.nav-item:hover {
    background-color: #f3f4f6; /* Gray-100 */
    color: var(--primary-color);
}

.dark .nav-item:hover {
    background-color: #374151; /* Gray-700 */
    color: white;
}

.nav-item.active {
    background-color: var(--primary-color);
    color: white;
    box-shadow: var(--shadow-md);
}

.dark .nav-item.active {
    background-color: var(--primary-color);
}

.nav-item svg {
    margin-right: 0.75rem;
}

/* Główna treść */
.main-content {
    flex-grow: 1;
    overflow-y: auto;
    padding: 2rem;
}

/* Nagłówki */
h1, h2, h3 {
    font-weight: 700;
    color: var(--text-light);
}
.dark h1, .dark h2, .dark h3 {
    color: var(--text-dark);
}

h1 { font-size: 2.25rem; }
h2 { font-size: 1.5rem; }
h3 { font-size: 1.25rem; }

/* Przyciski */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.6rem 1.2rem;
    border-radius: 0.5rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
}
.btn:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
}
.btn-primary {
    background-color: var(--primary-color);
    color: white;
}
.btn-primary:hover {
    background-color: var(--primary-hover);
}
.btn-secondary {
    background-color: var(--secondary-color);
    color: white;
}
.btn-secondary:hover {
    background-color: var(--secondary-hover);
}
.btn-danger {
    background-color: var(--danger-color);
    color: white;
}
.btn-danger:hover {
    background-color: var(--danger-hover);
}
.btn-ghost {
    background-color: transparent;
    color: var(--text-light);
}
.dark .btn-ghost {
    color: var(--text-dark);
}
.btn-ghost:hover {
    background-color: #f3f4f6;
}
.dark .btn-ghost:hover {
    background-color: #374151;
}

/* Formularze */
.form-input, .form-textarea, .form-select {
    width: 100%;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-light);
    background-color: #f9fafb;
    transition: border-color 0.2s, box-shadow 0.2s;
}
.dark .form-input, .dark .form-textarea, .dark .form-select {
    background-color: #374151;
    border-color: #4b5563;
    color: white;
}
.form-input:focus, .form-textarea:focus, .form-select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3);
}

/* Karty */
.card {
    background-color: var(--card-bg-light);
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: var(--shadow-md);
    transition: all 0.3s;
}
.dark .card {
    background-color: var(--card-bg-dark);
}
.card:hover {
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
}

/* Tabela */
.table-container {
    background-color: var(--card-bg-light);
    border-radius: 0.75rem;
    overflow: hidden;
    box-shadow: var(--shadow-md);
}
.dark .table-container {
    background-color: var(--card-bg-dark);
}
.table {
    width: 100%;
    border-collapse: collapse;
}
.table th, .table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border-light);
}
.dark .table th, .dark .table td {
    border-bottom-color: var(--border-dark);
}
.table thead {
    background-color: #f9fafb;
}
.dark .table thead {
    background-color: #374151;
}

/* Responsywność */
@media (max-width: 768px) {
    .sidebar {
        position: fixed;
        transform: translateX(-100%);
        z-index: 1000;
        height: 100%;
        transition: transform 0.3s ease-in-out;
    }
    .sidebar.open {
        transform: translateX(0);
    }
    .main-content {
        padding: 1rem;
    }
    h1 { font-size: 1.75rem; }
    h2 { font-size: 1.25rem; }
}
