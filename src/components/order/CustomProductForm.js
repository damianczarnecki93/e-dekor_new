import React, { useState } from 'react';

const CustomProductForm = ({ ean, onSubmit, onSkip }) => {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('0');

    const handleSubmit = (e) => {
        e.preventDefault();
        const finalName = name.trim() === '' ? 'produkt spoza listy' : name;
        const finalPrice = parseFloat(price) || 0;
        onSubmit({ name: finalName, price: finalPrice });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <p>Nie znaleziono produktu o kodzie EAN: <strong>{ean}</strong>. Możesz dodać go ręcznie.</p>
            <div>
                <label className="block mb-2 text-sm font-medium">Nazwa produktu (opcjonalnie)</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                    placeholder="produkt spoza listy"
                />
            </div>
            <div>
                <label className="block mb-2 text-sm font-medium">Cena (opcjonalnie)</label>
                <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                    placeholder="0.00"
                    step="0.01"
                />
            </div>
            <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={onSkip} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Pomiń</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz</button>
            </div>
        </form>
    );
};

export default CustomProductForm;