import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';

const EditProductModal = ({ isOpen, onClose, itemData, onSave }) => {
    const [editedItem, setEditedItem] = useState(null);

    useEffect(() => {
        if (itemData) {
            setEditedItem({
                ...itemData,
                barcodes: Array.isArray(itemData.barcodes) ? itemData.barcodes.join(', ') : ''
            });
        }
    }, [itemData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditedItem(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        const finalItem = {
            ...editedItem,
            barcodes: editedItem.barcodes.split(',').map(b => b.trim()).filter(b => b),
            price: parseFloat(editedItem.price) || 0,
            quantity: parseInt(editedItem.quantity, 10) || 0
        };
        onSave(finalItem);
        onClose();
    };

    if (!isOpen || !editedItem) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edytuj pozycję" maxWidth="lg">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Nazwa</label>
                    <input type="text" name="name" value={editedItem.name} onChange={handleChange} className="w-full p-2 border rounded-md bg-white dark:bg-gray-700" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Kod produktu</label>
                        <input type="text" name="product_code" value={editedItem.product_code} onChange={handleChange} className="w-full p-2 border rounded-md bg-white dark:bg-gray-700" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Kody EAN (oddzielone przecinkami)</label>
                        <input type="text" name="barcodes" value={editedItem.barcodes} onChange={handleChange} className="w-full p-2 border rounded-md bg-white dark:bg-gray-700" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Cena</label>
                        <input type="number" step="0.01" name="price" value={editedItem.price} onChange={handleChange} className="w-full p-2 border rounded-md bg-white dark:bg-gray-700" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Ilość</label>
                        <input type="number" name="quantity" value={editedItem.quantity} onChange={handleChange} className="w-full p-2 border rounded-md bg-white dark:bg-gray-700" />
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Anuluj</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Zapisz zmiany</button>
                </div>
            </div>
        </Modal>
    );
};

export default EditProductModal;