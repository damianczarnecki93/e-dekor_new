import React, { useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { RotateCcw, FileDown, FileText } from 'lucide-react';
import { api } from '../../api';
import { useNotification } from '../../contexts/NotificationContext';

const ShortageReportView = () => {
    const [reportData, setReportData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { showNotification } = useNotification();

    const generateReport = async () => {
        setIsLoading(true);
        setReportData([]);
        try {
            const data = await api.getShortageReport();
            setReportData(data);
            if (data.length === 0) {
                showNotification('Wszystkie zamówienia są zrealizowane!', 'success');
            }
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportPdf = () => {
        if (reportData.length === 0) {
            showNotification('Brak danych do wygenerowania raportu.', 'error');
            return;
        }

        const doc = new jsPDF();
        doc.addFont('/Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        doc.text("Raport Braków Magazynowych", 14, 15);
        doc.setFontSize(10);
        doc.text(`Data wygenerowania: ${new Date().toLocaleString()}`, 14, 22);

        let finalY = 30;

        reportData.forEach(order => {
            doc.setFontSize(12);
            doc.text(`Klient: ${order.customerName} (Zamówienie: ${order.orderId})`, 14, finalY);
            finalY += 7;

            doc.autoTable({
                startY: finalY,
                head: [['Nazwa produktu', 'Kod produktu', 'Brak']],
                body: order.shortages.map(item => [
                    item.name,
                    item.product_code,
                    item.shortage
                ]),
                styles: {
                    font: 'Roboto',
                    fontSize: 8,
                },
                headStyles: {
                    fillColor: [220, 220, 220],
                    textColor: [0, 0, 0]
                }
            });
            finalY = doc.lastAutoTable.finalY + 10;
        });

        doc.save('raport_brakow.pdf');
    };

    const handleExportCsv = () => {
        if (reportData.length === 0) {
            showNotification('Brak danych do wygenerowania raportu.', 'error');
            return;
        }

        const csvHeader = [
            'klient',
            'nazwa_produktu',
            'kod_produktu',
            'brak'
        ].join(';') + '\n';

        const csvRows = reportData.flatMap(order =>
            order.shortages.map(item => [
                order.customerName.replace(/;/g, ','),
                item.name.replace(/;/g, ','),
                item.product_code,
                item.shortage
            ].join(';'))
        ).join('\n');

        const csvContent = csvHeader + csvRows;

        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", "raport_brakow.csv");
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                <h1 className="text-2xl md:text-3xl font-bold">Raport Braków wg Zamówień</h1>
                <div className="flex gap-2">
                    <button onClick={generateReport} disabled={isLoading} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
                        <RotateCcw className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`}/>
                        {isLoading ? 'Generowanie...' : 'Generuj Raport'}
                    </button>
                    <button onClick={handleExportPdf} disabled={reportData.length === 0} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                        <FileDown className="w-5 h-5 mr-2"/> PDF
                    </button>
                     <button onClick={handleExportCsv} disabled={reportData.length === 0} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                        <FileText className="w-5 h-5 mr-2"/> CSV
                    </button>
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="p-4">Nazwa produktu</th>
                            <th className="p-4">Kod produktu</th>
                            <th className="p-4 text-center font-bold">Brak</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {reportData.map(order => (
                            <React.Fragment key={order._id}>
                                <tr className="bg-gray-100 dark:bg-gray-700">
                                    <td colSpan="3" className="p-3 font-bold text-indigo-600 dark:text-indigo-400">
                                        Zamówienie: {order.customerName}
                                    </td>
                                </tr>
                                {order.shortages.map(item => (
                                    <tr key={item._id}>
                                        <td className="p-4 pl-8 font-medium">{item.name}</td>
                                        <td className="p-4 pl-8">{item.product_code}</td>
                                        <td className="p-4 text-center font-bold text-red-600">{item.shortage}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
                {reportData.length === 0 && !isLoading && (
                    <p className="p-8 text-center text-gray-500">
                        Kliknij "Generuj Raport", aby wyświetlić braki pogrupowane według zamówień.
                    </p>
                )}
                {isLoading && (
                     <p className="p-8 text-center text-gray-500">
                        Generowanie raportu...
                    </p>
                )}
            </div>
        </div>
    );
};

export default ShortageReportView;