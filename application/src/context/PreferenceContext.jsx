import React, { useContext, useState, useEffect } from 'react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import apiService from '../services/api';
import PreferenceContext from './PreferenceContextDefinition';

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
            const localPrefs = saved ? JSON.parse(saved) : {};

            return {
                currency: 'INR',
                dateFormat: 'dd MMM, yyyy',
                numberFormat: 'en-IN',
                timeZone: 'Asia/Kolkata',
                ...localPrefs
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

    const updatePreferences = async (newPrefs) => {
        setPreferences(prev => {
            const updatedPrefs = { ...prev, ...newPrefs };
            localStorage.setItem('system_preferences', JSON.stringify(updatedPrefs));
            // Trigger event for listeners immediately
            window.dispatchEvent(new Event('preferencesUpdated'));
            return updatedPrefs;
        });
    };

    // When a different user logs in, re-read system_preferences that AuthContext just wrote
    useEffect(() => {
        const onUserSwitched = () => {
            try {
                const saved = localStorage.getItem('system_preferences');
                if (saved) {
                    setPreferences(JSON.parse(saved));
                }
            } catch (e) {
                console.error("Failed to re-sync preferences on user switch", e);
            }
        };
        window.addEventListener('userSwitched', onUserSwitched);
        return () => window.removeEventListener('userSwitched', onUserSwitched);
    }, []);

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
            } catch {
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
        } catch {
            return dateString;
        }
    };

    const parseDateTimeValue = (dateString, sourceTimeZone = null) => {
        if (!dateString) return null;
        if (dateString instanceof Date) {
            return Number.isNaN(dateString.getTime()) ? null : dateString;
        }

        const rawValue = String(dateString).trim();
        const hasExplicitTimeZone = /(?:[zZ]|[+-]\d{2}:\d{2}|[+-]\d{4})$/.test(rawValue);
        const naiveDateTimeMatch = rawValue.match(
            /^(\d{4})-(\d{2})-(\d{2})(?:[ T])(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/
        );

        if (naiveDateTimeMatch && !hasExplicitTimeZone) {
            const [, year, month, day, hours, minutes, seconds = '0', milliseconds = '0'] = naiveDateTimeMatch;
            const normalizedMilliseconds = milliseconds.padEnd(3, '0').slice(0, 3);

            const normalizedSourceTimeZone = String(sourceTimeZone || '').trim().toUpperCase();
            if (normalizedSourceTimeZone === 'UTC' || normalizedSourceTimeZone === 'Z' || normalizedSourceTimeZone === '+00:00') {
                return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${normalizedMilliseconds}Z`);
            }

            const localDate = new Date(
                Number(year),
                Number(month) - 1,
                Number(day),
                Number(hours),
                Number(minutes),
                Number(seconds),
                Number(normalizedMilliseconds)
            );

            return sourceTimeZone ? fromZonedTime(localDate, sourceTimeZone) : localDate;
        }

        const parsedDate = new Date(rawValue);
        return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    };

    const formatDateTime = (dateString, sourceTimeZone = null) => {
        if (!dateString) return '-';
        try {
            const date = parseDateTimeValue(dateString, sourceTimeZone);
            if (!date) return dateString;
            const formatMap = {
                'DD MMM, YYYY (d M, Y)': 'dd MMM, yyyy',
                'MM/DD/YYYY': 'MM/dd/yyyy',
                'YYYY-MM-DD': 'yyyy-MM-dd',
                'DD/MM/YYYY': 'dd/MM/yyyy'
            };

            const pattern = `${formatMap[preferences.dateFormat] || 'dd MMM, yyyy'} hh:mm a`;
            return formatInTimeZone(date, preferences.timeZone || 'Asia/Kolkata', pattern);
        } catch {
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
