export const CURRENCY_OPTIONS = [
    { value: 'INR', label: '₹ - Indian Rupee (INR)' },
    { value: 'USD', label: '$ - US Dollar (USD)' },
    { value: 'EUR', label: '€ - Euro (EUR)' },
    { value: 'GBP', label: '£ - British Pound (GBP)' },
    { value: 'AED', label: 'د.إ - UAE Dirham (AED)' }
];

export const generateDatePresets = (selectedYear, previousYear) => {
    const today = new Date();
    const formatDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const getPastMonthRange = (months) => {
        const endDate = formatDate(new Date(today.getFullYear(), today.getMonth(), 0));
        const startDate = formatDate(new Date(today.getFullYear(), today.getMonth() - months, 1));
        return { startDate, endDate };
    };

    return [
        { label: 'Current FY', value: 'current', range: { startDate: selectedYear?.startDate, endDate: selectedYear?.endDate || formatDate(today), preset: 'current' } },
        ...(previousYear?.startDate ? [{ label: 'Last FY', value: 'last_fy', range: { startDate: previousYear.startDate, endDate: previousYear.endDate, preset: 'last_fy' } }] : []),
        { label: 'Last Month', value: 'last_month', range: { ...getPastMonthRange(1), preset: 'last_month' } },
        { label: 'Last 3 Months', value: 'last_3_months', range: { ...getPastMonthRange(3), preset: 'last_3_months' } },
        { label: 'Last 6 Months', value: 'last_6_months', range: { ...getPastMonthRange(6), preset: 'last_6_months' } },
        { label: 'Last 9 Months', value: 'last_9_months', range: { ...getPastMonthRange(9), preset: 'last_9_months' } }
    ];
};
