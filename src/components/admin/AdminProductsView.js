import React, { useState, useEffect, useCallback } from 'react';
import { Upload, GitMerge, Info, Percent } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';
import ProductImage from '../common/ProductImage';
import ProductDetailsModal from '../common/ProductDetailsModal';
import { synchronizeData } from '../../data/synchronization';

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
    const [selectedProductModal, setSelectedProductModal] = useState(null);
    const [discount, setDiscount] = useState('0');
    const [isSavingDiscount, setIsSavingDiscount] = useState(false);

    useEffect(() => {
        const fetchDiscount = async () => {
            try {
                const data = await api.getProductDiscount();
                if (data && data.discount !== undefined) {
                    setDiscount(String(data.discount));
                }
            } catch (error) {
                console.error("Błąd pobierania rabatu:", error);
            }
        };
        fetchDiscount();
    }, []);

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

    const handleSaveDiscount = async (e) => {
        e.preventDefault();
        setIsSavingDiscount(true);
        try {
            const val = parseFloat(discount) || 0;
            const result = await api.updateProductDiscount(val);
            showNotification(result.message, 'success');
            fetchProducts();
            synchronizeData(() => {}).catch(() => {});
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsSavingDiscount(false);
        }
    };

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-2xl font-semibold mb-4">Zarządzanie Produktami</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium mb-2 flex items-center">
                        <Percent className="w-5 h-5 mr-2 text-indigo-500" />
                        Domyślny rabat cennika
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                        Wprowadź domyślny rabat w % dla całego cennika produktów. Wartości dodatnie obniżają cenę, ujemne nakładają narzut, a 0 przywraca cennik oryginalny.
                    </p>
                    <form onSubmit={handleSaveDiscount} className="space-y-4">
                        <div>
                            <label htmlFor="price-discount-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Rabat na cennik (%)
                            </label>
                            <div className="relative rounded-md shadow-sm">
                                <input
                                    id="price-discount-input"
                                    type="number"
                                    step="0.01"
                                    value={discount}
                                    onChange={(e) => setDiscount(e.target.value)}
                                    placeholder="0"
                                    className="w-full p-2.5 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-500 font-bold">
                                    %
                                </div>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isSavingDiscount}
                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 font-medium transition-colors"
                        >
                            {isSavingDiscount ? 'Zapisywanie...' : 'Zapisz rabat'}
                        </button>
                    </form>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium mb-2">Synchronizuj bazę danych</h3>
                    <p className="text-sm text-gray-500 mb-1">Kolumny (Pełny): barcode, name, price, product_code, quantity, availability</p>
                    <p className="text-sm text-gray-500 mb-1">Kolumny (Tylko ilości): product_code, quantity</p>
                    <p className="text-sm text-gray-500 mb-4">Kolumny (Opisy i zdjęcia): product_code, barcode, description, image</p>
                    <div className="flex flex-wrap justify-center gap-4 mb-4 text-sm">
                        <label className="flex items-center"><input type="radio" name="importMode" value="append" checked={importMode === 'append'} onChange={() => setImportMode('append')} className="mr-2"/>Dopisz / Aktualizuj</label>
                        <label className="flex items-center"><input type="radio" name="importMode" value="update_quantity" checked={importMode === 'update_quantity'} onChange={() => setImportMode('update_quantity')} className="mr-2"/>Tylko ilości</label>
                        <label className="flex items-center"><input type="radio" name="importMode" value="update_details" checked={importMode === 'update_details'} onChange={() => setImportMode('update_details')} className="mr-2"/>Opisy i zdjęcia</label>
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
                <div className="hidden lg:grid grid-cols-12 gap-4 font-bold p-3 bg-gray-50 dark:bg-gray-700 rounded-t-lg items-center">
                    <div className="col-span-1 text-center">Foto</div>
                    <div className="col-span-4">Nazwa</div>
                    <div className="col-span-2">Kod produktu</div>
                    <div className="col-span-2">Kody EAN</div>
                    <div className="col-span-1 text-center">Ilość</div>
                    <div className="col-span-1 text-right">Cena</div>
                    <div className="col-span-1 text-center">Info</div>
                </div>
                <div className="lg:divide-y lg:divide-gray-200 lg:dark:divide-gray-700">
                    {isLoading ? <div className="text-center p-8">Ładowanie...</div> :
                    products.map(p => (
                        <div key={p._id} className="bg-white dark:bg-gray-800 rounded-lg shadow lg:shadow-none lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center p-4 lg:p-3">
                            <div className="lg:hidden flex justify-between items-start">
                                <div className="flex gap-3 items-center">
                                    <ProductImage src={p.image} alt={p.name} className="w-12 h-12" iconSize={20} />
                                    <div>
                                        <h3 className="font-bold text-lg">{p.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{p.product_code}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedProductModal(p)}
                                    title="Szczegóły"
                                    className="p-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                                >
                                    <Info className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="lg:hidden flex justify-between items-center mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <div><span className="font-bold text-lg">{p.price?.toFixed(2)} PLN</span></div>
                                <div><span className="text-sm">Ilość: </span><span className="font-bold">{p.quantity}</span></div>
                            </div>
                            <div className="lg:hidden text-xs text-gray-500 mt-2 truncate">EAN: {p.barcodes?.join(', ')}</div>

                            <div className="hidden lg:flex col-span-1 justify-center">
                                <ProductImage src={p.image} alt={p.name} className="w-10 h-10" iconSize={18} />
                            </div>
                            <div className="hidden lg:block col-span-4 font-medium">{p.name}</div>
                            <div className="hidden lg:block col-span-2">{p.product_code}</div>
                            <div className="hidden lg:block col-span-2 text-sm text-gray-500 truncate">{p.barcodes?.join(', ')}</div>
                            <div className="hidden lg:block col-span-1 text-center">{p.quantity}</div>
                            <div className="hidden lg:block col-span-1 text-right">{p.price?.toFixed(2)} PLN</div>
                            <div className="hidden lg:flex col-span-1 justify-center">
                                <button
                                    onClick={() => setSelectedProductModal(p)}
                                    title="Szczegóły"
                                    className="p-1.5 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Info className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex justify-between items-center mt-4">
                <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg disabled:opacity-50">Poprzednia</button>
                <span>Strona {page} z {totalPages}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg disabled:opacity-50">Następna</button>
            </div>

            <ProductDetailsModal
                product={selectedProductModal}
                isOpen={!!selectedProductModal}
                onClose={() => setSelectedProductModal(null)}
            />
        </div>
    );
};

export default AdminProductsView;
