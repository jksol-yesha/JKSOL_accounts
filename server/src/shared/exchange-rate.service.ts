
import { db } from '../db';
import { exchangeRates, organizations } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

// In-memory cache for rates
const rateCache: Record<string, { rate: number; timestamp: number }> = {};
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 Hour
const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

const persistRate = async (
    orgId: number | undefined,
    rateDate: string,
    fromCurrency: string,
    toCurrency: string,
    rate: number
) => {
    if (!orgId || !Number.isFinite(rate) || rate <= 0) return;

    await db.insert(exchangeRates).values({
        orgId,
        rateDate,
        fromCurrency,
        toCurrency,
        rate: rate.toString(),
        createdAt: new Date()
    }).onDuplicateKeyUpdate({
        set: {
            rate: rate.toString(),
            createdAt: new Date()
        }
    }).catch(e => {
        // If it still fails (e.g. connectivity), log it but don't crash
        console.error("[ExchangeRateService] Failed to cache rate in DB:", e.message);
    });
};

const fetchFrankfurterRate = async (fromCurrency: string, toCurrency: string): Promise<number | null> => {
    const url = `https://api.frankfurter.dev/v1/latest?from=${fromCurrency}&to=${toCurrency}`;
    const response = await fetch(url);
    if (!response.ok) {
        if (response.status === 404) {
            console.warn(`[ExchangeRateService] Frankfurter - Currency not supported or date in future: ${fromCurrency} -> ${toCurrency} (URL: ${url})`);
        } else {
            console.warn(`[ExchangeRateService] Frankfurter fetch failed: ${response.status} for ${fromCurrency} -> ${toCurrency}`);
        }
        return null;
    }

    const data: any = await response.json();
    const rate = Number(data?.rates?.[toCurrency]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
};

const fetchOpenErApiRate = async (fromCurrency: string, toCurrency: string): Promise<number | null> => {
    const response = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);
    if (!response.ok) {
        console.warn(`[ExchangeRateService] open.er-api fetch failed: ${response.status} for ${fromCurrency}`);
        return null;
    }

    const data: any = await response.json();
    if (data?.result !== 'success') {
        console.warn(`[ExchangeRateService] open.er-api returned non-success result for ${fromCurrency} -> ${toCurrency}`);
        return null;
    }

    const rate = Number(data?.rates?.[toCurrency]);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
};

const getDateInTimeZone = (timeZone: string) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    return formatter.format(new Date());
};

export const ExchangeRateService = {
    async getRateDate(orgId?: number): Promise<string> {
        if (!orgId) return getDateInTimeZone(DEFAULT_TIME_ZONE);

        try {
            const [org] = await db.select({ timezone: organizations.timezone })
                .from(organizations)
                .where(eq(organizations.id, orgId))
                .limit(1);

            return getDateInTimeZone(org?.timezone || DEFAULT_TIME_ZONE);
        } catch (error) {
            console.error('[ExchangeRateService] Failed to resolve organization timezone:', error);
            return getDateInTimeZone(DEFAULT_TIME_ZONE);
        }
    },

    /**
     * Get the exchange rate from one currency to another.
     * Enforces fetching the current day's rate, utilizing Frankfurter API if local DB misses.
     */
    async getRate(fromCurrency: string, toCurrency: string, orgId?: number): Promise<number> {
        const normalizedFromCurrency = String(fromCurrency || '').toUpperCase();
        const normalizedToCurrency = String(toCurrency || '').toUpperCase();
        if (!normalizedFromCurrency || !normalizedToCurrency) return 1;
        if (normalizedFromCurrency === normalizedToCurrency) return 1;
        const todayStr = await this.getRateDate(orgId);
        const cacheKey = `${normalizedFromCurrency}_${normalizedToCurrency}_${todayStr}`;
        const now = Date.now();

        // 1. Check Memory Cache
        if (rateCache[cacheKey]) {
            if (now - rateCache[cacheKey].timestamp < CACHE_TTL_MS) {
                return rateCache[cacheKey].rate;
            }
        }

        // 2. Fetch from Local Database for TODAY
        try {
            const [dbRate] = await db.select()
                .from(exchangeRates)
                .where(and(
                    eq(exchangeRates.fromCurrency, normalizedFromCurrency),
                    eq(exchangeRates.toCurrency, normalizedToCurrency),
                    eq(exchangeRates.rateDate, todayStr)
                ))
                .limit(1);

            if (dbRate) {
                const rate = Number(dbRate.rate);
                rateCache[cacheKey] = { rate, timestamp: now };
                return rate;
            }
        } catch (dbError) {
            console.error("[ExchangeRateService] DB Fetch Error:", dbError);
        }

        // 3. Fetch from External API
        try {

            const providers = [
                () => fetchFrankfurterRate(normalizedFromCurrency, normalizedToCurrency),
                () => fetchOpenErApiRate(normalizedFromCurrency, normalizedToCurrency)
            ];

            for (const fetchRate of providers) {
                const rate = await fetchRate();
                if (!rate) continue;

                await persistRate(orgId, todayStr, normalizedFromCurrency, normalizedToCurrency, rate);
                rateCache[cacheKey] = { rate, timestamp: now };
                return rate;
            }
        } catch (apiError) {
            console.error("[ExchangeRateService] API Error:", apiError);
        }

        // 4. Fallback: Use latest available rate from DB
        try {
            const [latestRate] = await db.select()
                .from(exchangeRates)
                .where(and(
                    eq(exchangeRates.fromCurrency, normalizedFromCurrency),
                    eq(exchangeRates.toCurrency, normalizedToCurrency)
                ))
                .orderBy(desc(exchangeRates.rateDate))
                .limit(1);

            if (latestRate) {
                console.warn(`[ExchangeRateService] Using fallback rate from ${latestRate.rateDate}`);
                return Number(latestRate.rate);
            }
        } catch (e) { }

        console.warn(`[ExchangeRateService] CRITICAL FAILURE: No rate found for ${normalizedFromCurrency} -> ${normalizedToCurrency}. Using default 1.`);
        return 1;
    },

    /**
     * Convert an amount from one currency to another using the current rate.
     */
    async convert(amount: number, fromCurrency: string, toCurrency: string, orgId?: number): Promise<number> {
        if (!amount) return 0;
        if (fromCurrency === toCurrency) return amount;

        const rate = await this.getRate(fromCurrency, toCurrency, orgId);
        return amount * rate;
    }
};
