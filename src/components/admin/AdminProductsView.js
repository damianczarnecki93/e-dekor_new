import React, { useState, useEffect, useCallback } from 'react';
import { Upload, GitMerge } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';

const AdminProductsView = () => {
    const [products, setProducts] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();
    const [isUploading, setIsUploading] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [importMode, setImportMode] = useState('append');

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.getAllProducts(page, 20, search);
            setProducts(data.products);
            setTotalPages(data.totalPages);
            setTotalProducts(data.totalProducts);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [page, search, showNotification]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const result = await api.uploadProductsFile(file, importMode);
            showNotification(result.message, 'success');
            fetchProducts();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsUploading(false);
            e.target.value = null;
        }
    };

    const handleMergeProducts = async () => {
        if (window.confirm("Czy na pewno chcesz połączyć produkty? Ta operacja jest nieodwracalna i może znacząco zmienić bazę danych produktów.")) {
            setIsMerging(true);
            try {
                const result = await api.mergeProducts();
                showNotification(result.message, 'success');
                fetchProducts();
            } catch (error) {
                showNotification(error.message, 'error');
            } finally {
                setIsMerging(false);
            }
        }
    };

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-2xl font-semibold mb-4">Zarządzanie Produktami</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium mb-2">Synchronizuj bazę danych</h3>
                    <p className="text-sm text-gray-500 mb-2">Kolumny (Pełny): barcode, name, price, product_code, quantity, availability</p>
                    <p className="text-sm text-gray-500 mb-4">Kolumny (Tylko ilości): product_code, quantity</p>
                    <div className="flex flex-wrap justify-center gap-4 mb-4">
                        <label className="flex items-center"><input type="radio" name="importMode" value="append" checked={importMode === 'append'} onChange={() => setImportMode('append')} className="mr-2"/>Dopisz / Aktualizuj</label>
                        <label className="flex items-center"><input type="radio" name="importMode" value="update_quantity" checked={importMode === 'update_quantity'} onChange={() => setImportMode('update_quantity')} className="mr-2"/>Tylko ilości</label>
                        <label className="flex items-center"><input type="radio" name="importMode" value="overwrite" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} className="mr-2"/>Nadpisz wszystko</label>
                    </div>
                    <label className={`cursor-pointer w-full text-center block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <Upload className={`w-4 h-4 mr-2 inline-block ${isUploading ? 'animate-spin' : ''}`}/> {isUploading ? 'Przetwarzanie...' : 'Wybierz plik CSV'}
                        <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={isUploading} />
                    </label>
                </div>
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium mb-2">Operacje na danych</h3>
                    <p className="text-sm text-gray-500 mb-4">Połącz zduplikowane produkty (wg. kodu produktu) w jedną pozycję.</p>
                    <button onClick={handleMergeProducts} disabled={isMerging} className="flex items-center justify-center w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400">
                        <GitMerge className={`w-5 h-5 mr-2 ${isMerging ? 'animate-spin' : ''}`} />
                        {isMerging ? 'Przetwarzanie...' : 'Połącz produkty'}
                    </button>
                </div>
            </div>

            <h3 className="text-xl font-semibold mb-4">Wszystkie produkty w bazie ({totalProducts})</h3>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtruj produkty..." className="w-full max-w-lg p-3 mb-6 bg-white dark:bg-gray-700 border rounded-lg"/>
            <div className="space-y-4 lg:space-y-0 lg:bg-white lg:dark:bg-gray-800 lg:rounded-lg lg:shadow">
                <div className="hidden lg:grid grid-cols-12 gap-4 font-bold p-3 bg-gray-50 dark:bg-gray-700 rounded-t-lg">
                    <div className="col-span-4">Nazwa</div>
                    <div className="col-span-3">Kod produktu</div>
                    <div className="col-span-3">Kody EAN</div>
                    <div className="col-span-1 text-center">Ilość</div>
                    <div className="col-span-1 text-right">Cena</div>
                </div>
                <div className="lg:divide-y lg:divide-gray-200 lg:dark:divide-gray-700">
                    {isLoading ? <div className="text-center p-8">Ładowanie...</div> :
                    products.map(p => (
                        <div key={p._id} className="bg-white dark:bg-gray-800 rounded-lg shadow lg:shadow-none lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center p-4 lg:p-3">
                            <div className="lg:hidden">
                                <h3 className="font-bold text-lg">{p.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{p.product_code}</p>
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <div><span className="font-bold text-lg">{p.price?.toFixed(2)} PLN</span></div>
                                    <div><span className="text-sm">Ilość: </span><span className="font-bold">{p.quantity}</span></div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 truncate">EAN: {p.barcodes.join(', ')}</p>
                            </div>
                            <div className="hidden lg:block col-span-4">{p.name}</div>
                            <div className="hidden lg:block col-span-3">{p.product_code}</div>
                            <div className="hidden lg:block col-span-3 text-sm text-gray-500 truncate">{p.barcodes.join(', ')}</div>
                            <div className="hidden lg:block col-span-1 text-center">{p.quantity}</div>
                            <div className="hidden lg:block col-span-1 text-right">{p.price?.toFixed(2)} PLN</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex justify-between items-center mt-4">
                <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg disabled:opacity-50">Poprzednia</button>
                <span>Strona {page} z {totalPages}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg disabled:opacity-50">Następna</button>
            </div>
        </div>
    );
};

export default AdminProductsView;