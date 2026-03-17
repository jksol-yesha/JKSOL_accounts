import React, { createContext, useContext, useState, useEffect } from 'react';
import { formatInTimeZone } from 'date-fns-tz';

const PreferenceContext = createContext(null);

export const usePreferences = () => {
    const context = useContext(PreferenceContext);
    if (!context) {
        throw new Error('usePreferences must be used within a PreferenceProvider');
    }
    return context;
};

export const PreferenceProvider = ({ children }) => {
    const [preferences, setPreferences] = useState(() => {
        try {
            const saved = localStorage.getItem('system_preferences');
            return saved ? {
                currency: 'INR',
                dateFormat: 'dd MMM, yyyy',
                numberFormat: 'en-IN',
                timeZone: 'Asia/Kolkata',
                ...JSON.parse(saved)
            } : {
                currency: 'INR',
                dateFormat: 'dd MMM, yyyy',
                numberFormat: 'en-IN',
                timeZone: 'Asia/Kolkata'
            };
        } catch (e) {
            console.error("Failed to parse preferences", e);
            return {
                currency: 'INR',
                dateFormat: 'dd MMM, yyyy',
                numberFormat: 'en-IN',
                timeZone: 'Asia/Kolkata'
            };
        }
    });

    // Save to localStorage whenever preferences change (useEffect remains)



    const updatePreferences = (newPrefs) => {
        setPreferences(prev => {
            const updated = { ...prev, ...newPrefs };
            localStorage.setItem('system_preferences', JSON.stringify(updated));
            // Trigger event for listeners immediately
            window.dispatchEvent(new Event('preferencesUpdated'));
            return updated;
        });
    };

    // Helper: Format Currency
    const formatCurrency = (amount, currencyOverride = null) => {
        let val = Number(amount) || 0;



        // Handle legacy/fallback
        let locale = preferences.numberFormat;
        const legacyMap = {
            '1,234.56 (US)': 'en-US',
            '1.234,56 (EU)': 'de-DE',
            '1 234.56 (SI)': 'fr-CH',
            '1,23,456.78 (IN)': 'en-IN'
        };
        if (legacyMap[locale]) locale = legacyMap[locale];

        const normalizedLocale = String(locale || '').trim();
        const isSiFormat = normalizedLocale === 'fr-CH' || normalizedLocale.toLowerCase() === 'si';

        // Retrieve valid locale or default to en-US if invalid/missing
        if (!isSiFormat) {
            try {
                new Intl.NumberFormat(locale);
            } catch (e) {
                locale = 'en-US';
            }
        }

        // 1. Format the number primarily based on locale (for decimal/thousand separators)
        // For SI, enforce deterministic "1 234.56" formatting.
        const formattedNumber = isSiFormat
            ? new Intl.NumberFormat('en-US', {
                style: 'decimal',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(val).replace(/,/g, ' ')
            : new Intl.NumberFormat(locale, {
                style: 'decimal',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(val);

        // 2. Get the Currency Symbol
        const targetCurrency = currencyOverride || preferences.currency;
        const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: targetCurrency }).formatToParts(0);
        const symbolPart = parts.find(p => p.type === 'currency');
        const symbol = symbolPart ? symbolPart.value : targetCurrency;

        return `${symbol} ${formattedNumber}`;
    };

    // Helper: Format Date
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);

            // Map our custom dropdown values to date-fns format strings if needed, 
            // or just rely on what is stored if it matches date-fns syntax.
            // value: 'DD MMM, YYYY' -> date-fns 'dd MMM, yyyy' map

            const formatMap = {
                'DD MMM, YYYY (d M, Y)': 'dd MMM, yyyy',
                'MM/DD/YYYY': 'MM/dd/yyyy',
                'YYYY-MM-DD': 'yyyy-MM-dd',
                'DD/MM/YYYY': 'dd/MM/yyyy'
            };

            const pattern = formatMap[preferences.dateFormat] || 'dd MMM, yyyy';
            // Use formatInTimeZone to respect preferred time zone
            return formatInTimeZone(date, preferences.timeZone || 'Asia/Kolkata', pattern);
        } catch (e) {
            return dateString;
        }
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            const formatMap = {
                'DD MMM, YYYY (d M, Y)': 'dd MMM, yyyy',
                'MM/DD/YYYY': 'MM/dd/yyyy',
                'YYYY-MM-DD': 'yyyy-MM-dd',
                'DD/MM/YYYY': 'dd/MM/yyyy'
            };

            const pattern = `${formatMap[preferences.dateFormat] || 'dd MMM, yyyy'} hh:mm a`;
            return formatInTimeZone(date, preferences.timeZone || 'Asia/Kolkata', pattern);
        } catch (e) {
            return dateString;
        }
    };

    const value = {
        preferences,
        updatePreferences,
        formatCurrency,
        formatDate,
        formatDateTime
    };

    return (
        <PreferenceContext.Provider value={value}>
            {children}
        </PreferenceContext.Provider>
    );
};
