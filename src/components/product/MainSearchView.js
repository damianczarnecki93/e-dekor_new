import React, { useState, useRef } from 'react';
import SearchView from './SearchView';
import ProductDetailsCard from './ProductDetailsCard';

const MainSearchView = () => {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const searchInputRef = useRef(null);

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        setTimeout(() => searchInputRef.current?.focus(), 0);
    };

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Szybkie Wyszukiwanie</h1>
            <SearchView onProductSelect={handleProductSelect} />
            {selectedProduct && <ProductDetailsCard product={selectedProduct} />}
        </div>
    );
};

export default MainSearchView;