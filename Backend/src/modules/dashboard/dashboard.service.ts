
import { db } from '../../db';
import { transactions, financialYears, categories, accounts, organizations, branches, transactionTypes, transactionEntries, currencies } from '../../db/schema';
import { eq, and, lt, lte, gte, sql, inArray, or } from 'drizzle-orm';
import { ExchangeRateService } from '../../shared/exchange-rate.service';
import { resolveBankFromIfsc } from '../../shared/ifsc-bank';

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
    if (Array.isArray(branchId)) {
        whereClause.push(inArray(accounts.branchId, branchId.length ? branchId : [-1]));
        return;
    }

    if (branchId !== null) {
        whereClause.push(eq(accounts.branchId, branchId));
        return;
    }

    if (user && user.role === 'member') {
        const userBranchIds = typeof user.branchIds === 'string'
            ? user.branchIds.split(',').filter(Boolean).map(Number)
            : (Array.isArray(user.branchIds) ? user.branchIds : []);
        if (userBranchIds.length > 0) {
            whereClause.push(inArray(accounts.branchId, userBranchIds));
        } else {
            whereClause.push(eq(accounts.branchId, -1));
        }
    }
};

export const DashboardService = {
    getSummary: async (orgId: number, branchId: number | number[] | null, financialYearId: number, targetCurrency?: string, user?: any) => {
        console.log(`[DashboardService] getSummary - Org: ${orgId}, Branch: ${branchId}, FY: ${financialYearId}, UserID: ${user?.id}`);
        // 1. Get Financial Year Details
        const fyList = await db.select().from(financialYears).where(eq(financialYears.id, financialYearId)).limit(1);
        const fy = fyList[0];
        if (!fy) throw new Error('Financial Year not found');

        const { startDate, endDate } = fy;

        // 1b. Get Organization Base Currency OR Target Currency
        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const org = orgList[0];
        const baseCurrency = targetCurrency || org?.baseCurrency || 'USD'; // Use target if present

        // Helper: Dynamic Aggregation
        // Returns total converted to Base/Target Currency
        const getDynamicTotal = async (
            filterFn: (t: typeof transactions) => any,
            directionFilter?: 'in' | 'out'
        ): Promise<number> => {
            const whereClause = [
                eq(transactions.orgId, orgId),
                filterFn(transactions)
            ];

            applyTxnBranchFilter(whereClause, branchId, user);

            // Group by Currency Code and Sum Amount Local
            const buckets = await db.select({
                currency: currencies.code,
                totalLocal: sql<string>`SUM(COALESCE(${transactions.finalAmount}, ${transactions.amountLocal}))`
            })
                .from(transactions)
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(...whereClause))
                .groupBy(currencies.code);

            let totalBase = 0;
            for (const bucket of buckets) {
                const amount = Number(bucket.totalLocal || 0);
                if (amount !== 0) {
                    const currencyCode = bucket.currency || 'USD';
                    const converted = await ExchangeRateService.convert(amount, currencyCode, baseCurrency);
                    totalBase += converted;
                }
            }
            return totalBase;
        };

        // Investment total based on actual entries posted to Investment accounts
        // (Asset account type + Investment subtype), scoped by selected branch/year.
        const getInvestmentTotal = async (
            dateFilter: (t: typeof transactions) => any
        ): Promise<number> => {
            const whereClause = [
                eq(transactions.orgId, orgId),
                eq(transactions.status, 1),
                dateFilter(transactions),
                eq(accounts.accountType, 1),
                eq(accounts.subtype, 14)
            ];

            applyTxnBranchFilter(whereClause, branchId, user);

            const rows = await db.select({
                currency: currencies.code,
                totalDebit: sql<string>`SUM(${transactionEntries.debit})`,
                totalCredit: sql<string>`SUM(${transactionEntries.credit})`
            })
                .from(transactionEntries)
                .innerJoin(transactions, eq(transactionEntries.transactionId, transactions.id))
                .innerJoin(accounts, eq(transactionEntries.accountId, accounts.id))
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(...whereClause))
                .groupBy(currencies.code);

            let totalBase = 0;
            for (const row of rows) {
                const netLocal = Number(row.totalDebit || 0) - Number(row.totalCredit || 0);
                if (netLocal <= 0) continue;
                const converted = await ExchangeRateService.convert(netLocal, row.currency || 'USD', baseCurrency);
                totalBase += converted;
            }
            return totalBase;
        };

        // 1c. Fetch Transaction Types
        const types = await db.select().from(transactionTypes);
        const getTypeId = (...aliases: string[]) =>
            types.find(t => aliases.includes((t.name || '').toLowerCase()))?.id;
        const incomeId = getTypeId('income');
        const expenseId = getTypeId('expense');
        const investmentId = getTypeId('investment', 'invest');

        console.log(`[DashboardService] summary IDs - Income: ${incomeId}, Expense: ${expenseId}, Investment: ${investmentId}`);

        // 2. Opening Balance
        // Logic: (Sum IN (Income) - Sum OUT (Expense)) before start date

        // Opening IN
        const openingIn = await getDynamicTotal(
            (t) => and(
                lt(t.txnDate, startDate),
                eq(t.status, 1), // 1 = posted
                eq(t.txnTypeId, incomeId!)
            )
        );

        // Opening OUT
        const openingOut = await getDynamicTotal(
            (t) => and(
                lt(t.txnDate, startDate),
                eq(t.status, 1), // 1 = posted
                eq(t.txnTypeId, expenseId!)
            )
        );

        // Opening Investment (Outflow)
        const openingInvestment = await getDynamicTotal(
            (t) => and(
                lt(t.txnDate, startDate),
                eq(t.status, 1), // 1 = posted
                eq(t.txnTypeId, investmentId!)
            )
        );

        // Account Opening Balances (Corrected: convert each account individually)
        // GLOBAL: Accounts are unified organization-wide
        const accountFilters = [
            eq(accounts.orgId, orgId),
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
            const converted = await ExchangeRateService.convert(balance, acc.currencyCode || 'USD', baseCurrency);
            initialAccountBalanceBase += converted;
        }

        // User Request Update: Opening Balance MUST include past transactions to carry over closing balance from previous years.
        const openingBalance = initialAccountBalanceBase + (openingIn - openingOut - openingInvestment);

        // 3. Current Period Totals
        const totalIncome = await getDynamicTotal(
            (t) => and(
                gte(t.txnDate, startDate),
                lte(t.txnDate, endDate),
                eq(t.status, 1), // 1 = posted
                eq(t.txnTypeId, incomeId!)
            )
        );

        const totalExpense = await getDynamicTotal(
            (t) => and(
                gte(t.txnDate, startDate),
                lte(t.txnDate, endDate),
                eq(t.status, 1), // 1 = posted
                eq(t.txnTypeId, expenseId!)
            )
        );

        const totalInvestmentByAccount = await getInvestmentTotal(
            (t) => and(
                gte(t.txnDate, startDate),
                lte(t.txnDate, endDate)
            )
        );
        const totalInvestmentByType = investmentId
            ? await getDynamicTotal(
                (t) => and(
                    gte(t.txnDate, startDate),
                    lte(t.txnDate, endDate),
                    eq(t.status, 1),
                    eq(t.txnTypeId, investmentId)
                )
            )
            : 0;
        const totalInvestment = totalInvestmentByAccount > 0
            ? totalInvestmentByAccount
            : totalInvestmentByType;

        console.log(`[DashboardService] summary totals - Income: ${totalIncome}, Expense: ${totalExpense}, Investment: ${totalInvestment}`);

        // 4. Closing Balance (Opening + Net Flow)
        const periodIn = await getDynamicTotal(
            (t) => and(
                gte(t.txnDate, startDate),
                lte(t.txnDate, endDate),
                eq(t.status, 1), // 1 = posted
                eq(t.txnTypeId, incomeId!)
            )
        );

        const periodOut = await getDynamicTotal(
            (t) => and(
                gte(t.txnDate, startDate),
                lte(t.txnDate, endDate),
                eq(t.status, 1), // 1 = posted
                eq(t.txnTypeId, expenseId!)
            )
        );

        const closingBalance = openingBalance + (periodIn - periodOut);

        return {
            baseCurrency, // Return the currency we converted to
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
        const baseCurrency = targetCurrency || org?.baseCurrency || 'USD';

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

            const whereClause = [
                eq(transactions.orgId, orgId),
                eq(transactions.status, 1),
                gte(transactions.txnDate, fy.startDate),
                lte(transactions.txnDate, fy.endDate)
            ];

            applyTxnBranchFilter(whereClause, branchId, user);

            const rows = await db.select({
                monthKey: sql<string>`DATE_FORMAT(${transactions.txnDate}, '%Y-%m')`,
                txnTypeId: transactions.txnTypeId,
                currency: currencies.code,
                totalLocal: sql<string>`SUM(COALESCE(${transactions.finalAmount}, ${transactions.amountLocal}))`
            })
                .from(transactions)
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(...whereClause))
                .groupBy(
                    sql`DATE_FORMAT(${transactions.txnDate}, '%Y-%m')`,
                    transactions.txnTypeId,
                    currencies.code
                );

            const investmentWhereClause = [
                eq(transactions.orgId, orgId),
                eq(transactions.status, 1),
                gte(transactions.txnDate, fy.startDate),
                lte(transactions.txnDate, fy.endDate),
                eq(accounts.accountType, 1),
                eq(accounts.subtype, 14)
            ];

            applyTxnBranchFilter(investmentWhereClause, branchId, user);

            const investmentRows = await db.select({
                monthKey: sql<string>`DATE_FORMAT(${transactions.txnDate}, '%Y-%m')`,
                currency: currencies.code,
                totalDebit: sql<string>`SUM(${transactionEntries.debit})`,
                totalCredit: sql<string>`SUM(${transactionEntries.credit})`
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

                const converted = await ExchangeRateService.convert(
                    Number(row.totalLocal || 0),
                    row.currency || 'USD',
                    baseCurrency
                );

                if (row.txnTypeId === incomeId) income[index] += converted;
                if (row.txnTypeId === expenseId) expense[index] += converted;
                if (row.txnTypeId === investmentId) investmentByType[index] += converted;
            }

            for (const row of investmentRows) {
                const index = monthKeyToIndex.get(String(row.monthKey || ''));
                if (index === undefined) continue;

                const netLocal = Number(row.totalDebit || 0) - Number(row.totalCredit || 0);
                if (netLocal <= 0) continue;

                const converted = await ExchangeRateService.convert(
                    netLocal,
                    row.currency || 'USD',
                    baseCurrency
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
            baseCurrency,
            labels: currentSeries.labels,
            current: currentSeries,
            previous: compareSeries
        };
    },

    getCategoryRankings: async (orgId: number, branchId: number | number[] | null, financialYearId: number, targetCurrency?: string, user?: any) => {
        console.log(`[DashboardService] getCategoryRankings - Org: ${orgId}, Branch: ${branchId}, FY: ${financialYearId}, UserID: ${user?.id}`);
        // 1. Get Financial Year
        const fyList = await db.select().from(financialYears).where(eq(financialYears.id, financialYearId)).limit(1);
        const fy = fyList[0];
        if (!fy) throw new Error('Financial Year not found');

        const { startDate, endDate } = fy;

        // 1b. Get Org Details for Base Currency
        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const org = orgList[0];
        const baseCurrency = targetCurrency || org?.baseCurrency || 'USD';

        // 2. Aggregate FY transactions by Category (Income/Expense/Investment)
        const whereClause = [
            eq(transactions.orgId, orgId),
            eq(transactions.status, 1), // 1 = posted
            gte(transactions.txnDate, startDate),
            lte(transactions.txnDate, endDate)
        ];

        applyTxnBranchFilter(whereClause, branchId, user);

        const results = await db.select({
            categoryName: categories.name,
            typeName: transactionTypes.name,
            currency: currencies.code,
            amountLocal: sql<string>`SUM(COALESCE(${transactions.finalAmount}, ${transactions.amountLocal}))`
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
            let amountLocal = Number(r.amountLocal || 0);
            if (amountLocal <= 0) continue; // Only show positive contributions to rankings

            let typeLabel = (r.typeName || '').toLowerCase(); // 'income', 'expense', 'investment'

            const currencyCode = r.currency || 'USD';
            const converted = await ExchangeRateService.convert(amountLocal, currencyCode, baseCurrency);

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
            eq(accounts.status, 1)
        ];

        const accountRows = await db.select({
            id: accounts.id,
            name: accounts.name,
            accountType: accounts.accountType,
            openingBalance: accounts.openingBalance,
            currency: currencies.code,
            ifsc: accounts.ifsc
        })
            .from(accounts)
            .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
            .where(and(...accountFilters));

        const movementWhere = [
            eq(transactions.orgId, orgId),
            eq(transactions.status, 1),
            lte(transactions.txnDate, endDate)
        ];

        // GLOBAL MOVEMENT: Calculate global current balance

        const movementRows = await db.select({
            accountId: accounts.id,
            accountType: accounts.accountType,
            currency: currencies.code,
            totalDebit: sql<string>`SUM(${transactionEntries.debit})`,
            totalCredit: sql<string>`SUM(${transactionEntries.credit})`
        })
            .from(transactionEntries)
            .innerJoin(transactions, eq(transactionEntries.transactionId, transactions.id))
            .innerJoin(accounts, eq(transactionEntries.accountId, accounts.id))
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .where(and(...movementWhere))
            .groupBy(accounts.id, accounts.accountType, currencies.code);

        const movementBaseByAccount = new Map<number, number>();

        for (const movement of movementRows) {
            const debit = Number(movement.totalDebit || 0);
            const credit = Number(movement.totalCredit || 0);

            // Debit-normal: Asset(1), Expense(4). Credit-normal: Liability(2), Income(3), Equity(5)
            const movementLocal = (movement.accountType === 1 || movement.accountType === 4)
                ? (debit - credit)
                : (credit - debit);

            const currencyCode = movement.currency || 'USD';
            const converted = await ExchangeRateService.convert(movementLocal, currencyCode, baseCurrency);

            movementBaseByAccount.set(
                movement.accountId,
                (movementBaseByAccount.get(movement.accountId) || 0) + converted
            );
        }

        const accountRankings = [];
        for (const acc of accountRows) {
            const opening = Number(acc.openingBalance || 0);
            const openingConverted = await ExchangeRateService.convert(opening, acc.currency || 'USD', baseCurrency);
            const netMovement = movementBaseByAccount.get(acc.id) || 0;

            accountRankings.push({
                id: `account:${acc.id}`,
                name: acc.name,
                type: 'account',
                accountType: acc.accountType,
                amount: openingConverted + netMovement,
                ifsc: acc.ifsc,
                bankCode: resolveBankFromIfsc(acc.ifsc).bankCode,
                bankName: resolveBankFromIfsc(acc.ifsc).bankName,
                bankLogoKey: resolveBankFromIfsc(acc.ifsc).bankLogoKey
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
                eq(transactions.status, 1),
                inArray(transactions.txnTypeId, validTypes),
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
                const converted = await ExchangeRateService.convert(transfer.amountLocal, transfer.currency, baseCurrency);

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

                    transferBalances.push({
                        id: `transfer:${pair.accountAId}-${pair.accountBId}`,
                        type: 'transfer_balance',
                        name: `${owingAccount} owes ${owedAccount}`,
                        owingAccount,
                        owedAccount,
                        amount: absoluteAmount
                    });
                }
            }
        }

        // 5. Return combined rankings. Frontend filters by type per card.
        return [...categoryRankings, ...accountRankings, ...transferBalances].sort((a: any, b: any) => b.amount - a.amount);
    }
};
