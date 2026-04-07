
import { db } from '../../db';
import { transactions, financialYears, categories, accounts, organizations, branches, transactionTypes, transactionEntries, currencies } from '../../db/schema';
import { eq, and, lt, lte, gte, sql, inArray, or } from 'drizzle-orm';
import { ExchangeRateService } from '../../shared/exchange-rate.service';
import { resolveBankFromIfsc } from '../../shared/ifsc-bank';
import { isNotDeleted } from '../../shared/soft-delete';

const monthDiffInclusive = (startDate: string, endDate: string) => {
    const [startYear = 0, startMonth = 1] = startDate.split('-').map(Number);
    const [endYear = 0, endMonth = 1] = endDate.split('-').map(Number);
    return ((endYear - startYear) * 12) + (endMonth - startMonth) + 1;
};

const addMonths = (dateStr: string, offset: number) => {
    const [year = 0, month = 1, day = 1] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + offset, day || 1));
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        label: date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
    };
};

const applyTxnBranchFilter = (whereClause: any[], branchId: number | number[] | null, user?: any) => {
    if (Array.isArray(branchId)) {
        whereClause.push(inArray(transactions.branchId, branchId.length ? branchId : [-1]));
        return;
    }

    if (branchId !== null) {
        whereClause.push(eq(transactions.branchId, branchId));
        return;
    }

    if (user && user.role === 'member') {
        const userBranchIds = typeof user.branchIds === 'string'
            ? user.branchIds.split(',').filter(Boolean).map(Number)
            : (Array.isArray(user.branchIds) ? user.branchIds : []);
        if (userBranchIds.length > 0) {
            whereClause.push(inArray(transactions.branchId, userBranchIds));
        } else {
            whereClause.push(eq(transactions.branchId, -1));
        }
    }
};

const applyAccountBranchFilter = (whereClause: any[], branchId: number | number[] | null, user?: any) => {
    // NOTE: 'accounts' table does not have 'branchId' column in current schema.
    // Accounts are organization-wide. Ignoring branch filter for account lookups.
    return;
};

const convertAmount = async (amount: number, sourceCurrency: string, targetCurrency: string, orgId?: number) => {
    if (!Number.isFinite(amount) || amount === 0) return 0;
    if (!sourceCurrency || sourceCurrency === targetCurrency) return amount;
    return ExchangeRateService.convert(amount, sourceCurrency, targetCurrency, orgId);
};

const TXN_DISPLAY_AMOUNT_SQL = sql<string>`
    CASE
        WHEN ${transactions.isTaxable} = 1 AND ${transactions.finalAmount} IS NOT NULL THEN ${transactions.finalAmount}
        ELSE ${transactions.amountLocal}
    END
`;

const resolveTxnCurrency = (currencyCode?: string | null, fallbackCurrency = 'INR') => {
    const normalized = String(currencyCode || '').trim().toUpperCase();
    return normalized || fallbackCurrency;
};

export const DashboardService = {
    getSummary: async (orgId: number, branchId: number | number[] | null, financialYearId: number, targetCurrency?: string, user?: any) => {
        // 1. Get Financial Year Details
        const fyList = await db.select().from(financialYears).where(eq(financialYears.id, financialYearId)).limit(1);
        const fy = fyList[0];
        if (!fy) throw new Error('Financial Year not found');

        const { startDate, endDate } = fy;

        // 1b. Get Organization Base Currency AND Display Currency
        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const org = orgList[0];
        const orgBaseCurrency = org?.baseCurrency || 'INR';
        const displayCurrency = targetCurrency || orgBaseCurrency;

        // Helper: Dynamic Aggregation
        // Returns total converted to Display Currency
        const getDynamicTotal = async (
            filterFn: (t: typeof transactions) => any
        ): Promise<number> => {
            const whereClause = [
                eq(transactions.orgId, orgId),
                isNotDeleted(transactions),
                filterFn(transactions)
            ];

            applyTxnBranchFilter(whereClause, branchId, user);

            const rows = await db.select({
                currencyCode: currencies.code,
                totalDisplayValue: sql<string>`SUM(${TXN_DISPLAY_AMOUNT_SQL})`
            })
                .from(transactions)
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(...whereClause))
                .groupBy(currencies.code);
            
            let total = 0;
            for (const row of rows) {
                const amount = Number(row.totalDisplayValue || 0);
                if (!amount) continue;

                total += await convertAmount(
                    amount,
                    resolveTxnCurrency(row.currencyCode, orgBaseCurrency),
                    displayCurrency,
                    orgId
                );
            }

            return total;
        };

        // Investment total based on actual entries posted to Investment accounts
        const getInvestmentTotal = async (
            dateFilter: (t: typeof transactions) => any
        ): Promise<number> => {
            const whereClause = [
                eq(transactions.orgId, orgId),
                isNotDeleted(transactions),
                eq(transactions.status, 1),
                dateFilter(transactions),
                isNotDeleted(accounts),
                eq(accounts.accountType, 1),
                eq(accounts.subtype, 14)
            ];

            applyTxnBranchFilter(whereClause, branchId, user);

            const rows = await db.select({
                currencyCode: currencies.code,
                totalNetAmount: sql<string>`SUM(${transactionEntries.debit} - ${transactionEntries.credit})`
            })
                .from(transactionEntries)
                .innerJoin(transactions, eq(transactionEntries.transactionId, transactions.id))
                .innerJoin(accounts, eq(transactionEntries.accountId, accounts.id))
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(...whereClause))
                .groupBy(currencies.code);

            let total = 0;
            for (const row of rows) {
                const amount = Number(row.totalNetAmount || 0);
                if (!amount) continue;

                total += await convertAmount(
                    amount,
                    resolveTxnCurrency(row.currencyCode, orgBaseCurrency),
                    displayCurrency,
                    orgId
                );
            }

            return total;
        };

        // 1c. Fetch Transaction Types (Support multiple IDs for same name)
        const types = await db.select().from(transactionTypes);
        const getTypeIds = (...aliases: string[]) =>
            types.filter(t => aliases.includes((t.name || '').toLowerCase())).map(t => t.id);
        
        const incomeIds = getTypeIds('income');
        const expenseIds = getTypeIds('expense');
        const investmentIds = getTypeIds('investment', 'invest');

        // 2. Opening Balance (Sum IN - Sum OUT) before start date
        const openingIn = await getDynamicTotal(
            (t) => and(
                lt(t.txnDate, startDate),
                eq(t.status, 1),
                incomeIds.length > 0 ? inArray(t.txnTypeId, incomeIds) : sql`1=0`
            )
        );

        const openingOut = await getDynamicTotal(
            (t) => and(
                lt(t.txnDate, startDate),
                eq(t.status, 1),
                expenseIds.length > 0 ? inArray(t.txnTypeId, expenseIds) : sql`1=0`
            )
        );

        const openingInvestment = await getDynamicTotal(
            (t) => and(
                lt(t.txnDate, startDate),
                eq(t.status, 1),
                investmentIds.length > 0 ? inArray(t.txnTypeId, investmentIds) : sql`1=0`
            )
        );

        // Account Opening Balances (Corrected: convert each account individually)
        // GLOBAL: Accounts are unified organization-wide
        const accountFilters = [
            eq(accounts.orgId, orgId),
            isNotDeleted(accounts),
            eq(accounts.status, 1)
        ];

        const activeAccounts = await db.select({
            openingBalance: accounts.openingBalance,
            currencyCode: currencies.code
        }).from(accounts)
            .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
            .where(and(...accountFilters));

        let initialAccountBalanceBase = 0;
        for (const acc of activeAccounts) {
            const balance = Number(acc.openingBalance || 0);
            const converted = await ExchangeRateService.convert(balance, acc.currencyCode || 'USD', displayCurrency);
            initialAccountBalanceBase += converted;
        }

        // User Request Update: Opening Balance MUST include past transactions to carry over closing balance from previous years.
        const openingBalance = initialAccountBalanceBase + (openingIn - openingOut - openingInvestment);

        // 3. Current Period Totals
        const totalIncome = await getDynamicTotal(
            (t) => and(
                gte(t.txnDate, startDate),
                lte(t.txnDate, endDate),
                eq(t.status, 1),
                incomeIds.length > 0 ? inArray(t.txnTypeId, incomeIds) : sql`1=0`
            )
        );

        const totalExpense = await getDynamicTotal(
            (t) => and(
                gte(t.txnDate, startDate),
                lte(t.txnDate, endDate),
                eq(t.status, 1),
                expenseIds.length > 0 ? inArray(t.txnTypeId, expenseIds) : sql`1=0`
            )
        );

        const totalInvestmentByAccount = await getInvestmentTotal(
            (t) => and(
                gte(t.txnDate, startDate),
                lte(t.txnDate, endDate)
            )
        );
        const totalInvestmentByType = investmentIds.length > 0
            ? await getDynamicTotal(
                (t) => and(
                    gte(t.txnDate, startDate),
                    lte(t.txnDate, endDate),
                    eq(t.status, 1),
                    inArray(t.txnTypeId, investmentIds)
                )
            )
            : 0;
        const totalInvestment = totalInvestmentByAccount > 0
            ? totalInvestmentByAccount
            : totalInvestmentByType;

        // 4. Closing Balance (Opening + Net Flow - Investment Outflow)
        const closingBalance = openingBalance + (totalIncome - totalExpense - totalInvestment);

        return {
            baseCurrency: displayCurrency, // Return the currency we converted to
            openingBalance,
            totalIncome,
            totalExpense,
            totalInvestment,
            closingBalance
        };
    },

    getTrends: async (
        orgId: number,
        branchId: number | number[] | null,
        financialYearId: number,
        compareFinancialYearId?: number,
        targetCurrency?: string,
        user?: any
    ) => {
        const fyIds = [financialYearId, compareFinancialYearId].filter(Boolean) as number[];
        const fyRows = await db
            .select()
            .from(financialYears)
            .where(inArray(financialYears.id, fyIds));

        const currentFy = fyRows.find((fy) => Number(fy.id) === Number(financialYearId));
        if (!currentFy) throw new Error('Financial Year not found');

        const compareFy = compareFinancialYearId
            ? fyRows.find((fy) => Number(fy.id) === Number(compareFinancialYearId))
            : null;

        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const org = orgList[0];
        const orgBaseCurrency = org?.baseCurrency || 'INR';
        const displayCurrency = targetCurrency || orgBaseCurrency;

        const types = await db.select().from(transactionTypes);
        const getTypeId = (...aliases: string[]) =>
            types.find(t => aliases.includes((t.name || '').toLowerCase()))?.id;
        const incomeId = getTypeId('income');
        const expenseId = getTypeId('expense');
        const investmentId = getTypeId('investment', 'invest');

        const buildPeriodSeries = async (fy: typeof currentFy) => {
            const monthCount = Math.max(1, monthDiffInclusive(fy.startDate, fy.endDate));
            const labels = Array.from({ length: monthCount }, (_, index) => addMonths(fy.startDate, index).label);
            const monthKeyToIndex = new Map<string, number>();

            Array.from({ length: monthCount }, (_, index) => addMonths(fy.startDate, index)).forEach((item, index) => {
                monthKeyToIndex.set(`${item.year}-${String(item.month).padStart(2, '0')}`, index);
            });

            // Use plural IDs for matching
            const types = await db.select().from(transactionTypes);
            const getTypeIds = (...aliases: string[]) =>
                types.filter(t => aliases.includes((t.name || '').toLowerCase())).map(t => t.id);
            
            const incomeIds = getTypeIds('income');
            const expenseIds = getTypeIds('expense');
            const investmentIds = getTypeIds('investment', 'invest');

            const whereClause = [
                eq(transactions.orgId, orgId),
                isNotDeleted(transactions),
                eq(transactions.status, 1),
                gte(transactions.txnDate, fy.startDate),
                lte(transactions.txnDate, fy.endDate)
            ];

            applyTxnBranchFilter(whereClause, branchId, user);

            const rows = await db.select({
                monthKey: sql<string>`DATE_FORMAT(${transactions.txnDate}, '%Y-%m')`,
                typeName: transactionTypes.name,
                currencyCode: currencies.code,
                totalDisplayValue: sql<string>`SUM(${TXN_DISPLAY_AMOUNT_SQL})`
            })
                .from(transactions)
                .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(...whereClause))
                .groupBy(
                    sql`DATE_FORMAT(${transactions.txnDate}, '%Y-%m')`,
                    transactionTypes.name,
                    currencies.code
                );

            const investmentWhereClause = [
                eq(transactions.orgId, orgId),
                isNotDeleted(transactions),
                eq(transactions.status, 1),
                gte(transactions.txnDate, fy.startDate),
                lte(transactions.txnDate, fy.endDate),
                isNotDeleted(accounts),
                eq(accounts.accountType, 1),
                eq(accounts.subtype, 14)
            ];

            applyTxnBranchFilter(investmentWhereClause, branchId, user);

            const investmentRows = await db.select({
                monthKey: sql<string>`DATE_FORMAT(${transactions.txnDate}, '%Y-%m')`,
                currencyCode: currencies.code,
                totalNetAmount: sql<string>`SUM(${transactionEntries.debit} - ${transactionEntries.credit})`
            })
                .from(transactionEntries)
                .innerJoin(transactions, eq(transactionEntries.transactionId, transactions.id))
                .innerJoin(accounts, eq(transactionEntries.accountId, accounts.id))
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(...investmentWhereClause))
                .groupBy(
                    sql`DATE_FORMAT(${transactions.txnDate}, '%Y-%m')`,
                    currencies.code
                );

            const income = Array(monthCount).fill(0);
            const expense = Array(monthCount).fill(0);
            const investmentByType = Array(monthCount).fill(0);
            const investmentByAccount = Array(monthCount).fill(0);

            for (const row of rows) {
                const index = monthKeyToIndex.get(String(row.monthKey || ''));
                if (index === undefined) continue;

                const totalAmount = Number(row.totalDisplayValue || 0);
                const converted = await convertAmount(
                    totalAmount,
                    resolveTxnCurrency(row.currencyCode, orgBaseCurrency),
                    displayCurrency,
                    orgId
                );

                const typeName = (row.typeName || '').toLowerCase();
                if (typeName === 'income') income[index] += converted;
                if (typeName === 'expense') expense[index] += converted;
                if (typeName === 'investment' || typeName === 'invest') investmentByType[index] += converted;
            }

            for (const row of investmentRows) {
                const index = monthKeyToIndex.get(String(row.monthKey || ''));
                if (index === undefined) continue;

                const netAmount = Number(row.totalNetAmount || 0);
                if (netAmount <= 0) continue;

                const converted = await convertAmount(
                    netAmount,
                    resolveTxnCurrency(row.currencyCode, orgBaseCurrency),
                    displayCurrency,
                    orgId
                );

                investmentByAccount[index] += converted;
            }

            const investment = investmentByAccount.map((value, index) => value > 0 ? value : investmentByType[index]);
            const netProfit = income.map((value, index) => value - expense[index]);

            return {
                financialYearId: fy.id,
                financialYearName: fy.name,
                labels,
                metrics: {
                    netProfit,
                    totalIncome: income,
                    totalExpense: expense,
                    totalInvestment: investment
                }
            };
        };

        const currentSeries = await buildPeriodSeries(currentFy);
        const compareSeries = compareFy ? await buildPeriodSeries(compareFy) : null;

        return {
            baseCurrency: displayCurrency,
            labels: currentSeries.labels,
            current: currentSeries,
            previous: compareSeries
        };
    },

    getCategoryRankings: async (orgId: number, branchId: number | number[] | null, financialYearId: number, targetCurrency?: string, user?: any) => {
        // 1. Get Financial Year
        const fyList = await db.select().from(financialYears).where(eq(financialYears.id, financialYearId)).limit(1);
        const fy = fyList[0];
        if (!fy) throw new Error('Financial Year not found');

        const { startDate, endDate } = fy;

        // 1b. Get Org Details for Base Currency
        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const org = orgList[0];
        const orgBaseCurrency = org?.baseCurrency || 'INR';
        const displayCurrency = targetCurrency || orgBaseCurrency;

        // 2. Aggregate FY transactions by Category (Income/Expense/Investment)
        const whereClause = [
            eq(transactions.orgId, orgId),
            isNotDeleted(transactions),
            eq(transactions.status, 1), // 1 = posted
            gte(transactions.txnDate, startDate),
            lte(transactions.txnDate, endDate)
        ];

        applyTxnBranchFilter(whereClause, branchId, user);

        const results = await db.select({
            categoryName: categories.name,
            typeName: transactionTypes.name,
            currencyCode: currencies.code,
            totalDisplayValue: sql<string>`SUM(${TXN_DISPLAY_AMOUNT_SQL})`
        })
            .from(transactions)
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .where(and(...whereClause, inArray(transactionTypes.name, ['Income', 'Expense', 'Investment'])))
            .groupBy(categories.name, transactionTypes.name, currencies.code);

        // 3. Aggregate and Convert in Memory
        const categoryMap = new Map<string, { id: string, name: string, type: string, amount: number }>();

        for (const r of results) {
            const totalAmount = Number(r.totalDisplayValue || 0);
            if (totalAmount <= 0) continue;

            const typeLabel = (r.typeName || '').toLowerCase();
            const converted = await convertAmount(
                totalAmount,
                resolveTxnCurrency(r.currencyCode, orgBaseCurrency),
                displayCurrency,
                orgId
            );

            const catName = r.categoryName || 'Uncategorized';
            const key = `${catName}:${typeLabel}`;
            if (!categoryMap.has(key)) {
                categoryMap.set(key, {
                    id: key,
                    name: catName,
                    type: typeLabel,
                    amount: 0
                });
            }
            categoryMap.get(key)!.amount += converted;
        }

        const categoryRankings = Array.from(categoryMap.values());

        // 4. Build account-wise remaining current balance up to selected FY end date
        // GLOBAL: Accounts are unified organization-wide
        const accountFilters = [
            eq(accounts.orgId, orgId),
            isNotDeleted(accounts),
            eq(accounts.status, 1)
        ];

        const accountRows = await db.select({
            id: accounts.id,
            name: accounts.name,
            accountType: accounts.accountType,
            openingBalance: accounts.openingBalance,
            currency: currencies.code,
            ifsc: accounts.ifsc,
            bankName: accounts.bankName
        })
            .from(accounts)
            .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
            .where(and(...accountFilters));

        const movementWhere = [
            eq(transactions.orgId, orgId),
            isNotDeleted(transactions),
            eq(transactions.status, 1),
            lte(transactions.txnDate, endDate)
        ];

        applyTxnBranchFilter(movementWhere, branchId, user);

        // GLOBAL MOVEMENT: Calculate current balance (scoped by branch if selected)

        const movementRows = await db.select({
            accountId: accounts.id,
            accountType: accounts.accountType,
            totalNetAmount: sql<string>`SUM(${transactionEntries.debit} - ${transactionEntries.credit})`
        })
            .from(transactionEntries)
            .innerJoin(transactions, eq(transactionEntries.transactionId, transactions.id))
            .innerJoin(accounts, eq(transactionEntries.accountId, accounts.id))
            .where(and(...movementWhere))
            .groupBy(accounts.id, accounts.accountType);

        const movementBaseByAccount = new Map<number, number>();

        for (const movement of movementRows) {
            const totalNetInBase = Number(movement.totalNetAmount || 0);
            if (!totalNetInBase) continue;

            // Debit-normal: Asset(1), Expense(4). Credit-normal: Liability(2), Income(3), Equity(5)
            const orientedNetBase = (movement.accountType === 1 || movement.accountType === 4)
                ? (totalNetInBase)
                : (-totalNetInBase);

            const converted = await convertAmount(orientedNetBase, orgBaseCurrency, displayCurrency, orgId);

            movementBaseByAccount.set(
                movement.accountId,
                (movementBaseByAccount.get(movement.accountId) || 0) + converted
            );
        }

        const accountRankings = [];
        for (const acc of accountRows) {
            const opening = Number(acc.openingBalance || 0);
            const openingConverted = await ExchangeRateService.convert(opening, acc.currency || 'USD', displayCurrency);
            const netMovement = movementBaseByAccount.get(acc.id) || 0;
            const bankMeta = resolveBankFromIfsc(acc.ifsc);

            accountRankings.push({
                id: `account:${acc.id}`,
                name: acc.name,
                type: 'account',
                accountType: acc.accountType,
                amount: openingConverted + netMovement,
                ifsc: acc.ifsc,
                bankCode: bankMeta.bankCode,
                bankName: acc.bankName ?? null,
                bankLogoKey: bankMeta.bankLogoKey
            });
        }

        // --- NEW: INTER-ACCOUNT TRANSFER & INVESTMENT BALANCES ---
        const allTxnTypes = await db.select().from(transactionTypes);
        const transferTypeId = allTxnTypes.find(t => t.name?.toLowerCase() === 'transfer')?.id;
        const investmentTypeId = allTxnTypes.find(t => t.name?.toLowerCase().includes('invest'))?.id;

        const validTypes = [transferTypeId, investmentTypeId].filter(Boolean) as number[];

        const transferBalances: any[] = [];

        if (validTypes.length > 0) {
        const transferWhereClause = [
            eq(transactions.orgId, orgId),
            isNotDeleted(transactions),
            eq(transactions.status, 1),
            inArray(transactions.txnTypeId, validTypes),
            isNotDeleted(accounts),
            lte(transactions.txnDate, endDate)  // Running lifetime balance up to end date
        ];
            applyTxnBranchFilter(transferWhereClause, branchId, user);

            const transferEntriesQuery = await db.select({
                transactionId: transactionEntries.transactionId,
                accountId: transactionEntries.accountId,
                accountName: accounts.name,
                debit: transactionEntries.debit,
                credit: transactionEntries.credit,
                currency: currencies.code
            })
                .from(transactionEntries)
                .innerJoin(transactions, eq(transactionEntries.transactionId, transactions.id))
                .innerJoin(accounts, eq(transactionEntries.accountId, accounts.id))
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(...transferWhereClause));

            const txnGroups = new Map<number, any[]>();
            for (const entry of transferEntriesQuery) {
                if (!txnGroups.has(entry.transactionId)) {
                    txnGroups.set(entry.transactionId, []);
                }
                txnGroups.get(entry.transactionId)!.push(entry);
            }

            const pairBalances = new Map<string, any>();
            const validTransfers = [];

            for (const [txnId, entries] of txnGroups.entries()) {
                const debits = entries.filter(e => Number(e.debit) > 0);
                const credits = entries.filter(e => Number(e.credit) > 0);
                // Pair simple entries
                if (debits.length === 1 && credits.length === 1) {
                    const debitEntry = debits[0];
                    const creditEntry = credits[0];
                    if (debitEntry.accountId !== creditEntry.accountId) {
                        validTransfers.push({
                            debitEntry,
                            creditEntry,
                            amountLocal: Number(debitEntry.debit),
                            currency: debitEntry.currency || 'USD'
                        });
                    }
                }
            }

            for (const transfer of validTransfers) {
                // Here `amountLocal` is actually the sum of header-level amountBase if entries match correctly?
                // Wait! Let's check `validTransfers` collection above.
                // debitEntry.debit/credit are ALREADY in Org Base Currency in transaction_entries.
                const converted = await convertAmount(transfer.amountLocal, orgBaseCurrency, displayCurrency, orgId);

                const isALessThanB = transfer.debitEntry.accountId < transfer.creditEntry.accountId;
                const accAId = isALessThanB ? transfer.debitEntry.accountId : transfer.creditEntry.accountId;
                const accAName = isALessThanB ? transfer.debitEntry.accountName : transfer.creditEntry.accountName;
                const accBId = isALessThanB ? transfer.creditEntry.accountId : transfer.debitEntry.accountId;
                const accBName = isALessThanB ? transfer.creditEntry.accountName : transfer.debitEntry.accountName;

                const key = `${accAId}:${accBId}`;
                if (!pairBalances.has(key)) {
                    pairBalances.set(key, {
                        accountAId: accAId,
                        accountAName: accAName,
                        accountBId: accBId,
                        accountBName: accBName,
                        netAmountToA: 0
                    });
                }

                // If A was debited, A received money from B. A owes B. (Net Amount goes up)
                if (transfer.debitEntry.accountId === accAId) {
                    pairBalances.get(key)!.netAmountToA += converted;
                } else {
                    pairBalances.get(key)!.netAmountToA -= converted;
                }
            }

            for (const pair of pairBalances.values()) {
                const isAPositive = pair.netAmountToA >= 0;
                const absoluteAmount = Math.abs(pair.netAmountToA);

                if (absoluteAmount > 0) {
                    const owingAccount = isAPositive ? pair.accountAName : pair.accountBName;
                    const owedAccount = isAPositive ? pair.accountBName : pair.accountAName;
                    const owingAccountId = isAPositive ? pair.accountAId : pair.accountBId;
                    const owedAccountId = isAPositive ? pair.accountBId : pair.accountAId;

                    transferBalances.push({
                        id: `transfer:${pair.accountAId}-${pair.accountBId}`,
                        type: 'transfer_balance',
                        name: `${owingAccount} owes ${owedAccount}`,
                        owingAccount,
                        owedAccount,
                        owingAccountId,
                        owedAccountId,
                        amount: absoluteAmount
                    });
                }
            }
        }

        // 5. Return combined rankings. Frontend filters by type per card.
        return [...categoryRankings, ...accountRankings, ...transferBalances].sort((a: any, b: any) => b.amount - a.amount);
    }
};
