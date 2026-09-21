import React from 'react';
import Modal from './Modal';
import ProductImage from './ProductImage';

const ProductDetailsModal = ({ product, isOpen, onClose }) => {
    if (!product) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Szczegóły produktu" maxWidth="2xl">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="w-full sm:w-48 h-48 flex-shrink-0 flex justify-center items-center bg-gray-50 dark:bg-gray-700 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
                        <ProductImage
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full max-h-44 object-contain rounded"
                            iconSize={48}
                        />
                    </div>
                    <div className="flex-1 space-y-3">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{product.name}</h2>
                        {product.polish_name && product.polish_name !== product.name && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">{product.polish_name}</p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <div>
                                <span className="font-semibold">Kod produktu:</span> {product.product_code || 'Brak'}
                            </div>
                            <div>
                                <span className="font-semibold">Cena:</span> {product.price !== undefined ? `${Number(product.price).toFixed(2)} PLN` : '0.00 PLN'}
                            </div>
                            <div>
                                <span className="font-semibold">Ilość na stanie:</span> {product.quantity ?? 0}
                            </div>
                            <div>
                                <span className="font-semibold">Kategoria:</span> {product.category || 'Brak'}
                            </div>
                        </div>

                        {product.barcodes && product.barcodes.length > 0 && (
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-semibold">Kody EAN:</span> {product.barcodes.join(', ')}
                            </div>
                        )}
                    </div>
                </div>

                {product.description ? (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Opis produktu:</h3>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            {product.description}
                        </p>
                    </div>
                ) : (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-400 italic">
                        Brak opisu dla tego produktu.
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ProductDetailsModal;
