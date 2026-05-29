import { useEffect, useRef } from 'react';

/**
 * Hook do globalnego nasłuchiwania skanera kodów kreskowych (klawiatury HID).
 * Skanery zazwyczaj wysyłają znaki bardzo szybko i kończą znakiem Enter.
 */
export const useBarcodeScanner = (onScan) => {
    const buffer = useRef('');
    const lastKeyTime = useRef(0);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignoruj jeśli zdarzenie pochodzi z pola input (chyba że chcemy wymusić globalność)
            // Jednak użytkownik chce "niezależnie od aktywności okna", więc słuchamy zawsze,
            // ale musimy uważać, by nie psuć normalnego pisania.
            // Skanery są BARDZO szybkie (< 50ms między znakami).

            const currentTime = Date.now();
            const timeDiff = currentTime - lastKeyTime.current;
            lastKeyTime.current = currentTime;

            if (e.key === 'Enter') {
                if (buffer.current.length >= 2) {
                    onScan(buffer.current);
                    buffer.current = '';
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }

            // Skanery HID są bardzo szybkie. Jeśli przerwa > 50ms, to nie skaner.
            if (timeDiff > 50) {
                buffer.current = '';
            }

            if (e.key.length === 1) {
                buffer.current += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onScan]);
};
