import { useEffect, useState } from 'react';
import apiService from '../services/api';

const COMMON_CURRENCY_CODES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'JPY', 'SGD'];

const normalizeCurrencyCode = (currencyCode) => String(currencyCode || '').trim().toUpperCase();

const getCurrencyName = (currencyCode) => {
    try {
        const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });
        const label = displayNames.of(currencyCode);
        return label && label !== currencyCode ? label : currencyCode;
    } catch {
        return currencyCode;
    }
};

const getCurrencySymbol = (currencyCode) => {
    try {
        const parts = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
            currencyDisplay: 'narrowSymbol'
        }).formatToParts(0);
        return parts.find((part) => part.type === 'currency')?.value || currencyCode;
    } catch {
        return currencyCode;
    }
};

const buildCurrencyOption = (item) => {
    const code = normalizeCurrencyCode(item?.code || item?.value || item?.countryCurrency || item);
    if (!code) return null;

    const symbol = item?.symbol || getCurrencySymbol(code);
    const name = item?.name || getCurrencyName(code);

    return {
        code,
        value: code,
        symbol,
        name,
        label: `${symbol} - ${name} (${code})`
    };
};

const readResponseRows = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.currencies)) return response.currencies;
    return [];
};

const mergeCurrencyOptions = (items) => {
    const merged = new Map();

    items.forEach((item) => {
        const option = buildCurrencyOption(item);
        if (!option) return;
        if (!merged.has(option.code)) {
            merged.set(option.code, option);
        }
    });

    return Array.from(merged.values()).sort((left, right) => left.code.localeCompare(right.code));
};

const fallbackCurrencyOptions = mergeCurrencyOptions(COMMON_CURRENCY_CODES);

let cachedCurrencyOptions = null;
let pendingCurrencyRequest = null;

const fetchCurrencyOptions = async () => {
    const currenciesResponse = await apiService.currencies.getAll().catch(() => null);
    const currencyRows = readResponseRows(currenciesResponse);

    if (currencyRows.length > 0) {
        return mergeCurrencyOptions([...currencyRows, ...COMMON_CURRENCY_CODES]);
    }

    const countriesResponse = await apiService.countries.getAll().catch(() => null);
    const countryRows = readResponseRows(countriesResponse);
    const countryCurrencyCodes = countryRows
        .map((country) => country?.countryCurrency)
        .filter(Boolean);

    return mergeCurrencyOptions([...countryCurrencyCodes, ...COMMON_CURRENCY_CODES]);
};

export const useCurrencyOptions = () => {
    const [currencyOptions, setCurrencyOptions] = useState(cachedCurrencyOptions || fallbackCurrencyOptions);
    const [currenciesLoading, setCurrenciesLoading] = useState(!cachedCurrencyOptions);

    useEffect(() => {
        let isActive = true;

        if (cachedCurrencyOptions) {
            return undefined;
        }

        if (!pendingCurrencyRequest) {
            pendingCurrencyRequest = fetchCurrencyOptions()
                .then((options) => {
                    cachedCurrencyOptions = options.length > 0 ? options : fallbackCurrencyOptions;
                    return cachedCurrencyOptions;
                })
                .catch(() => {
                    cachedCurrencyOptions = fallbackCurrencyOptions;
                    return cachedCurrencyOptions;
                })
                .finally(() => {
                    pendingCurrencyRequest = null;
                });
        }

        pendingCurrencyRequest.then((options) => {
            if (!isActive) return;
            setCurrencyOptions(options);
            setCurrenciesLoading(false);
        });

        return () => {
            isActive = false;
        };
    }, []);

    return {
        currencyOptions,
        currenciesLoading
    };
};
