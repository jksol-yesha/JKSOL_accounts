
import { db } from '../db';
import { exchangeRates, organizations } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

// In-memory cache for rates
const rateCache: Record<string, { rate: number; timestamp: number }> = {};
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 Minutes for more 'live' updates during testing
const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

// Request deduplication map
const pendingRequests: Map<string, Promise<number>> = new Map();
// Global API lock to prevent concurrent requests
let apiLock: Promise<any> = Promise.resolve();

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

const fetchFxApiRate = async (fromCurrency: string, toCurrency: string): Promise<number | null> => {
    const from = String(fromCurrency || '').trim().toLowerCase();
    const to = String(toCurrency || '').trim().toLowerCase();
    const url = `https://fxapi.app/api/${from}/${to}.json`;

    const response = await fetch(url);
    if (!response.ok) {
        console.warn(`[ExchangeRateService] fxapi.app fetch failed: ${response.status} for ${fromCurrency} -> ${toCurrency}`);
        return null;
    }

    const data: any = await response.json();
    const rate = Number(data?.rate);

    if (!Number.isFinite(rate) || rate <= 0) {
        console.warn(`[ExchangeRateService] fxapi.app returned invalid rate for ${fromCurrency} -> ${toCurrency}: ${JSON.stringify(data)}`);
        return null;
    }

    return rate;
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

const fetchExchangeRatesIoRate = async (fromCurrency: string, toCurrency: string, dateStr: string | 'latest' = 'latest'): Promise<number | null> => {
    // Sequential execution: wait for previous API call to finish + small buffer
    const currentLock = apiLock;
    let resolveLock: (val?: any) => void;
    apiLock = new Promise(resolve => { resolveLock = resolve; });

    await currentLock;
    // Buffer delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
        const apiKey = process.env.EXCHANGE_RATES_API_KEY;
        const baseUrl = process.env.EXCHANGE_RATES_API_BASE || 'http://api.exchangeratesapi.io/v1/';
        
        if (!apiKey) {
            resolveLock!();
            return null;
        }

        const endpoint = dateStr === 'latest' ? 'latest' : dateStr;
        const url = `${baseUrl}${endpoint}?access_key=${apiKey}&symbols=${fromCurrency},${toCurrency}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`[ExchangeRateService] exchangeratesapi.io fetch failed: ${response.status}`);
            resolveLock!();
            return null;
        }

        const data: any = await response.json();
        console.log(`[ExchangeRateService] exchangeratesapi.io raw response for ${fromCurrency},${toCurrency}:`, JSON.stringify(data));
        
        if (!data?.success) {
            console.warn(`[ExchangeRateService] exchangeratesapi.io error: ${data?.error?.info || 'Unknown error code: ' + (data?.error?.code || 'null')}`);
            resolveLock!();
            return null;
        }

        const rates = data?.rates;
        if (!rates) {
            resolveLock!();
            return null;
        }

        // If fromCurrency is the base (usually EUR), return toCurrency rate directly
        if (fromCurrency === data.base) {
            resolveLock!();
            return Number(rates[toCurrency]) || null;
        }

        // Cross-rate calculation: (EUR -> to) / (EUR -> from)
        const rateFrom = Number(rates[fromCurrency]);
        const rateTo = Number(rates[toCurrency]);

        resolveLock!();
        if (rateFrom && rateTo) {
            return rateTo / rateFrom;
        }
        
        return null;
    } catch (e: any) {
        console.error(`[ExchangeRateService] exchangeratesapi.io unexpected error:`, e.message);
        resolveLock!();
        return null;
    }
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
        
        console.log(`[ExchangeRateService] Requesting rate: ${normalizedFromCurrency} -> ${normalizedToCurrency} (Org: ${orgId})`);

        const todayStr = await this.getRateDate(orgId);
        const cacheKey = `${normalizedFromCurrency}_${normalizedToCurrency}_${todayStr}`;
        const now = Date.now();

        // 1. Check Memory Cache
        if (rateCache[cacheKey]) {
            if (now - rateCache[cacheKey].timestamp < CACHE_TTL_MS) {
                console.log(`[ExchangeRateService] Returning cached rate (memory): ${rateCache[cacheKey].rate}`);
                return rateCache[cacheKey].rate;
            }
        }

        // 2. Check for Pending Requests (Deduplication)
        if (pendingRequests.has(cacheKey)) {
            console.log(`[ExchangeRateService] Waiting for existing in-flight request: ${cacheKey}`);
            return pendingRequests.get(cacheKey)!;
        }

        // 3. Define the Fetch Logic as a single unit
        const fetchAndStore = async (): Promise<number> => {
            try {
                // PRIMARY: Fetch live pair rate from fxapi.app
                console.log(`[ExchangeRateService] Attempting PRIMARY fetch from fxapi.app...`);
                const rate = await fetchFxApiRate(normalizedFromCurrency, normalizedToCurrency);
                
                if (rate) {
                    console.log(`[ExchangeRateService] SUCCESS: Fetched LIVE rate from PRIMARY API: ${rate}`);
                    await persistRate(orgId, todayStr, normalizedFromCurrency, normalizedToCurrency, rate);
                    rateCache[cacheKey] = { rate, timestamp: Date.now() };
                    return rate;
                }
                console.warn(`[ExchangeRateService] PRIMARY API failed to provide a rate.`);
            } catch (apiError: any) {
                console.error("[ExchangeRateService] PRIMARY API Error:", apiError.message);
            }

            // SECONDARY: Fallback to other Public APIs only if Primary fails
            try {
                console.log(`[ExchangeRateService] Attempting SECONDARY fetch from fallback APIs (Frankfurter/OpenER/exchangeratesapi.io)...`);
                const secondaryProviders = [
                    () => fetchFrankfurterRate(normalizedFromCurrency, normalizedToCurrency),
                    () => fetchOpenErApiRate(normalizedFromCurrency, normalizedToCurrency),
                    () => fetchExchangeRatesIoRate(normalizedFromCurrency, normalizedToCurrency, 'latest')
                ];

                for (const fetchRate of secondaryProviders) {
                    const rate = await fetchRate();
                    if (!rate) continue;

                    console.log(`[ExchangeRateService] CAUTION: Using SECONDARY fallback rate: ${rate}`);
                    await persistRate(orgId, todayStr, normalizedFromCurrency, normalizedToCurrency, rate);
                    rateCache[cacheKey] = { rate, timestamp: Date.now() };
                    return rate;
                }
            } catch (secondaryError) {
                console.error("[ExchangeRateService] Secondary API Error:", secondaryError);
            }

            // LAST RESORT: Fetch from Local Database (Any available date)
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
                    console.warn(`[ExchangeRateService] SUCCESS: Using historical fallback rate from ${latestRate.rateDate}: ${latestRate.rate}`);
                    return Number(latestRate.rate);
                }
            } catch (e) {
                console.error("[ExchangeRateService] Historical Fallback Error:", e);
            }

            // FINAL FALLBACK: Hardcoded common rates (Approximate)
            const commonRates: Record<string, number> = {
                'USD_INR': 83.3,
                'INR_USD': 0.012,
                'EUR_USD': 1.08,
                'USD_EUR': 0.92,
                'GBP_USD': 1.26,
                'USD_GBP': 0.79,
                'AED_INR': 22.7,
                'INR_AED': 0.044,
                'AED_USD': 0.27,
                'USD_AED': 3.67
            };
            const fallbackKey = `${normalizedFromCurrency}_${normalizedToCurrency}`;
            if (commonRates[fallbackKey]) {
                const rate = commonRates[fallbackKey];
                console.warn(`[ExchangeRateService] SUCCESS: Using hardcoded fallback rate for ${fallbackKey}: ${rate}`);
                return rate;
            }

            console.warn(`[ExchangeRateService] CRITICAL FAILURE: No rate found for ${normalizedFromCurrency} -> ${normalizedToCurrency}. Using default 1.`);
            return 1;
        };

        // 4. Execute with Deduplication
        // We set the promise BEFORE calling the function to prevent race conditions
        const requestPromise = (async () => {
             // Add a tiny random delay to further stagger simultaneous requests for different currency pairs
             await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
             return fetchAndStore();
        })().finally(() => {
            pendingRequests.delete(cacheKey);
        });

        pendingRequests.set(cacheKey, requestPromise);
        return requestPromise;
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
