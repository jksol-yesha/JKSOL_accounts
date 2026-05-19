// Accounts Storage
export const getAccounts = () => {
    const accounts = localStorage.getItem('accounts');
    if (!accounts) {
        const baseTime = Date.now();
        const initialData = [
            // Set 1
            { id: baseTime + 1, bankName: 'HDFC Bank', accountNo: '123456789012', ifsc: 'HDFC0001234', branch: 'Main Branch, NY', balance: '25,000.00' },
            { id: baseTime + 2, bankName: 'SBI Bank', accountNo: '987654321098', ifsc: 'SBIN0004567', branch: 'Downtown, SF', balance: '12,400.00' },
            { id: baseTime + 3, bankName: 'ICICI Bank', accountNo: '456789012345', ifsc: 'ICIC0008901', branch: 'Lakeview, CH', balance: '8,900.00' },
            { id: baseTime + 4, bankName: 'Axis Bank', accountNo: '234567890123', ifsc: 'UTIB0002345', branch: 'Westside, LA', balance: '45,600.00' },
            { id: baseTime + 5, bankName: 'Kotak Bank', accountNo: '678901234567', ifsc: 'KKBK0006789', branch: 'Central, TX', balance: '15,200.00' },
            { id: baseTime + 6, bankName: 'Bank of Baroda', accountNo: '345678901234', ifsc: 'BARB0003456', branch: 'Riverfront, FL', balance: '3,450.00' },

            // Set 2 (Unique IDs)
            { id: baseTime + 7, bankName: 'HDFC Bank', accountNo: '123456789012', ifsc: 'HDFC0001234', branch: 'Main Branch, NY', balance: '25,000.00' },
            { id: baseTime + 8, bankName: 'SBI Bank', accountNo: '987654321098', ifsc: 'SBIN0004567', branch: 'Downtown, SF', balance: '12,400.00' },
            { id: baseTime + 9, bankName: 'ICICI Bank', accountNo: '456789012345', ifsc: 'ICIC0008901', branch: 'Lakeview, CH', balance: '8,900.00' },
            { id: baseTime + 10, bankName: 'Axis Bank', accountNo: '234567890123', ifsc: 'UTIB0002345', branch: 'Westside, LA', balance: '45,600.00' },
            { id: baseTime + 11, bankName: 'Kotak Bank', accountNo: '678901234567', ifsc: 'KKBK0006789', branch: 'Central, TX', balance: '15,200.00' },
            { id: baseTime + 12, bankName: 'Bank of Baroda', accountNo: '345678901234', ifsc: 'BARB0003456', branch: 'Riverfront, FL', balance: '3,450.00' },

            // Set 3 (Unique IDs)
            { id: baseTime + 13, bankName: 'HDFC Bank', accountNo: '123456789012', ifsc: 'HDFC0001234', branch: 'Main Branch, NY', balance: '25,000.00' },
            { id: baseTime + 14, bankName: 'SBI Bank', accountNo: '987654321098', ifsc: 'SBIN0004567', branch: 'Downtown, SF', balance: '12,400.00' },
            { id: baseTime + 15, bankName: 'ICICI Bank', accountNo: '456789012345', ifsc: 'ICIC0008901', branch: 'Lakeview, CH', balance: '8,900.00' },
            { id: baseTime + 16, bankName: 'Axis Bank', accountNo: '234567890123', ifsc: 'UTIB0002345', branch: 'Westside, LA', balance: '45,600.00' },
            { id: baseTime + 17, bankName: 'Kotak Bank', accountNo: '678901234567', ifsc: 'KKBK0006789', branch: 'Central, TX', balance: '15,200.00' },
            { id: baseTime + 18, bankName: 'Bank of Baroda', accountNo: '345678901234', ifsc: 'BARB0003456', branch: 'Riverfront, FL', balance: '3,450.00' },

            // Set 4 (Unique IDs)
            { id: baseTime + 19, bankName: 'HDFC Bank', accountNo: '123456789012', ifsc: 'HDFC0001234', branch: 'Main Branch, NY', balance: '25,000.00' },
            { id: baseTime + 20, bankName: 'SBI Bank', accountNo: '987654321098', ifsc: 'SBIN0004567', branch: 'Downtown, SF', balance: '12,400.00' },
            { id: baseTime + 21, bankName: 'ICICI Bank', accountNo: '456789012345', ifsc: 'ICIC0008901', branch: 'Lakeview, CH', balance: '8,900.00' },
            { id: baseTime + 22, bankName: 'Axis Bank', accountNo: '234567890123', ifsc: 'UTIB0002345', branch: 'Westside, LA', balance: '45,600.00' },
            { id: baseTime + 23, bankName: 'Kotak Bank', accountNo: '678901234567', ifsc: 'KKBK0006789', branch: 'Central, TX', balance: '15,200.00' },
            { id: baseTime + 24, bankName: 'Bank of Baroda', accountNo: '345678901234', ifsc: 'BARB0003456', branch: 'Riverfront, FL', balance: '3,450.00' },
        ];
        localStorage.setItem('accounts', JSON.stringify(initialData));
        return initialData;
    }
    return JSON.parse(accounts);
};

export const saveAccount = (account) => {
    const accounts = getAccounts();
    const balanceValue = typeof account.openingBalance === 'string'
        ? parseFloat(account.openingBalance.replace(/,/g, ''))
        : parseFloat(account.openingBalance || 0);

    const newAccount = {
        ...account,
        id: Date.now(),
        balance: balanceValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    };
    const updatedAccounts = [newAccount, ...accounts];
    localStorage.setItem('accounts', JSON.stringify(updatedAccounts));
    return updatedAccounts;
};

export const updateAccount = (id, updatedData) => {
    const accounts = getAccounts();
    const updatedAccounts = accounts.map(acc => {
        if (acc.id === id) {
            const balanceValue = updatedData.openingBalance
                ? (typeof updatedData.openingBalance === 'string'
                    ? parseFloat(updatedData.openingBalance.replace(/,/g, ''))
                    : parseFloat(updatedData.openingBalance))
                : parseFloat(acc.balance.replace(/,/g, ''));

            return {
                ...acc,
                ...updatedData,
                balance: balanceValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            };
        }
        return acc;
    });
    localStorage.setItem('accounts', JSON.stringify(updatedAccounts));
    return updatedAccounts;
};

export const deleteAccount = (id) => {
    const accounts = getAccounts();
    const updatedAccounts = accounts.filter(acc => acc.id !== id);
    localStorage.setItem('accounts', JSON.stringify(updatedAccounts));
    return updatedAccounts;
};

// Categories Storage
export const getCategories = () => {
    const categories = localStorage.getItem('categories');
    if (!categories) {
        const initialData = [
            { id: 'cat_1', name: 'Salary', type: 'Income', icon: 'Wallet', referenceId: '#C-041', amount: '85,000.00' },
            { id: 'cat_2', name: 'Electricity Bill', type: 'Expense', icon: 'Zap', referenceId: '#C-042', amount: '2,400.00' },
            { id: 'cat_3', name: 'Entertainment', type: 'Expense', icon: 'Tv', referenceId: '#C-043', amount: '5,000.00' },
            { id: 'cat_4', name: 'Groceries', type: 'Expense', icon: 'ShoppingBag', referenceId: '#C-044', amount: '12,000.00' },
            { id: 'cat_5', name: 'Transport', type: 'Expense', icon: 'Car', referenceId: '#C-045', amount: '3,500.00' },
            { id: 'cat_6', name: 'Freelance', type: 'Income', icon: 'Briefcase', referenceId: '#C-046', amount: '15,000.00' },
            { id: 'cat_7', name: 'Health', type: 'Expense', icon: 'Activity', referenceId: '#C-047', amount: '4,000.00' },
            { id: 'cat_8', name: 'Dividends', type: 'Income', icon: 'TrendingUp', referenceId: '#C-048', amount: '8,000.00' },
        ];
        localStorage.setItem('categories', JSON.stringify(initialData));
        return initialData;
    }
    return JSON.parse(categories);
};

export const saveCategory = (category) => {
    const categories = getCategories();
    const newCategory = {
        ...category,
        id: `cat_${Date.now()}`,
        referenceId: `#C-${Math.floor(Math.random() * 900) + 100}`
    };
    const updated = [newCategory, ...categories];
    localStorage.setItem('categories', JSON.stringify(updated));
    return updated;
};

export const updateCategory = (id, updatedData) => {
    const categories = getCategories();
    const updated = categories.map(c => c.id === id ? { ...c, ...updatedData } : c);
    localStorage.setItem('categories', JSON.stringify(updated));
    return updated;
};

export const deleteCategory = (id) => {
    const categories = getCategories();
    const updated = categories.filter(c => c.id !== id);
    localStorage.setItem('categories', JSON.stringify(updated));

    // Also cleanup sub-categories
    const subs = getSubCategories();
    const filteredSubs = subs.filter(s => s.parentId !== id);
    localStorage.setItem('subCategories', JSON.stringify(filteredSubs));

    return updated;
};

// Sub-categories Storage
export const getSubCategories = () => {
    const subs = localStorage.getItem('subCategories');
    if (!subs) {
        const initialData = [
            { id: 'sub_1', parentId: 'cat_3', name: 'Movie watch', referenceId: '#S-005' },
            { id: 'sub_2', parentId: 'cat_3', name: 'Hotel Food', referenceId: '#S-006' },
        ];
        localStorage.setItem('subCategories', JSON.stringify(initialData));
        return initialData;
    }
    return JSON.parse(subs);
};

export const saveSubCategory = (sub) => {
    const subs = getSubCategories();
    const newSub = {
        ...sub,
        id: `sub_${Date.now()}`,
        referenceId: `#S-${Math.floor(Math.random() * 900) + 100}`
    };
    const updated = [newSub, ...subs];
    localStorage.setItem('subCategories', JSON.stringify(updated));
    return updated;
};

export const updateSubCategory = (id, updatedData) => { const subs = getSubCategories(); const updated = subs.map(s => s.id === id ? { ...s, ...updatedData } : s); localStorage.setItem("subCategories", JSON.stringify(updated)); return updated; };

export const deleteSubCategory = (id) => {
    const subs = getSubCategories();
    const updated = subs.filter(s => s.id !== id);
    localStorage.setItem('subCategories', JSON.stringify(updated));
    return updated;
};

// Transactions Storage
export const getTransactions = () => {
    const transactions = localStorage.getItem('transactions');
    if (!transactions) {
        const initialData = [
            {
                id: 'tx_1',
                date: '2025-01-01',
                description: 'Office Rent',
                category: 'Expense',
                subCategory: 'Rent',
                type: 'Expense',
                method: 'Bank Transfer',
                party: 'Landlord',
                amount: 25000,
                status: 'Completed'
            },
            {
                id: 'tx_2',
                date: '2025-01-05',
                description: 'Client Payment',
                category: 'Income',
                subCategory: 'Project A',
                type: 'Income',
                method: 'UPI',
                party: 'Tech Corp',
                amount: 50000,
                status: 'Completed'
            },
            {
                id: 'tx_3',
                date: '2025-01-06',
                description: 'Server Costs',
                category: 'Expense',
                subCategory: 'Infrastructure',
                type: 'Expense',
                method: 'Credit Card',
                party: 'AWS',
                amount: 4500,
                status: 'Pending'
            }
        ];
        localStorage.setItem('transactions', JSON.stringify(initialData));
        return initialData;
    }
    return JSON.parse(transactions);
};

export const saveTransaction = (transaction) => {
    const transactions = getTransactions();
    const newTransaction = {
        ...transaction,
        id: `tx_${Date.now()}`,
        amount: parseFloat(transaction.amount)
    };
    const updated = [newTransaction, ...transactions];
    localStorage.setItem('transactions', JSON.stringify(updated));
    return updated;
};

export const updateTransaction = (id, updatedData) => {
    const transactions = getTransactions();
    const updated = transactions.map(t => t.id === id ? { ...t, ...updatedData } : t);
    localStorage.setItem('transactions', JSON.stringify(updated));
    return updated;
};

export const deleteTransaction = (id) => {
    const transactions = getTransactions();
    const updated = transactions.filter(t => t.id !== id);
    localStorage.setItem('transactions', JSON.stringify(updated));
    return updated;
};
