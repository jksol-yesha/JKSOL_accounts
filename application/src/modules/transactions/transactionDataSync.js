export const TRANSACTION_DATA_CHANGED_EVENT = 'transactions:data-changed';

const TRANSACTION_DERIVED_CACHE_PREFIXES = [
    'accounts:list:',
    'dashboard:summary:',
    'dashboard:rankings:',
    'dashboard:recentTx:',
    'transactions:list:'
];

export const invalidateTransactionDerivedCaches = () => {
    if (typeof window === 'undefined') return;

    Object.keys(window.sessionStorage).forEach((key) => {
        if (TRANSACTION_DERIVED_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
            window.sessionStorage.removeItem(key);
        }
    });
};

export const notifyTransactionDataChanged = () => {
    if (typeof window === 'undefined') return;

    invalidateTransactionDerivedCaches();
    window.dispatchEvent(new Event(TRANSACTION_DATA_CHANGED_EVENT));
};
