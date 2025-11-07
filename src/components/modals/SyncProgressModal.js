import React from 'react';
import Modal from '../common/Modal';

const SyncProgressModal = ({ syncProgress }) => {
    // Modal nie będzie widoczny, jeśli status to 'idle' lub 'success'
    const isOpen = syncProgress.status === 'downloading' || syncProgress.status === 'required' || syncProgress.status === 'error';

    const getTitle = () => {
        if (syncProgress.status === 'required') return 'Wymagana synchronizacja danych';
        if (syncProgress.status === 'downloading') return 'Pobieranie danych...';
        if (syncProgress.status === 'error') return 'Błąd synchronizacji';
        return 'Synchronizacja';
    };

    const getProgressPercentage = () => {
        if (!syncProgress.total || syncProgress.total === 0) return 0;
        return Math.round((syncProgress.loaded / syncProgress.total) * 100);
    };

    return (
        <Modal isOpen={isOpen} onClose={() => {}} title={getTitle()} canBeClosed={false}>
            <div className="text-center">
                {syncProgress.status === 'downloading' && (
                    <>
                        <p className="mb-2">Trwa pobieranie tabeli: <strong>{syncProgress.table}</strong></p>
                        <p className="mb-4">Pobrano {syncProgress.loaded} z {syncProgress.total} rekordów.</p>
                        <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
                            <div
                                className="bg-blue-600 h-4 rounded-full"
                                style={{ width: `${getProgressPercentage()}%` }}
                            ></div>
                        </div>
                        <p className="mt-2 text-lg font-bold">{getProgressPercentage()}%</p>
                    </>
                )}
                {syncProgress.status === 'required' && (
                    <p>Lokalna baza danych jest pusta. Rozpoczynam pobieranie niezbędnych danych z serwera. To może potrwać kilka chwil...</p>
                )}
                 {syncProgress.status === 'error' && (
                    <p className="text-red-500">Wystąpił błąd podczas synchronizacji. Spróbuj odświeżyć stronę lub skorzystaj z opcji ręcznej synchronizacji.</p>
                )}
            </div>
        </Modal>
    );
};

export default SyncProgressModal;