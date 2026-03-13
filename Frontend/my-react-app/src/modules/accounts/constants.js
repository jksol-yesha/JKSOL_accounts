
export const ACCOUNT_TYPES = {
    ASSET: 1,
    LIABILITY: 2,
    INCOME: 3,
    EXPENSE: 4,
    EQUITY: 5
};

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
};

export const ACCOUNT_TYPE_LABELS = {
    1: 'Asset',
    2: 'Liability',
    3: 'Income',
    4: 'Expense',
    5: 'Equity'
};

export const ACCOUNT_SUBTYPE_LABELS = {
    11: 'Cash',
    12: 'Bank',
    13: 'Wallet',
    14: 'Investment',
    15: 'Receivable',
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

export const SUBTYPE_GROUPS = {
    1: [11, 12, 13, 14, 15, 16],
    2: [21, 22, 23, 24],
    3: [31, 32, 33, 34],
    4: [41, 42, 43, 44, 45, 46, 47],
    5: [51, 52, 53, 54]
};
