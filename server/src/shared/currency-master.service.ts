import { eq, asc } from 'drizzle-orm';
import { db } from '../db';
import { countries, currencies } from '../db/schema';

const COMMON_CURRENCY_CODES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'JPY', 'SGD'] as const;

const normalizeCurrencyCode = (currencyCode: string) => String(currencyCode || '').trim().toUpperCase();

const isSupportedCurrencyCode = (currencyCode: string) => {
    try {
        new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(0);
        return true;
    } catch {
        return false;
    }
};

const getCurrencyName = (currencyCode: string) => {
    try {
        const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });
        const label = displayNames.of(currencyCode);
        return label && label !== currencyCode ? label : currencyCode;
    } catch {
        return currencyCode;
    }
};

const getCurrencySymbol = (currencyCode: string) => {
    try {
        const parts = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
            currencyDisplay: 'narrowSymbol'
        }).formatToParts(0);
        const symbol = parts.find((part) => part.type === 'currency')?.value;
        return symbol || currencyCode;
    } catch {
        return currencyCode;
    }
};

const selectCurrencyByCode = async (executor: any, currencyCode: string) => {
    const [currency] = await executor
        .select()
        .from(currencies)
        .where(eq(currencies.code, currencyCode))
        .limit(1);

    return currency || null;
};

const listCandidateCurrencyCodes = async () => {
    const countryRows = await db
        .select({ currencyCode: countries.countryCurrency })
        .from(countries)
        .orderBy(asc(countries.countryName));

    const codes = new Set(COMMON_CURRENCY_CODES);
    countryRows.forEach((row) => {
        const normalized = normalizeCurrencyCode(row.currencyCode || '');
        if (normalized) {
            codes.add(normalized as typeof COMMON_CURRENCY_CODES[number]);
        }
    });

    return Array.from(codes);
};

export const CurrencyMasterService = {
    normalizeCurrencyCode,

    async ensureCurrencyExists(currencyCode: string, executor: any = db) {
        const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
        if (!normalizedCurrencyCode) {
            throw new Error('Currency code is required');
        }

        if (!isSupportedCurrencyCode(normalizedCurrencyCode)) {
            throw new Error(`Currency '${normalizedCurrencyCode}' is not supported.`);
        }

        const existingCurrency = await selectCurrencyByCode(executor, normalizedCurrencyCode);
        if (existingCurrency) {
            return existingCurrency;
        }

        await executor.insert(currencies).values({
            code: normalizedCurrencyCode,
            name: getCurrencyName(normalizedCurrencyCode),
            symbol: getCurrencySymbol(normalizedCurrencyCode),
            status: 1
        }).catch(() => null);

        const createdCurrency = await selectCurrencyByCode(executor, normalizedCurrencyCode);
        if (!createdCurrency) {
            throw new Error(`Failed to resolve currency '${normalizedCurrencyCode}'.`);
        }

        return createdCurrency;
    },

    async getAll() {
        const candidateCodes = await listCandidateCurrencyCodes();

        for (const code of candidateCodes) {
            if (!code || !isSupportedCurrencyCode(code)) continue;
            await this.ensureCurrencyExists(code).catch(() => null);
        }

        return db.select().from(currencies).orderBy(asc(currencies.code));
    },
};
