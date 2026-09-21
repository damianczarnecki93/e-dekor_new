import React from 'react';
import ProductImage from '../common/ProductImage';

const ProductDetailsCard = ({ product }) => (
    <div className="mt-6 max-w-4xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg animate-fade-in">
        <div className="flex flex-col sm:flex-row gap-6 items-start mb-6">
            <div className="w-full sm:w-48 h-48 flex-shrink-0 flex justify-center items-center bg-gray-50 dark:bg-gray-700 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
                <ProductImage
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full max-h-44 object-contain rounded"
                    iconSize={48}
                />
            </div>
            <div className="flex-1 space-y-3">
                <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{product.name}</h2>
                {product.polish_name && product.polish_name !== product.name && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">{product.polish_name}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-300">
                    <div><strong>Kod produktu:</strong> {product.product_code || 'Brak'}</div>
                    <div><strong>Kody EAN:</strong> {(product.barcodes || []).join(', ') || 'Brak'}</div>
                    <div><strong>Cena:</strong> {product.price?.toFixed(2) || '0.00'} PLN</div>
                    <div><strong>Ilość na stanie:</strong> {product.quantity ?? 0}</div>
                </div>
            </div>
        </div>

        {product.description && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Opis produktu:</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    {product.description}
                </p>
            </div>
        )}
    </div>
);

export default ProductDetailsCard;
