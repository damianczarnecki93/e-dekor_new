import React from 'react';
import { WifiOff } from 'lucide-react';

const OfflineIndicator = ({ isOnline }) => {
    if (isOnline) {
        return null;
    }

    return (
        <div className="bg-red-600 text-white text-center p-2 flex items-center justify-center z-50">
            <WifiOff className="h-5 w-5 mr-2" />
            <span className="font-semibold">Brak połączenia z internetem.</span>
            <span className="hidden sm:inline ml-1">Pracujesz w trybie offline.</span>
        </div>
    );
};

export default OfflineIndicator;