import { db } from '../../db';
import { transactions, transactionEntries, categories, subCategories, accounts, transactionTypes, branches, organizations, currencies, parties } from '../../db/schema';
import { eq, and, or, sql, gte, lte, lt, desc, asc, inArray } from 'drizzle-orm';
import { ExchangeRateService } from '../../shared/exchange-rate.service';

const getUserBranchIds = (user?: any): number[] => (
    typeof user?.branchIds === 'string'
        ? user.branchIds.split(',').filter(Boolean).map(Number)
        : (Array.isArray(user?.branchIds) ? user.branchIds : [])
);

const appendBranchFilter = (conditions: any[], branchColumn: any, branchId: number | number[] | 'all', user?: any) => {
    if (branchId === 'all') {
        if (user?.role === 'member') {
            const userBranchIds = getUserBranchIds(user);
            conditions.push(inArray(branchColumn, userBranchIds.length ? userBranchIds : [-1]));
        }
        return;
    }

    if (Array.isArray(branchId)) {
        if (user?.role === 'member') {
            const userBranchIds = getUserBranchIds(user);
            const allowed = branchId.filter(id => userBranchIds.includes(Number(id)));
            conditions.push(inArray(branchColumn, allowed.length ? allowed : [-1]));
        } else {
            conditions.push(inArray(branchColumn, branchId.length ? branchId : [-1]));
        }
        return;
    }

    conditions.push(eq(branchColumn, branchId));
};

const normKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

const pickAccountName = (
    txnType: string,
    entries: Array<{ accountId?: number | null, description: string | null, accountName: string | null }>,
    preferredAccountId?: number
) => {
    const byDesc = (d: string) => entries.find(e => (e.description || '').toLowerCase() === d.toLowerCase())?.accountName;
    const type = (txnType || '').toLowerCase();
    if (preferredAccountId) {
        const exactMatch = entries.find(e => Number(e.accountId) === Number(preferredAccountId))?.accountName;
        if (exactMatch) return exactMatch;
    }

    if (type === 'income') return byDesc('Deposit To') || entries[0]?.accountName || '-';
    if (type === 'expense' || type === 'investment') return byDesc('Paid From') || entries[0]?.accountName || '-';
    if (type === 'transfer') {
        const from = byDesc('Transfer Out');
        const to = byDesc('Transfer In');
        return from || to || entries[0]?.accountName || '-';
    }
    return entries[0]?.accountName || '-';
};

const appendTxnAndCategoryFilters = (
    conditions: any[],
    types: any[],
    filters?: { txnType?: string, categoryId?: number, accountId?: number, party?: string }
) => {
    if (filters?.txnType && filters.txnType !== 'All Types') {
        const typeId = types.find(t => t.name.toLowerCase() === filters.txnType?.toLowerCase())?.id;
        if (typeId) conditions.push(eq(transactions.txnTypeId, typeId));
    }
    if (filters?.categoryId) {
        conditions.push(eq(transactions.categoryId, filters.categoryId));
    }
    if (filters?.party && filters.party !== 'All Parties') {
        conditions.push(sql`EXISTS (SELECT 1 FROM parties p WHERE p.id = ${transactions.contactId} AND lower(p.name) = lower(${filters.party}))`);
    }
};

const fetchDetailedRows = async (
    orgId: number,
    branchId: number | number[] | 'all',
    startDate: string,
    endDate: string,
    filters?: { txnType?: string, categoryId?: number, accountId?: number, party?: string },
    targetCurrency?: string,
    user?: any
) => {
    const types = await db.select().from(transactionTypes);
    const conditions: any[] = [
        eq(transactions.orgId, orgId),
        eq(transactions.status, 1),
        gte(transactions.txnDate, startDate),
        lte(transactions.txnDate, endDate)
    ];
    appendBranchFilter(conditions, transactions.branchId, branchId, user);

    appendTxnAndCategoryFilters(conditions, types, filters);

    const txns = await db.select({
        id: transactions.id,
        txnDate: transactions.txnDate,
        name: transactions.name,
        notes: transactions.notes,
        categoryId: transactions.categoryId,
        txnTypeName: transactionTypes.name,
        currencyCode: currencies.code,
        categoryName: categories.name,
        amountDisplay: sql<string>`COALESCE(${transactions.finalAmount}, ${transactions.amountLocal})`
    })
        .from(transactions)
        .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
        .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(and(...conditions))
        .orderBy(desc(transactions.txnDate), desc(transactions.id));

    const txIds = txns.map(t => t.id).filter(Boolean);
    const entryRows = txIds.length
        ? await db.select({
            transactionId: transactionEntries.transactionId,
            accountId: transactionEntries.accountId,
            description: transactionEntries.description,
            accountName: accounts.name
        })
            .from(transactionEntries)
            .leftJoin(accounts, eq(transactionEntries.accountId, accounts.id))
            .where(inArray(transactionEntries.transactionId, txIds))
        : [];

    const entriesByTxn = new Map<number, Array<{ accountId: number, description: string | null, accountName: string | null }>>();
    for (const row of entryRows as any[]) {
        const list = entriesByTxn.get(row.transactionId) || [];
        list.push(row);
        entriesByTxn.set(row.transactionId, list);
    }

    const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    const finalCurrency = targetCurrency || orgList[0]?.baseCurrency || 'USD';

    const rows: any[] = [];
    for (const t of txns as any[]) {
        const txnEntries = entriesByTxn.get(t.id) || [];
        if (filters?.accountId) {
            const hasAccount = txnEntries.some(e => Number(e.accountId) === Number(filters.accountId));
            if (!hasAccount) continue;
        }

        const amount = await ExchangeRateService.convert(Number(t.amountDisplay || 0), t.currencyCode || 'USD', finalCurrency);
        const txnType = (t.txnTypeName || '').toLowerCase();
        const accountName = pickAccountName(txnType, txnEntries, filters?.accountId);

        rows.push({
            id: t.id,
            date: t.txnDate,
            txnDate: t.txnDate,
            description: t.notes || t.name || '-',
            type: t.txnTypeName || '-',
            txnType,
            amount: amount.toFixed(4),
            amountBase: amount.toFixed(4),
            amountNumeric: amount,
            currency: finalCurrency,
            category: { name: (t.categoryName || '-').trim() || '-' },
            account: { name: (accountName || '-').trim() || '-' }
        });
    }

    return { rows, currency: finalCurrency };
};

export const ReportsService = {
    // 1. Summary Report
    getSummary: async (orgId: number, branchId: number | number[] | 'all', startDate: string, endDate: string, filters?: { txnType?: string, categoryId?: number, accountId?: number, party?: string }, targetCurrency?: string, user?: any) => {
        // Fetch Types
        const types = await db.select().from(transactionTypes);
        const incomeId = types.find(t => t.name === 'Income')?.id;
        const expenseId = types.find(t => t.name === 'Expense')?.id;
        const investmentId = types.find(t => t.name === 'Investment')?.id;

        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const org = orgList[0];
        const finalCurrency = targetCurrency || org?.baseCurrency || 'USD';

        // 1. Calculate Global Opening Balance (Initial + Past Movements)
        const pastConditions = [
            eq(transactions.orgId, orgId),
            eq(transactions.status, 1),
            lt(transactions.txnDate, startDate)
        ];
        // GLOBAL: Opening balance is organization-wide
        const pastMovement = await db.select({
            currency: currencies.code,
            txnTypeId: transactions.txnTypeId,
            totalLocal: sql<string>`SUM(COALESCE(${transactions.finalAmount}, ${transactions.amountLocal}))`
        }).from(transactions)
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .where(and(...pastConditions))
            .groupBy(currencies.code, transactions.txnTypeId);

        let opIn = 0, opOut = 0, opInv = 0;
        for (const r of pastMovement) {
            const amt = await ExchangeRateService.convert(Number(r.totalLocal || 0), r.currency || 'USD', finalCurrency);
            if (r.txnTypeId === incomeId) opIn += amt;
            else if (r.txnTypeId === expenseId) opOut += amt;
            else if (r.txnTypeId === investmentId) opInv += amt;
        }

        const accountRows = await db.select({
            openingBalance: accounts.openingBalance,
            currencyCode: currencies.code
        }).from(accounts)
            .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
            .where(and(eq(accounts.orgId, orgId), eq(accounts.status, 1)));

        let initialAccountBalance = 0;
        for (const acc of accountRows) {
            initialAccountBalance += await ExchangeRateService.convert(Number(acc.openingBalance || 0), acc.currencyCode || 'USD', finalCurrency);
        }

        const openingBalance = initialAccountBalance + (opIn - opOut - opInv);

        // 2. Current Period Totals
        const conditions = [
            eq(transactions.orgId, orgId),
            eq(transactions.status, 1),
            gte(transactions.txnDate, startDate),
            lte(transactions.txnDate, endDate)
        ];
        appendBranchFilter(conditions, transactions.branchId, branchId, user);

        if (filters?.txnType && filters.txnType !== 'All Types') {
            const typeId = types.find(t => t.name.toLowerCase() === filters.txnType?.toLowerCase())?.id;
            if (typeId) conditions.push(eq(transactions.txnTypeId, typeId));
        }
        if (filters?.party && filters.party !== 'All Parties') {
            conditions.push(sql`EXISTS (SELECT 1 FROM parties p WHERE p.id = ${transactions.contactId} AND lower(p.name) = lower(${filters.party}))`);
        }

        const results = await db.select({
            currency: currencies.code,
            txnTypeId: transactions.txnTypeId,
            totalLocal: sql<string>`SUM(COALESCE(${transactions.finalAmount}, ${transactions.amountLocal}))`
        }).from(transactions)
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .where(and(...conditions))
            .groupBy(currencies.code, transactions.txnTypeId);

        let income = 0;
        let expense = 0;
        let investment = 0;

        for (const r of results) {
            const amount = Number(r.totalLocal || 0);
            if (amount === 0) continue;
            const converted = await ExchangeRateService.convert(amount, r.currency || 'USD', finalCurrency);
            if (r.txnTypeId === incomeId) income += converted;
            else if (r.txnTypeId === expenseId) expense += converted;
            else if (r.txnTypeId === investmentId) investment += converted;
        }

        // Net Balance matches Dashboard "Net Profit" (Income - Expense)
        const net = income - expense;
        const closingBalance = openingBalance + (income - expense - investment);

        return {
            openingBalance,
            income,
            expense,
            investment,
            net,
            closingBalance,
            currency: finalCurrency
        };
    },

    // 2. Category-wise Report (Enhanced with Opening/Closing Balance)
    getCategoryWise: async (orgId: number, branchId: number | number[] | 'all', startDate: string, endDate: string, filters?: { txnType?: string, categoryId?: number, accountId?: number, party?: string }, targetCurrency?: string, user?: any) => {
        const { rows, currency } = await fetchDetailedRows(orgId, branchId, startDate, endDate, filters, targetCurrency, user);

        const map = new Map<string, any>();
        for (const row of rows) {
            const name = (row.category?.name || '').trim();
            if (!name || name === '-') continue;
            const key = normKey(name);
            if (!map.has(key)) {
                map.set(key, {
                    name,
                    openingBalance: 0,
                    income: 0,
                    expense: 0,
                    investment: 0,
                    closingBalance: 0,
                    count: 0
                });
            }
            const item = map.get(key);
            const amt = Number(row.amountNumeric || 0);
            if (row.txnType === 'income') item.income += amt;
            else if (row.txnType === 'expense') item.expense += amt;
            else if (row.txnType === 'investment') item.investment += amt;
            item.count += 1;
            item.closingBalance = item.openingBalance + item.income - item.expense - item.investment;
        }

        return {
            type: 'categories',
            tableData: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)),
            currency
        };
    },

    // 3. Account-wise Report (Enhanced with Opening/Closing Balance)
    getAccountWise: async (orgId: number, branchId: number | number[] | 'all', startDate: string, endDate: string, filters?: { txnType?: string, categoryId?: number, accountId?: number, party?: string }, targetCurrency?: string, user?: any) => {
        const types = await db.select().from(transactionTypes);
        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const finalCurrency = targetCurrency || orgList[0]?.baseCurrency || 'USD';

        const accountConditions: any[] = [
            eq(accounts.orgId, orgId),
            eq(accounts.status, 1)
        ];
        // GLOBAL: Accounts are unified
        if (filters?.accountId) {
            accountConditions.push(eq(accounts.id, filters.accountId));
        }

        const accountRows = await db.select({
            id: accounts.id,
            name: accounts.name,
            openingBalance: accounts.openingBalance,
            currencyCode: currencies.code
        })
            .from(accounts)
            .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
            .where(and(...accountConditions))
            .orderBy(asc(accounts.name));

        const accountMap = new Map<number, any>();
        for (const acc of accountRows as any[]) {
            const openingBase = await ExchangeRateService.convert(
                Number(acc.openingBalance || 0),
                acc.currencyCode || 'USD',
                finalCurrency
            );
            accountMap.set(Number(acc.id), {
                accountId: Number(acc.id),
                name: acc.name || '-',
                openingBalance: openingBase,
                income: 0,
                expense: 0,
                investment: 0,
                periodNet: 0,
                closingBalance: openingBase,
                count: 0
            });
        }

        const openingMovementConditions: any[] = [
            eq(transactions.orgId, orgId),
            eq(transactions.status, 1),
            lt(transactions.txnDate, startDate)
        ];
        // GLOBAL: Account past movements are global for consistent balance
        if (filters?.accountId) {
            openingMovementConditions.push(eq(transactionEntries.accountId, filters.accountId));
        }

        const openingMovementRows = await db.select({
            accountId: transactionEntries.accountId,
            currencyCode: currencies.code,
            totalDebit: sql<string>`COALESCE(SUM(${transactionEntries.debit}), 0)`,
            totalCredit: sql<string>`COALESCE(SUM(${transactionEntries.credit}), 0)`
        })
            .from(transactionEntries)
            .innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .where(and(...openingMovementConditions))
            .groupBy(transactionEntries.accountId, currencies.code);

        for (const row of openingMovementRows as any[]) {
            const accountId = Number(row.accountId);
            const item = accountMap.get(accountId);
            if (!item) continue;
            const net = Number(row.totalDebit || 0) - Number(row.totalCredit || 0);
            const converted = await ExchangeRateService.convert(net, row.currencyCode || 'USD', finalCurrency);
            item.openingBalance += converted;
            item.closingBalance = item.openingBalance;
        }

        const periodMovementConditions: any[] = [
            eq(transactions.orgId, orgId),
            eq(transactions.status, 1),
            gte(transactions.txnDate, startDate),
            lte(transactions.txnDate, endDate)
        ];
        appendBranchFilter(periodMovementConditions, transactions.branchId, branchId, user);
        appendTxnAndCategoryFilters(periodMovementConditions, types, filters);
        if (filters?.accountId) {
            periodMovementConditions.push(eq(transactionEntries.accountId, filters.accountId));
        }

        const periodMovementRows = await db.select({
            accountId: transactionEntries.accountId,
            txnTypeName: transactionTypes.name,
            description: transactionEntries.description,
            currencyCode: currencies.code,
            totalDebit: sql<string>`COALESCE(SUM(${transactionEntries.debit}), 0)`,
            totalCredit: sql<string>`COALESCE(SUM(${transactionEntries.credit}), 0)`
        })
            .from(transactionEntries)
            .innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
            .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .where(and(...periodMovementConditions))
            .groupBy(transactionEntries.accountId, transactionTypes.name, transactionEntries.description, currencies.code);

        const periodCountRows = await db.select({
            accountId: transactionEntries.accountId,
            txnCount: sql<string>`COUNT(DISTINCT ${transactionEntries.transactionId})`
        })
            .from(transactionEntries)
            .innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
            .where(and(...periodMovementConditions))
            .groupBy(transactionEntries.accountId);

        const periodCountMap = new Map<number, number>(
            (periodCountRows as any[]).map((row: any) => [Number(row.accountId), Number(row.txnCount || 0)])
        );

        for (const row of periodMovementRows as any[]) {
            const accountId = Number(row.accountId);
            const item = accountMap.get(accountId);
            if (!item) continue;

            const debit = await ExchangeRateService.convert(Number(row.totalDebit || 0), row.currencyCode || 'USD', finalCurrency);
            const credit = await ExchangeRateService.convert(Number(row.totalCredit || 0), row.currencyCode || 'USD', finalCurrency);
            const net = debit - credit;
            const txnType = (row.txnTypeName || '').toLowerCase();
            const description = (row.description || '').toLowerCase();

            item.periodNet += net;
            if (txnType === 'income' && description === 'deposit to') {
                item.income += debit;
            } else if (txnType === 'expense' && description === 'paid from') {
                item.expense += credit;
            } else if (txnType === 'investment' && description === 'paid from') {
                item.investment += credit;
            } else if (txnType === 'transfer') {
                if (net > 0) item.income += net;
                else if (net < 0) item.expense += Math.abs(net);
            }
        }

        const tableData = Array.from(accountMap.values())
            .map((item) => {
                const count = periodCountMap.get(item.accountId) || 0;
                return {
                    ...item,
                    count,
                    closingBalance: item.openingBalance + item.periodNet
                };
            })
            .filter(item => (filters?.accountId ? true : item.count > 0))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(({ accountId, periodNet, ...rest }) => rest);

        return {
            type: 'accounts',
            tableData,
            currency: finalCurrency
        };
    },

    // 4. Detailed Report (Transactions List)
    getDetailed: async (orgId: number, branchId: number | number[] | 'all', startDate: string, endDate: string, filters?: { txnType?: string, categoryId?: number, accountId?: number, party?: string }, targetCurrency?: string, user?: any) => {
        const { rows, currency } = await fetchDetailedRows(orgId, branchId, startDate, endDate, filters, targetCurrency, user);

        return {
            type: 'transactions',
            tableData: rows,
            currency
        };
    },

    // 5. Debit/Credit (Ledger)
    getLedger: async (
        orgId: number,
        branchId: number | number[] | 'all',
        startDate: string,
        endDate: string,
        targetCurrency?: string,
        user?: any,
        filters?: { txnType?: string, categoryId?: number, accountId?: number, party?: string }
    ) => {
        const types = await db.select().from(transactionTypes);
        const incomeId = types.find(t => t.name === 'Income')?.id;
        const expenseId = types.find(t => t.name === 'Expense')?.id;
        const investmentId = types.find(t => t.name === 'Investment')?.id;
        const transferId = types.find(t => t.name === 'Transfer')?.id;

        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const org = orgList[0];
        const finalCurrency = targetCurrency || org?.baseCurrency || 'USD';

        if (filters?.accountId) {
            const [selectedAccount] = await db.select({
                id: accounts.id,
                name: accounts.name,
                openingBalance: accounts.openingBalance,
                currencyCode: currencies.code
            })
                .from(accounts)
                .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
                .where(and(eq(accounts.orgId, orgId), eq(accounts.id, filters.accountId), eq(accounts.status, 1)))
                .limit(1);

            if (!selectedAccount) {
                return {
                    type: 'ledger',
                    openingBalance: 0,
                    closingBalance: 0,
                    tableData: [],
                    currency: finalCurrency
                };
            }

            const openingBase = await ExchangeRateService.convert(
                Number(selectedAccount.openingBalance || 0),
                selectedAccount.currencyCode || 'USD',
                finalCurrency
            );

            const accountPastConditions: any[] = [
                eq(transactions.orgId, orgId),
                eq(transactions.status, 1),
                lt(transactions.txnDate, startDate),
                eq(transactionEntries.accountId, filters.accountId)
            ];
            // GLOBAL: Ledger opening balance is global

            const pastEntryRows = await db.select({
                currencyCode: currencies.code,
                totalDebit: sql<string>`COALESCE(SUM(${transactionEntries.debit}), 0)`,
                totalCredit: sql<string>`COALESCE(SUM(${transactionEntries.credit}), 0)`
            })
                .from(transactionEntries)
                .innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(...accountPastConditions))
                .groupBy(currencies.code);

            let pastNet = 0;
            for (const row of pastEntryRows as any[]) {
                const net = Number(row.totalDebit || 0) - Number(row.totalCredit || 0);
                const converted = await ExchangeRateService.convert(net, row.currencyCode || 'USD', finalCurrency);
                pastNet += converted;
            }

            const openingBalance = openingBase + pastNet;

            const accountLedgerConditions: any[] = [
                eq(transactions.orgId, orgId),
                eq(transactions.status, 1),
                gte(transactions.txnDate, startDate),
                lte(transactions.txnDate, endDate),
                eq(transactionEntries.accountId, filters.accountId)
            ];
            appendBranchFilter(accountLedgerConditions, transactions.branchId, branchId, user);
            appendTxnAndCategoryFilters(accountLedgerConditions, types, filters);

            const accountLedgerRows = await db.select({
                entryId: transactionEntries.id,
                id: transactions.id,
                txnDate: transactions.txnDate,
                name: transactions.name,
                notes: transactions.notes,
                contact: parties.name,
                txnTypeName: transactionTypes.name,
                categoryName: categories.name,
                currencyCode: currencies.code,
                debit: transactionEntries.debit,
                credit: transactionEntries.credit
            })
                .from(transactionEntries)
                .innerJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
                .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
                .leftJoin(categories, eq(transactions.categoryId, categories.id))
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .leftJoin(parties, eq(transactions.contactId, parties.id))
                .where(and(...accountLedgerConditions))
                .orderBy(asc(transactions.txnDate), asc(transactions.id), asc(transactionEntries.id));

            let runningBalance = openingBalance;
            const tableData = [];
            for (const row of accountLedgerRows as any[]) {
                const debit = await ExchangeRateService.convert(Number(row.debit || 0), row.currencyCode || 'USD', finalCurrency);
                const credit = await ExchangeRateService.convert(Number(row.credit || 0), row.currencyCode || 'USD', finalCurrency);
                runningBalance += (debit - credit);

                tableData.push({
                    id: `${row.id}-${row.entryId}`,
                    txnDate: row.txnDate,
                    date: row.txnDate,
                    description: row.notes || row.name || '-',
                    contact: row.contact,
                    debit,
                    credit,
                    balance: runningBalance,
                    txnType: row.txnTypeName || '-',
                    currency: finalCurrency,
                    category: { name: (row.categoryName || '-').trim() || '-' },
                    account: { name: selectedAccount.name || '-' }
                });
            }

            return {
                type: 'ledger',
                openingBalance,
                closingBalance: runningBalance,
                tableData,
                currency: finalCurrency
            };
        }

        const pastConditions: any[] = [
            eq(transactions.orgId, orgId),
            eq(transactions.status, 1),
            lt(transactions.txnDate, startDate)
        ];
        // GLOBAL: Opening balances are global

        const pastResults = await db.select({
            currency: currencies.code,
            totalLocal: sql<string>`
                SUM(
                    CASE 
                        WHEN ${transactions.txnTypeId} = ${incomeId} THEN COALESCE(${transactions.finalAmount}, ${transactions.amountLocal})
                        WHEN ${transactions.txnTypeId} = ${expenseId} THEN -COALESCE(${transactions.finalAmount}, ${transactions.amountLocal})
                        WHEN ${transactions.txnTypeId} = ${investmentId} THEN -COALESCE(${transactions.finalAmount}, ${transactions.amountLocal})
                        ELSE 0
                    END
                )
            `
        })
            .from(transactions)
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .where(and(...pastConditions))
            .groupBy(currencies.code);

        let pastTxnsValue = 0;
        for (const r of pastResults as any[]) {
            const amount = Number(r.totalLocal || 0);
            const converted = await ExchangeRateService.convert(amount, r.currency || 'USD', finalCurrency);
            pastTxnsValue += converted;
        }

        const accountConditions: any[] = [
            eq(accounts.orgId, orgId),
            eq(accounts.status, 1)
        ];
        // GLOBAL: Accounts are unified

        const accOpeningQuery = await db.select({
            openingBalance: accounts.openingBalance,
            currency: currencies.code
        })
            .from(accounts)
            .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
            .where(and(...accountConditions));

        let initialAccountBalance = 0;
        for (const acc of accOpeningQuery as any[]) {
            const converted = await ExchangeRateService.convert(Number(acc.openingBalance || 0), acc.currency || 'USD', finalCurrency);
            initialAccountBalance += converted;
        }

        const finalOpeningBalance = initialAccountBalance + pastTxnsValue;

        const ledgerConditions: any[] = [
            eq(transactions.orgId, orgId),
            eq(transactions.status, 1),
            gte(transactions.txnDate, startDate),
            lte(transactions.txnDate, endDate)
        ];
        appendBranchFilter(ledgerConditions, transactions.branchId, branchId, user);
        appendTxnAndCategoryFilters(ledgerConditions, types, filters);

        const txns = await db.select({
            id: transactions.id,
            orgId: transactions.orgId,
            branchId: transactions.branchId,
            financialYearId: transactions.financialYearId,
            name: transactions.name,
            txnDate: transactions.txnDate,
            txnTypeId: transactions.txnTypeId,
            categoryId: transactions.categoryId,
            subCategoryId: transactions.subCategoryId,
            contact: parties.name,
            notes: transactions.notes,
            amountLocal: transactions.amountLocal,
            currencyId: transactions.currencyId,
            fxRate: transactions.fxRate,
            status: transactions.status,
            attachmentPath: transactions.attachmentPath,
            createdAt: transactions.createdAt,
            updatedAt: transactions.updatedAt,
            transactionType: transactionTypes,
            currency: currencies,
            categoryName: categories.name,
            amountDisplay: sql<string>`COALESCE(${transactions.finalAmount}, ${transactions.amountLocal})`
        })
            .from(transactions)
            .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .leftJoin(parties, eq(transactions.contactId, parties.id))
            .where(and(...ledgerConditions))
            .orderBy(asc(transactions.txnDate), asc(transactions.id));

        const txIds = txns.map((t: any) => t.id).filter(Boolean);
        const entryRows = txIds.length
            ? await db.select({
                transactionId: transactionEntries.transactionId,
                accountId: transactionEntries.accountId,
                description: transactionEntries.description,
                accountName: accounts.name
            })
                .from(transactionEntries)
                .leftJoin(accounts, eq(transactionEntries.accountId, accounts.id))
                .where(inArray(transactionEntries.transactionId, txIds))
            : [];

        const entriesByTxn = new Map<number, Array<{ accountId?: number | null, description: string | null, accountName: string | null }>>();
        for (const row of entryRows as any[]) {
            const list = entriesByTxn.get(row.transactionId) || [];
            list.push(row);
            entriesByTxn.set(row.transactionId, list);
        }

        let runningBalance = finalOpeningBalance;
        const ledger = await Promise.all(txns.map(async (t: any) => {
            const amt = await ExchangeRateService.convert(Number(t.amountDisplay || 0), t.currency?.code || 'USD', finalCurrency);

            let debit = 0;
            let credit = 0;
            const typeId = t.txnTypeId;

            if (typeId === incomeId) {
                credit = amt;
                runningBalance += amt;
            } else if (typeId === expenseId || typeId === investmentId) {
                debit = amt;
                runningBalance -= amt;
            } else if (typeId === transferId) {
                debit = amt;
                credit = amt;
            }

            return {
                ...t,
                debit,
                credit,
                balance: runningBalance,
                txnType: t.transactionType?.name,
                currency: finalCurrency,
                category: { name: (t as any).categoryName || '-' },
                account: { name: pickAccountName(t.transactionType?.name || '', entriesByTxn.get((t as any).id) || []) }
            };
        }));

        return {
            type: 'ledger',
            openingBalance: finalOpeningBalance,
            closingBalance: runningBalance,
            tableData: ledger,
            currency: finalCurrency
        };
    },

    // 6. Profit/Loss Statement
    getProfitLoss: async (
        orgId: number,
        branchId: number | number[] | 'all',
        startDate: string,
        endDate: string,
        filters?: { txnType?: string, txnTypeId?: number, categoryId?: number, accountId?: number, party?: string },
        targetCurrency?: string,
        user?: any
    ) => {
        const types = await db.select().from(transactionTypes);
        const incomeTypeId = types.find(t => (t.name || '').toLowerCase() === 'income')?.id;
        const expenseTypeId = types.find(t => (t.name || '').toLowerCase() === 'expense')?.id;

        const conditions: any[] = [
            eq(transactions.orgId, orgId),
            eq(transactions.status, 1),
            gte(transactions.txnDate, startDate),
            lte(transactions.txnDate, endDate)
        ];
        appendBranchFilter(conditions, transactions.branchId, branchId, user);

        if (filters?.txnTypeId) {
            conditions.push(eq(transactions.txnTypeId, filters.txnTypeId));
        } else if (filters?.txnType && filters.txnType !== 'All Types') {
            const typeId = types.find(t => t.name.toLowerCase() === filters.txnType?.toLowerCase())?.id;
            if (typeId) conditions.push(eq(transactions.txnTypeId, typeId));
        } else if (incomeTypeId && expenseTypeId) {
            conditions.push(inArray(transactions.txnTypeId, [incomeTypeId, expenseTypeId]));
        }

        if (filters?.categoryId) {
            conditions.push(eq(transactions.categoryId, filters.categoryId));
        }
        if (filters?.accountId) {
            conditions.push(eq(transactionEntries.accountId, filters.accountId));
        }
        if (filters?.party && filters.party !== 'All Parties') {
            conditions.push(sql`EXISTS (SELECT 1 FROM parties p WHERE p.id = ${transactions.contactId} AND lower(p.name) = lower(${filters.party}))`);
        }

        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const finalCurrency = targetCurrency || orgList[0]?.baseCurrency || 'USD';

        // Summary totals aligned with Dashboard logic: aggregate transaction totals by type.
        const summaryBuckets = await db.select({
            txnTypeId: transactions.txnTypeId,
            currencyCode: currencies.code,
            totalLocal: sql<string>`SUM(COALESCE(${transactions.finalAmount}, ${transactions.amountLocal}))`
        })
            .from(transactions)
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .where(and(...conditions))
            .groupBy(transactions.txnTypeId, currencies.code);

        let totalIncome = 0;
        let totalExpense = 0;
        for (const bucket of summaryBuckets as any[]) {
            const amount = Number(bucket.totalLocal || 0);
            if (!amount) continue;
            const converted = await ExchangeRateService.convert(amount, bucket.currencyCode || 'USD', finalCurrency);
            if (incomeTypeId && Number(bucket.txnTypeId) === Number(incomeTypeId)) totalIncome += converted;
            if (expenseTypeId && Number(bucket.txnTypeId) === Number(expenseTypeId)) totalExpense += converted;
        }

        const { rows: detailedRows } = await fetchDetailedRows(
            orgId,
            branchId,
            startDate,
            endDate,
            filters as any,
            targetCurrency,
            user
        );

        type CategoryGroup = { category: string, total: number, items: Array<{ subCategory: string, account: string, amount: number }> };
        const incomeMap = new Map<string, { total: number, items: Map<string, { subCategory: string, account: string, amount: number }> }>();
        const expenseMap = new Map<string, { total: number, items: Map<string, { subCategory: string, account: string, amount: number }> }>();

        for (const row of detailedRows as any[]) {
            const txnType = String(row.txnType || '').toLowerCase();
            const amount = Number(row.amountNumeric || 0);
            if (amount <= 0) continue;

            const category = (row.category?.name || 'Uncategorized').toString().trim() || 'Uncategorized';
            const subCategory = category;
            const account = (
                row.account?.name
                || row.account
                || 'Uncategorized'
            ).toString().trim() || 'Uncategorized';
            const itemKey = `${normKey(subCategory)}|${normKey(account)}`;

            if (txnType === 'income') {
                if (!incomeMap.has(category)) incomeMap.set(category, { total: 0, items: new Map() });
                const group = incomeMap.get(category)!;
                group.total += amount;
                if (!group.items.has(itemKey)) group.items.set(itemKey, { subCategory, account, amount: 0 });
                group.items.get(itemKey)!.amount += amount;
            } else if (txnType === 'expense') {
                if (!expenseMap.has(category)) expenseMap.set(category, { total: 0, items: new Map() });
                const group = expenseMap.get(category)!;
                group.total += amount;
                if (!group.items.has(itemKey)) group.items.set(itemKey, { subCategory, account, amount: 0 });
                group.items.get(itemKey)!.amount += amount;
            }
        }

        const toCategoryArray = (source: Map<string, { total: number, items: Map<string, { subCategory: string, account: string, amount: number }> }>): CategoryGroup[] =>
            Array.from(source.entries()).map(([category, value]) => ({
                category,
                total: value.total,
                items: Array.from(value.items.values()).sort((a, b) => {
                    const sub = a.subCategory.localeCompare(b.subCategory);
                    return sub !== 0 ? sub : a.account.localeCompare(b.account);
                })
            })).sort((a, b) => a.category.localeCompare(b.category));

        const income = toCategoryArray(incomeMap);
        const expenses = toCategoryArray(expenseMap);
        const netProfit = totalIncome - totalExpense;

        const tableData = [
            ...income.flatMap((group) => group.items.map((item) => ({
                section: 'income',
                category: group.category,
                subCategory: item.subCategory,
                account: item.account,
                amount: item.amount
            }))),
            ...expenses.flatMap((group) => group.items.map((item) => ({
                section: 'expense',
                category: group.category,
                subCategory: item.subCategory,
                account: item.account,
                amount: item.amount
            })))
        ];

        return {
            type: 'profit-loss',
            currency: finalCurrency,
            income,
            expenses,
            tableData,
            summary: {
                totalIncome,
                totalExpense,
                netProfit,
                income: totalIncome,
                expense: totalExpense,
                net: netProfit
            }
        };
    }
}
