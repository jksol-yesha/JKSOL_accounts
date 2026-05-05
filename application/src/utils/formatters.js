export const normalizeLocale = (locale) => {
    const legacyMap = {
        '1,234.56 (US)': 'en-US',
        '1.234,56 (EU)': 'de-DE',
        '1 234.56 (SI)': 'fr-CH',
        '1,23,456.78 (IN)': 'en-IN'
    };

    const resolvedLocale = legacyMap[locale] || locale || 'en-US';

    try {
        new Intl.NumberFormat(resolvedLocale);
        return resolvedLocale;
    } catch {
        return 'en-US';
    }
};

export const formatCompactAmount = (amount, currency, locale) => {
    const numericAmount = Math.abs(Number(amount) || 0);
    const resolvedLocale = normalizeLocale(locale);
    const compactValue = new Intl.NumberFormat(resolvedLocale, {
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(numericAmount);

    const symbolPart = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD'
    }).formatToParts(0).find((part) => part.type === 'currency');

    const symbol = symbolPart?.value || currency || 'USD';
    const isNegative = Number(amount) < 0;
    return `${isNegative ? '-' : ''}${symbol}${symbol === currency ? ' ' : ''}${compactValue}`;
};
