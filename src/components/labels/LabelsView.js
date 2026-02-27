import React, { useState } from 'react';
import { Printer, Trash2, Plus, Minus, XCircle } from 'lucide-react';
import SearchView from '../product/SearchView';
import { useNotification } from '../../contexts/NotificationContext';

const HERMA_FORMATS = {
    HERMA_11001: {
        id: '11001',
        name: 'HERMA 11001 (38.0 x 20.1 mm) - 65 szt.',
        cols: 5,
        rows: 13,
        width: '38.0mm',
        height: '20.1mm',
        marginTop: '17.85mm',
        marginLeft: '10mm',
    },
    HERMA_10000: {
        id: '10000',
        name: 'HERMA 10000 (17.8 x 10 mm) - 270 szt.',
        cols: 10,
        rows: 27,
        width: '17.8mm',
        height: '10mm',
        marginTop: '13.5mm',
        marginLeft: '16mm',
    }
};

const LabelsView = () => {
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [format, setFormat] = useState('HERMA_11001');
    const { showNotification } = useNotification();

    const addProduct = (product) => {
        const existing = selectedProducts.find(p => p._id === product._id);
        if (existing) {
            updateQuantity(product._id, existing.printQuantity + 1);
        } else {
            setSelectedProducts([...selectedProducts, { ...product, printQuantity: 1 }]);
        }
    };

    const updateQuantity = (id, newQuantity) => {
        if (newQuantity < 1) return;
        setSelectedProducts(selectedProducts.map(p =>
            p._id === id ? { ...p, printQuantity: newQuantity } : p
        ));
    };

    const removeProduct = (id) => {
        setSelectedProducts(selectedProducts.filter(p => p._id !== id));
    };

    const clearAll = () => {
        if (window.confirm("Czy na pewno chcesz wyczyścić listę?")) {
            setSelectedProducts([]);
        }
    };

    const handlePrint = () => {
        if (selectedProducts.length === 0) {
            showNotification('Dodaj produkty do wydruku.', 'warning');
            return;
        }
        window.print();
    };

    const totalLabels = selectedProducts.reduce((sum, p) => sum + p.printQuantity, 0);

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto print:p-0 print:m-0 print:max-w-none">
            <div className="print:hidden">
                <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white flex items-center">
                    <Printer className="mr-3 text-indigo-500" /> Wydruk Etykiet Cenowych
                </h1>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-8 border border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Wyszukaj produkt</h2>
                    <SearchView onProductSelect={addProduct} />
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-8 border border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4 dark:border-gray-700">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Produkty do wydruku</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Łącznie: {totalLabels} etykiet</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <select
                                value={format}
                                onChange={(e) => setFormat(e.target.value)}
                                className="p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white flex-1 md:flex-none focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {Object.keys(HERMA_FORMATS).map(key => (
                                    <option key={key} value={key}>{HERMA_FORMATS[key].name}</option>
                                ))}
                            </select>

                            <button
                                onClick={clearAll}
                                className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Wyczyść wszystko"
                            >
                                <XCircle className="h-6 w-6" />
                            </button>

                            <button
                                onClick={handlePrint}
                                disabled={selectedProducts.length === 0}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg font-bold flex items-center justify-center transition-all shadow-md ${
                                    selectedProducts.length === 0
                                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                            >
                                <Printer className="mr-2 h-5 w-5" /> Drukuj
                            </button>
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg mb-6 text-amber-800 dark:text-amber-200 text-sm flex items-start">
                        <XCircle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0 text-amber-500 rotate-45" />
                        <div>
                            <p className="font-bold mb-1">Ważne ustawienia drukowania:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Skala: <strong>100%</strong> (nie "Dopasuj do strony")</li>
                                <li>Marginesy: <strong>Brak</strong> lub <strong>Minimalne</strong></li>
                                <li>Opcja "Nagłówki i stopki": <strong>Wyłączona</strong></li>
                            </ul>
                        </div>
                    </div>

                    {selectedProducts.length === 0 ? (
                        <div className="text-center py-16 flex flex-col items-center">
                            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                                <Printer className="h-10 w-10 text-gray-400" />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 italic max-w-xs">
                                Lista jest pusta. Użyj wyszukiwarki powyżej, aby dodać produkty, dla których chcesz wydrukować cenówki.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="text-gray-500 uppercase text-xs">
                                    <tr className="border-b dark:border-gray-700">
                                        <th className="py-4 px-2">Produkt</th>
                                        <th className="py-4 px-2">Kod produktu</th>
                                        <th className="py-4 px-2">Cena Netto</th>
                                        <th className="py-4 px-2">Cena Brutto</th>
                                        <th className="py-4 px-2 text-center">Liczba kopii</th>
                                        <th className="py-4 px-2 text-right">Akcje</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {selectedProducts.map(product => (
                                        <tr key={product._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="py-4 px-2 font-medium text-gray-900 dark:text-white">{product.name}</td>
                                            <td className="py-4 px-2 text-gray-600 dark:text-gray-400 font-mono text-sm">{product.product_code}</td>
                                            <td className="py-4 px-2 font-mono">{(product.price || 0).toFixed(2)} PLN</td>
                                            <td className="py-4 px-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">{(product.price * 1.23).toFixed(2)} PLN</td>
                                            <td className="py-4 px-2">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => updateQuantity(product._id, product.printQuantity - 1)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={product.printQuantity}
                                                        onChange={(e) => updateQuantity(product._id, parseInt(e.target.value) || 1)}
                                                        className="w-14 text-center bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-indigo-500 outline-none font-semibold"
                                                    />
                                                    <button
                                                        onClick={() => updateQuantity(product._id, product.printQuantity + 1)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="py-4 px-2 text-right">
                                                <button
                                                    onClick={() => removeProduct(product._id)}
                                                    className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Print Area */}
            <div className="hidden print:block print-page">
                <LabelsPrintContent products={selectedProducts} formatConfig={HERMA_FORMATS[format]} />
            </div>

            <style>{`
                @media print {
                    @page {
                        margin: 0 !important;
                        size: A4 portrait;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        background: white !important;
                    }
                    #root, #root > div, main {
                        margin: 0 !important;
                        padding: 0 !important;
                        display: block !important;
                        height: 100% !important;
                        width: 100% !important;
                        overflow: visible !important;
                        position: static !important;
                    }
                    .print\\:hidden, .no-print, nav, header, footer {
                        display: none !important;
                    }
                    .print-page {
                        display: block !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                    }
                }
            `}</style>
        </div>
    );
};

const LabelsPrintContent = ({ products, formatConfig }) => {
    // Rozwiń produkty do pojedynczych etykiet
    const allLabels = [];
    products.forEach(p => {
        for (let i = 0; i < p.printQuantity; i++) {
            allLabels.push(p);
        }
    });

    const itemsPerPage = formatConfig.cols * formatConfig.rows;
    const pages = [];
    for (let i = 0; i < allLabels.length; i += itemsPerPage) {
        pages.push(allLabels.slice(i, i + itemsPerPage));
    }

    return (
        <div style={{ backgroundColor: 'white', margin: 0, padding: 0 }}>
            {pages.map((pageLabels, pageIndex) => (
                <div key={pageIndex} style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${formatConfig.cols}, ${formatConfig.width})`,
                    gridTemplateRows: `repeat(${formatConfig.rows}, ${formatConfig.height})`,
                    paddingTop: formatConfig.marginTop,
                    paddingLeft: formatConfig.marginLeft,
                    pageBreakAfter: 'always',
                    width: '210mm',
                    height: '297mm',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    columnGap: 0,
                    rowGap: 0,
                    backgroundColor: 'white',
                    // Force the container to be exactly A4 and not shrink
                    minWidth: '210mm',
                    minHeight: '297mm'
                }}>
                    {pageLabels.map((p, index) => (
                        <div key={index} style={{
                            width: formatConfig.width,
                            height: formatConfig.height,
                            padding: formatConfig.id === '10000' ? '0.5mm' : '1mm',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            color: 'black',
                            fontFamily: 'sans-serif',
                            border: 'none',
                            textAlign: 'center'
                        }}>
                             {formatConfig.id === '10000' ? (
                                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', lineHeight: '1.1' }}>
                                    <div style={{ fontSize: '3.5pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{p.product_code}</div>
                                    <div style={{ fontSize: '3.2pt' }}>N: {(p.price || 0).toFixed(2)}</div>
                                    <div style={{ fontSize: '5pt', fontWeight: '900' }}>{(p.price * 1.23).toFixed(2)} <span style={{ fontSize: '3pt' }}>PLN</span></div>
                                 </div>
                             ) : (
                                 <>
                                    <div style={{ fontWeight: 'bold', fontSize: '7pt', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                                        {p.name}
                                    </div>
                                    <div style={{ fontSize: '6pt' }}>
                                        {p.product_code}
                                    </div>
                                    <div style={{ width: '100%', borderTop: '0.1mm solid #000', marginTop: '0.5mm', paddingTop: '0.5mm' }}>
                                        <div style={{ fontSize: '5pt' }}>Net: {(p.price || 0).toFixed(2)}</div>
                                        <div style={{ fontSize: '10pt', fontWeight: '900' }}>
                                            {(p.price * 1.23).toFixed(2)} <span style={{ fontSize: '6pt' }}>PLN</span>
                                        </div>
                                    </div>
                                 </>
                             )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default LabelsView;
