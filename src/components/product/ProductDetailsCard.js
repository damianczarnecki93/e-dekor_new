import React from 'react';

const ProductDetailsCard = ({ product }) => (
    <div className="mt-6 max-w-4xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in">
        <h2 className="text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">{product.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
            <div><strong>Kod produktu:</strong> {product.product_code || 'Brak'}</div>
            <div><strong>Kody EAN:</strong> {(product.barcodes || []).join(', ') || 'Brak'}</div>
            <div><strong>Cena:</strong> {product.price?.toFixed(2) || '0.00'} PLN</div>
            <div><strong>Ilość na stanie:</strong> {product.quantity || 0}</div>
        </div>
    </div>
);

export default ProductDetailsCard;