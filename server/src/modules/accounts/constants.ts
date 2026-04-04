
export const ACCOUNT_TYPES = {
    ASSET: 1,
    LIABILITY: 2,
    INCOME: 3,
    EXPENSE: 4,
    EQUITY: 5
} as const;

export const ACCOUNT_SUBTYPES = {
    // ASSET (1)
    CASH: 11,
    BANK: 12,
    WALLET: 13,
    INVESTMENT: 14,
    RECEIVABLE: 15,
    OTHER_ASSET: 16,

    // LIABILITY (2)
    LOAN: 21,
    CREDIT_CARD: 22,
    PAYABLE: 23,
    OTHER_LIABILITY: 24,

    // INCOME (3)
    SALES: 31,
    SERVICE: 32,
    INTEREST: 33,
    OTHER_INCOME: 34,

    // EXPENSE (4)
    OPERATING: 41,
    PAYROLL: 42,
    MARKETING: 43,
    TRAVEL: 44,
    BANK_FEES: 45,
    TAX: 46,
    OTHER_EXPENSE: 47,

    // EQUITY (5)
    OWNER_CAPITAL: 51,
    OWNER_DRAWINGS: 52,
    RETAINED_EARNINGS: 53,
    OTHER_EQUITY: 54
} as const;

export const ACCOUNT_TYPE_LABELS: Record<number, string> = {
    1: 'Asset',
    2: 'Liability',
    3: 'Income',
    4: 'Expense',
    5: 'Equity'
};

export const ACCOUNT_SUBTYPE_LABELS: Record<number, string> = {
    11: 'Cash',
    12: 'Bank',
    13: 'Wallet',
    14: 'Investment',
    15: 'Partner Accounts',
    16: 'Other Asset',
    21: 'Loan',
    22: 'Credit Card',
    23: 'Payable',
    24: 'Other Liability',
    31: 'Sales',
    32: 'Service',
    33: 'Interest',
    34: 'Other Income',
    41: 'Operating',
    42: 'Payroll',
    43: 'Marketing',
    44: 'Travel',
    45: 'Bank Fees',
    46: 'Tax',
    47: 'Other Expense',
    51: 'Owner Capital',
    52: 'Owner Drawings',
    53: 'Retained Earnings',
    54: 'Other Equity'
};

export const getTypeFromSubtype = (subtype: number | null | undefined): number | null => {
    if (subtype === null || subtype === undefined || subtype === 0) return null;
    if (subtype >= 11 && subtype <= 19) return 1;
    if (subtype >= 21 && subtype <= 29) return 2;
    if (subtype >= 31 && subtype <= 39) return 3;
    if (subtype >= 41 && subtype <= 49) return 4;
    if (subtype >= 51 && subtype <= 59) return 5;
    return null;
};

export const validateSubtypeMatchesType = (type: number, subtype: number | null | undefined): boolean => {
    if (subtype === null || subtype === undefined || subtype === 0) return true; // Optional subtypes always match
    const derivedType = getTypeFromSubtype(subtype);
    return derivedType === type;
};

export const getAccountTypeName = (type: number): string => {
    return ACCOUNT_TYPE_LABELS[type] || 'Unknown';
};

export const getAccountSubtypeName = (subtype: number | null | undefined): string => {
    if (subtype === null || subtype === undefined || subtype === 0) return 'None';
    return ACCOUNT_SUBTYPE_LABELS[subtype] || 'Unknown';
};
