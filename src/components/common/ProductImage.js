import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

const ProductImage = ({ src, alt = 'Zdjęcie produktu', className = 'w-10 h-10', iconSize = 20 }) => {
    const [hasError, setHasError] = useState(false);

    if (!src || hasError) {
        return (
            <div className={`${className} bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-gray-400 flex-shrink-0 border border-gray-200 dark:border-gray-600`}>
                <ImageOff size={iconSize} />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            onError={() => setHasError(true)}
            className={`${className} object-cover rounded flex-shrink-0 border border-gray-200 dark:border-gray-600 bg-white`}
        />
    );
};

export default ProductImage;
