import { db } from '../db';
import { api } from '../api';

export const FELT_COLOR_LIST = [
    { code: '632-A1', hex: '#FFFFFF' },
    { code: '632-A2', hex: '#FFF4BD' },
    { code: '632-A3', hex: '#FFB300' },
    { code: '632-A4', hex: '#FFEA00' },
    { code: '632-A5', hex: '#FFD1DC' },
    { code: '632-A6', hex: '#FF69B4' },
    { code: '632-A8', hex: '#E30000' },
    { code: '632-A10', hex: '#FFB000' },
    { code: '632-A13', hex: '#87CEEB' },
    { code: '632-A14', hex: '#00CED1' },
    { code: '632-A15', hex: '#0000CD' },
    { code: '632-A16', hex: '#1C1C1C' },
    { code: '632-A18', hex: '#00CD00' },
    { code: '632-A19', hex: '#008000' },
    { code: '632-A20', hex: '#006400' },
    { code: '632-A22', hex: '#FF7F00' },
    { code: '632-A24', hex: '#E30B5C' },
    { code: '632-A26', hex: '#E60000' },
    { code: '632-A27', hex: '#8B0000' },
    { code: '632-A28', hex: '#000000' },
    { code: '632-A29', hex: '#D4AF37' },
    { code: '632-A31', hex: '#8B4513' },
    { code: '632-A32', hex: '#0000FF' },
    { code: '632-A33', hex: '#8A2BE2' },
    { code: '632-A34', hex: '#4B0082' },
    { code: '632-A35', hex: '#BEBEBE' },
    { code: '632-A36', hex: '#708090' },
    { code: '632-A37', hex: '#3A5311' },
    { code: '632-A39', hex: '#9400D3' },
    { code: '632-A40', hex: '#004225' },
    { code: '632-A41', hex: '#FFFDD0' },
    { code: '632-A43', hex: '#FFD700' },
    { code: '632-A44', hex: '#FF0000' },
    { code: '632-A48', hex: '#DEB887' },
    { code: '632-A50', hex: '#FFB6C1' },
    { code: '632-A54', hex: '#7FFF00' },
    { code: '632-M3', hex: '#505C62' },
    { code: '632-M5', hex: '#8B7355' },
    { code: '632-M7', hex: '#5C1D24' },
    { code: '632-M11', hex: '#E5D8C1' },
    { code: '632-M16', hex: '#9C9C9C' },
    { code: '632-M17', hex: '#D66238' },
    { code: '632-M20', hex: '#C2B29B' }
];

/**
 * Loads product details from local DB / API for all felt items and merges them with color info.
 */
export async function getFeltProductsWithDetails() {
    const codes = FELT_COLOR_LIST.map(f => f.code);
    const productMap = new Map();

    try {
        // 1. Direct index lookup by product_code
        const dbProducts = await db.products.where('product_code').anyOf(codes).toArray();
        dbProducts.forEach(p => {
            if (p.product_code) {
                productMap.set(p.product_code.trim().toUpperCase(), p);
            }
        });

        // 2. Fallback search for missing items in Dexie
        const missingCodes = codes.filter(c => !productMap.has(c.toUpperCase()));
        if (missingCodes.length > 0) {
            const allProducts = await db.products.filter(p => {
                if (!p.product_code) return false;
                const pCode = p.product_code.trim().toUpperCase();
                return missingCodes.some(m => pCode === m.toUpperCase() || pCode.includes(m.toUpperCase()));
            }).toArray();

            allProducts.forEach(p => {
                const matchedCode = codes.find(c => p.product_code && p.product_code.trim().toUpperCase() === c.toUpperCase());
                if (matchedCode && !productMap.has(matchedCode.toUpperCase())) {
                    productMap.set(matchedCode.toUpperCase(), p);
                }
            });
        }
    } catch (e) {
        console.warn('Could not fetch felt products from local db:', e);
    }

    // 3. Fallback online search if online and still missing items
    const stillMissing = codes.filter(c => !productMap.has(c.toUpperCase()));
    if (stillMissing.length > 0 && navigator.onLine) {
        try {
            const apiResults = await api.searchProducts('632-');
            if (Array.isArray(apiResults)) {
                apiResults.forEach(p => {
                    if (p.product_code) {
                        const codeKey = p.product_code.trim().toUpperCase();
                        if (!productMap.has(codeKey)) {
                            productMap.set(codeKey, p);
                        }
                    }
                });
            }
        } catch (e) {
            console.warn('Could not fetch felt products from API:', e);
        }
    }

    return FELT_COLOR_LIST.map(item => {
        const found = productMap.get(item.code.toUpperCase());
        return {
            code: item.code,
            hex: item.hex,
            product: found || {
                _id: `felt-${item.code}`,
                product_code: item.code,
                name: `Filc ${item.code}`,
                price: 0,
                barcodes: [item.code]
            }
        };
    });
}
