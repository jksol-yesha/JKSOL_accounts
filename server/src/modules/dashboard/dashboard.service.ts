
import { db } from '../../db';
import { transactions, financialYears, categories, accounts, organizations, branches, transactionTypes, transactionEntries, currencies } from '../../db/schema';
import { eq, and, lt, lte, gte, sql, inArray, or } from 'drizzle-orm';
import { ExchangeRateService } from '../../shared/exchange-rate.service';
import { resolveBankFromIfsc } from '../../shared/ifsc-bank';
import { isNotDeleted } from '../../shared/soft-delete';
import { getAllAccounts } from '../accounts/accounts.service';

const monthDiffInclusive = (startDate: string, endDate: string) => {
    const [startYear = 0, startMonth = 1] = startDate.split('-').map(Number);
    const [endYear = 0, endMonth = 1] = endDate.split('-').map(Number);
    return ((endYear - startYear) * 12) + (endMonth - startMonth) + 1;
};

const padDatePart = (value: number) => String(value).padStart(2, '0');

const formatUtcDateString = (date: Date) => (
    `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`
);

const parseDateStringAsUtc = (dateStr: string) => {
    const [year = 0, month = 1, day = 1] = String(dateStr || '').split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day || 1));
};

const shiftDateStringByDays = (dateStr: string, offset: number) => {
    const shiftedDate = parseDateStringAsUtc(dateStr);
    shiftedDate.setUTCDate(shiftedDate.getUTCDate() + offset);
    return formatUtcDateString(shiftedDate);
};

const shiftDateStringByMonths = (dateStr: string, offset: number) => {
    const [year = 0, month = 1, day = 1] = String(dateStr || '').split('-').map(Number);
    const shiftedDate = new Date(Date.UTC(year, month - 1 + offset, day || 1));
    return formatUtcDateString(shiftedDate);
};

const getMonthStart = (dateStr: string) => {
    const [year = 0, month = 1] = String(dateStr || '').split('-').map(Number);
    return `${year}-${padDatePart(month)}-01`;
};

const minDateString = (...dates: string[]) => dates.reduce((min, current) => (current < min ? current : min));

const maxDateString = (...dates: string[]) => dates.reduce((max, current) => (current > max ? current : max));

const getDateStringInTimeZone = (date: Date, timeZone: string) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value || '0000';
    const month = parts.find((part) => part.type === 'month')?.value || '01';
    const day = parts.find((part) => part.type === 'day')?.value || '01';
    return `${year}-${month}-${day}`;
};

const dayDiffInclusive = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

const getInterval = (startDate: string, endDate: string) => {
    const diff = dayDiffInclusive(startDate, endDate);
    if (diff <= 31) return 'day';
    if (diff <= 92) return 'week';
    return 'month';
};

const addMonths = (dateStr: string, offset: number) => {
    const [year = 0, month = 1, day = 1] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + offset, day || 1));
    return {
        key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
        label: `${date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${date.getUTCFullYear()}`
    };
};

const addDays = (dateStr: string, offset: number) => {
    const [year = 0, month = 1, day = 1] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + offset));
    return {
        key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`,
        label: date.toLocaleString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    };
};

const getWeekKey = (date: Date) => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const addWeeks = (dateStr: string, offset: number) => {
    const [year = 0, month = 1, day = 1] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + (offset * 7)));
    return {
        key: getWeekKey(date),
        label: `W${getWeekKey(date).split('-W')[1]}`
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



const getAccountBalancePeriodSql = (interval: 'day' | 'month') => {
    if (interval === 'day') {
        return sql<string>`DATE_FORMAT(${transactions.txnDate}, '%Y-%m-%d')`;
    }

    return sql<string>`DATE_FORMAT(${transactions.txnDate}, '%Y-%m')`;
};

const getAccountBalancePeriodKey = (dateStr: string, interval: 'day' | 'month') => {
    if (interval === 'day') return dateStr;
    return String(dateStr || '').slice(0, 7);
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

const roundBalanceValue = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

export const DashboardService = {
    getSummary: async (orgId: number, branchId: number | number[] | null, financialYearId: number, targetCurrency?: string, user?: any, customStartDate?: string, customEndDate?: string) => {
        // 1. Get Financial Year Details
        const fyList = await db.select().from(financialYears).where(eq(financialYears.id, financialYearId)).limit(1);
        const fy = fyList[0];
        if (!fy) throw new Error('Financial Year not found');

        const startDate = customStartDate || fy.startDate;
        const endDate = customEndDate || fy.endDate;

        // 1b. Get Organization Base Currency AND Display Currency
        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const org = orgList[0];
        const orgBaseCurrency = org?.baseCurrency || 'INR';
        const displayCurrency = targetCurrency || orgBaseCurrency;

        console.log(`[DashboardAPI] Resolved Dates: ${startDate} to ${endDate}`);
        
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
                .groupBy(sql`${currencies.code}`);
            
            let total = 0;
            for (const row of rows) {
                const amount = Number(row.totalDisplayValue || 0);
                if (!amount) continue;

                const sourceCur = resolveTxnCurrency(row.currencyCode, orgBaseCurrency);
                const converted = await convertAmount(amount, sourceCur, displayCurrency, orgId);
                total += converted;
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
            types.filter(t => aliases.includes((t.name || '').trim().toLowerCase())).map(t => t.id);
        
        const incomeIds = getTypeIds('income');
        const expenseIds = getTypeIds('expense');
        const investmentIds = getTypeIds('investment', 'invest');

        console.log(`[DashboardAPI] Summary Request: Org=${orgId}, Range=${startDate} - ${endDate}, Currency=${displayCurrency}, Branch=${JSON.stringify(branchId)}`);
        console.log(`[DashboardAPI] Found Type IDs: Income=${JSON.stringify(incomeIds)}, Expense=${JSON.stringify(expenseIds)}`);

        // 2. Opening Balance (Sum IN - Sum OUT) before start date
        const openingIn = await getDynamicTotal(
            (t) => and(
                sql`DATE(${t.txnDate}) < ${startDate}`,
                eq(t.status, 1),
                incomeIds.length > 0 ? inArray(t.txnTypeId, incomeIds) : sql`1=0`
            )
        );

        const openingOut = await getDynamicTotal(
            (t) => and(
                sql`DATE(${t.txnDate}) < ${startDate}`,
                eq(t.status, 1),
                expenseIds.length > 0 ? inArray(t.txnTypeId, expenseIds) : sql`1=0`
            )
        );

        const openingInvestment = await getDynamicTotal(
            (t) => and(
                sql`DATE(${t.txnDate}) < ${startDate}`,
                eq(t.status, 1),
                investmentIds.length > 0 ? inArray(t.txnTypeId, investmentIds) : sql`1=0`
            )
        );

        // Account Opening Balances (Corrected: convert each account individually)
        // GLOBAL: Accounts are unified organization-wide
        const accountFilters = [
            eq(accounts.orgId, orgId),
            isNotDeleted(accounts),
            inArray(accounts.status, [1, 2])
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
                sql`DATE(${t.txnDate}) >= ${startDate}`,
                sql`DATE(${t.txnDate}) <= ${endDate}`,
                eq(t.status, 1),
                incomeIds.length > 0 ? inArray(t.txnTypeId, incomeIds) : sql`1=0`
            )
        );

        const totalExpense = await getDynamicTotal(
            (t) => and(
                sql`DATE(${t.txnDate}) >= ${startDate}`,
                sql`DATE(${t.txnDate}) <= ${endDate}`,
                eq(t.status, 1),
                expenseIds.length > 0 ? inArray(t.txnTypeId, expenseIds) : sql`1=0`
            )
        );

        const totalInvestmentByAccount = await getInvestmentTotal(
            (t) => and(
                sql`DATE(${t.txnDate}) >= ${startDate}`,
                sql`DATE(${t.txnDate}) <= ${endDate}`
            )
        );
        const totalInvestmentByType = investmentIds.length > 0
            ? await getDynamicTotal(
                (t) => and(
                    sql`DATE(${t.txnDate}) >= ${startDate}`,
                    sql`DATE(${t.txnDate}) <= ${endDate}`,
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

        console.log(`[DashboardAPI] Final: Opening=${openingBalance}, Income=${totalIncome}, Expense=${totalExpense}, Closing=${closingBalance}`);

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
        user?: any,
        customStartDate?: string,
        customEndDate?: string,
        customCompareStartDate?: string,
        customCompareEndDate?: string
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

        const buildPeriodSeries = async (fy: typeof currentFy, periodStart?: string, periodEnd?: string) => {
            const start = periodStart || fy.startDate;
            const end = periodEnd || fy.endDate;
            const interval = getInterval(start, end);

            let count = 0;
            let generator: (d: string, i: number) => { key: string, label: string };
            let sqlFormat = '%Y-%m';

            if (interval === 'day') {
                count = dayDiffInclusive(start, end);
                generator = addDays;
                sqlFormat = '%Y-%m-%d';
            } else if (interval === 'week') {
                count = Math.ceil(dayDiffInclusive(start, end) / 7);
                generator = addWeeks;
                sqlFormat = '%x-W%v';
            } else {
                count = monthDiffInclusive(start, end);
                generator = addMonths;
                sqlFormat = '%Y-%m';
            }

            const items = Array.from({ length: count }, (_, i) => generator(start, i));
            const labels = items.map(t => t.label);
            const keyToIndexMap = new Map<string, number>(items.map((t, i) => [t.key, i]));

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
                gte(transactions.txnDate, start),
                lte(transactions.txnDate, end)
            ];

            applyTxnBranchFilter(whereClause, branchId, user);

            const rows = await db.select({
                periodKey: sql<string>`DATE_FORMAT(${transactions.txnDate}, ${sqlFormat})`,
                typeName: transactionTypes.name,
                currencyCode: currencies.code,
                totalDisplayValue: sql<string>`SUM(${TXN_DISPLAY_AMOUNT_SQL})`
            })
                .from(transactions)
                .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(...whereClause))
                .groupBy(
                    sql`DATE_FORMAT(${transactions.txnDate}, ${sqlFormat})`,
                    transactionTypes.name,
                    currencies.code
                );

            const investmentWhereClause = [
                eq(transactions.orgId, orgId),
                isNotDeleted(transactions),
                eq(transactions.status, 1),
                gte(transactions.txnDate, start),
                lte(transactions.txnDate, end),
                isNotDeleted(accounts),
                eq(accounts.accountType, 1),
                eq(accounts.subtype, 14)
            ];

            applyTxnBranchFilter(investmentWhereClause, branchId, user);

            const investmentRows = await db.select({
                periodKey: sql<string>`DATE_FORMAT(${transactions.txnDate}, ${sqlFormat})`,
                currencyCode: currencies.code,
                totalNetAmount: sql<string>`SUM(${transactionEntries.debit} - ${transactionEntries.credit})`
            })
                .from(transactionEntries)
                .innerJoin(transactions, eq(transactionEntries.transactionId, transactions.id))
                .innerJoin(accounts, eq(transactionEntries.accountId, accounts.id))
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(...investmentWhereClause))
                .groupBy(
                    sql`DATE_FORMAT(${transactions.txnDate}, ${sqlFormat})`,
                    currencies.code
                );

            const income = Array(count).fill(0);
            const expense = Array(count).fill(0);
            const investmentByType = Array(count).fill(0);
            const investmentByAccount = Array(count).fill(0);

            for (const row of rows) {
                const index = keyToIndexMap.get(String(row.periodKey || ''));
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
                const index = keyToIndexMap.get(String(row.periodKey || ''));
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

        const subtractYear = (dateStr?: string) => {
            if (!dateStr) return undefined;
            const [y, m, d] = dateStr.split('-');
            return `${Number(y) - 1}-${m}-${d}`;
        };

        console.log(`[DashboardAPI] Trends Request: Org=${orgId}, Range=${currentFy.startDate} - ${currentFy.endDate}, Compare=${customCompareStartDate} - ${customCompareEndDate}`);
        
        const currentSeries = await buildPeriodSeries(currentFy, customStartDate, customEndDate);
        const compareSeries = (customCompareStartDate || compareFy)
            ? await buildPeriodSeries(
                compareFy || currentFy, 
                customCompareStartDate || (compareFy ? subtractYear(customStartDate || '') : undefined), 
                customCompareEndDate || (compareFy ? subtractYear(customEndDate || '') : undefined)
            )
            : null;

        return {
            baseCurrency: displayCurrency,
            labels: currentSeries.labels,
            current: currentSeries,
            previous: compareSeries
        };
    },

    getCategoryRankings: async (orgId: number, branchId: number | number[] | null, financialYearId: number, targetCurrency?: string, user?: any, customStartDate?: string, customEndDate?: string) => {
        // 1. Get Financial Year
        const fyList = await db.select().from(financialYears).where(eq(financialYears.id, financialYearId)).limit(1);
        const fy = fyList[0];
        if (!fy) throw new Error('Financial Year not found');

        const startDate = customStartDate || fy.startDate;
        const endDate = customEndDate || fy.endDate;

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
    },

    getAccountBalanceTrend: async (
        orgId: number,
        branchId: number | number[] | null,
        financialYearId: number,
        timeframe: '30D' | '12M',
        targetCurrency?: string,
        user?: any
    ) => {
        // 1. Get Financial Year
        const fyList = await db.select().from(financialYears).where(eq(financialYears.id, financialYearId)).limit(1);
        const fy = fyList[0];
        if (!fy) throw new Error('Financial Year not found');

        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const org = orgList[0];
        const orgBaseCurrency = org?.baseCurrency || 'INR';
        const displayCurrency = targetCurrency || orgBaseCurrency;
        const orgTimeZone = org?.timezone || 'Asia/Kolkata';

        // 2. Determine Timeframe Dates
        const todayDate = getDateStringInTimeZone(new Date(), orgTimeZone);
        let startDate: string;
        let endDate: string;
        let movementStartDate: string;
        let interval: 'day' | 'month';
        let seriesItems: Array<{ key: string; label: string }>;

        endDate = minDateString(todayDate, fy.endDate);
        if (endDate < fy.startDate) {
            endDate = fy.startDate;
        }

        if (timeframe === '30D') {
            startDate = shiftDateStringByDays(endDate, -29);
            movementStartDate = startDate;
            interval = 'day';
            seriesItems = Array.from(
                { length: dayDiffInclusive(startDate, endDate) },
                (_, i) => addDays(startDate, i)
            );
        } else {
            const endMonthStart = getMonthStart(endDate);
            movementStartDate = maxDateString(fy.startDate, shiftDateStringByMonths(endMonthStart, -11));
            startDate = getMonthStart(movementStartDate);
            interval = 'month';
            seriesItems = Array.from(
                { length: monthDiffInclusive(startDate, getMonthStart(endDate)) },
                (_, i) => addMonths(startDate, i)
            );
        }

        // 3. Get All Active Accounts with Opening Balances
        const activeAccounts = await db.select({
            id: accounts.id,
            subtype: accounts.subtype,
            openingBalance: accounts.openingBalance,
            openingBalanceDate: accounts.openingBalanceDate,
            currencyCode: currencies.code,
        })
        .from(accounts)
        .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
        .where(and(
            eq(accounts.orgId, orgId),
            isNotDeleted(accounts),
            inArray(accounts.status, [1, 2]),
            inArray(accounts.subtype, [11, 12, 22]) // Cash, Bank, Credit Card
        ));

        // Extract active account IDs to scope movement queries
        const activeAccountIds = activeAccounts.map(a => a.id);

        // 4. Fetch cumulative net movement for these accounts up to end date
        // We need movements BEFORE start date to get the "initial" balance at start of range,
        // and movements WITHIN the range to get daily/monthly points.
        
        if (activeAccountIds.length === 0) {
            return seriesItems.map((item) => {
                return { date: item.label, bank: 0, card: 0, cash: 0 };
            });
        }

        const movementWhere = [
            eq(transactions.orgId, orgId),
            isNotDeleted(transactions),
            eq(transactions.status, 1),
            gte(transactions.txnDate, movementStartDate),
            lte(transactions.txnDate, endDate),
            inArray(transactionEntries.accountId, activeAccountIds)
        ];
        applyTxnBranchFilter(movementWhere, branchId, user);

        const periodKeySql = getAccountBalancePeriodSql(interval);
        const movements = await db.select({
            accountId: transactionEntries.accountId,
            periodKey: periodKeySql,
            currencyCode: currencies.code,
            netAmount: sql<string>`SUM(COALESCE(${transactionEntries.debit}, 0) - COALESCE(${transactionEntries.credit}, 0))`
        })
        .from(transactionEntries)
        .innerJoin(transactions, eq(transactionEntries.transactionId, transactions.id))
        .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
        .where(and(...movementWhere))
        .groupBy(transactionEntries.accountId, periodKeySql, currencies.code);

        // 5. Build the series
        // Map account movements by ID and periodKey for quick lookup
        const movementMap = new Map<number, Map<string, number>>();
        for (const movement of movements) {
            const convertedNet = await convertAmount(
                Number(movement.netAmount || 0),
                resolveTxnCurrency(movement.currencyCode, orgBaseCurrency),
                displayCurrency,
                orgId
            );
            if (!movementMap.has(movement.accountId)) movementMap.set(movement.accountId, new Map());
            const periodMap = movementMap.get(movement.accountId)!;
            periodMap.set(movement.periodKey, (periodMap.get(movement.periodKey) || 0) + convertedNet);
        }

        // Fetch movements before range (to add to opening balance)
        const beforeRangeWhere = [
            eq(transactions.orgId, orgId),
            isNotDeleted(transactions),
            eq(transactions.status, 1),
            lt(transactions.txnDate, movementStartDate),
            inArray(transactionEntries.accountId, activeAccountIds)
        ];
        applyTxnBranchFilter(beforeRangeWhere, branchId, user);

        const beforeRangeMovements = await db.select({
            accountId: transactionEntries.accountId,
            currencyCode: currencies.code,
            netAmount: sql<string>`SUM(COALESCE(${transactionEntries.debit}, 0) - COALESCE(${transactionEntries.credit}, 0))`
        })
        .from(transactionEntries)
        .innerJoin(transactions, eq(transactionEntries.transactionId, transactions.id))
        .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
        .where(and(...beforeRangeWhere))
        .groupBy(transactionEntries.accountId, currencies.code);
        
        const beforeMap = new Map<number, number>();
        for (const movement of beforeRangeMovements) {
            const convertedNet = await convertAmount(
                Number(movement.netAmount || 0),
                resolveTxnCurrency(movement.currencyCode, orgBaseCurrency),
                displayCurrency,
                orgId
            );
            beforeMap.set(movement.accountId, (beforeMap.get(movement.accountId) || 0) + convertedNet);
        }

        // 6. Calculate balances for each point
        const resultSeries = [];
        
        // Prepare initial balances for each account at start of series
        const accountStates = await Promise.all(activeAccounts.map(async (acc) => {
            const opening = Number(acc.openingBalance || 0);
            const convertedOpening = await ExchangeRateService.convert(opening, acc.currencyCode || 'USD', displayCurrency, orgId);
            const openingBalanceDate = acc.openingBalanceDate || null;
            const openingPeriodKey = openingBalanceDate ? getAccountBalancePeriodKey(openingBalanceDate, interval) : null;
            const isOpeningAppliedAtRangeStart = !openingBalanceDate || openingBalanceDate <= movementStartDate;
            const beforeMove = beforeMap.get(acc.id) || 0;

            return {
                id: acc.id,
                subtype: Number(acc.subtype),
                currentBalance: isOpeningAppliedAtRangeStart ? convertedOpening + beforeMove : 0,
                openingBalance: convertedOpening,
                openingApplied: isOpeningAppliedAtRangeStart,
                openingPeriodKey,
                movements: movementMap.get(acc.id) || new Map<string, number>()
            };
        }));

        for (const item of seriesItems) {
            let bank = 0, card = 0, cash = 0;

            for (const state of accountStates) {
                if (!state.openingApplied && state.openingPeriodKey && item.key < state.openingPeriodKey) {
                    continue;
                }

                if (!state.openingApplied && state.openingPeriodKey === item.key) {
                    state.currentBalance += state.openingBalance;
                    state.openingApplied = true;
                }

                const move = state.movements.get(item.key) || 0;
                if (move !== 0) {
                    state.currentBalance += move;
                }

                if (state.subtype === 12) bank += state.currentBalance;
                else if (state.subtype === 22) card += state.currentBalance;
                else if (state.subtype === 11) cash += state.currentBalance;
            }

            resultSeries.push({
                date: item.label,
                bank: roundBalanceValue(bank),
                card: roundBalanceValue(card),
                cash: roundBalanceValue(cash)
            });
        }

        if (resultSeries.length > 0 && branchId === null) {
            // Keep the final chart point aligned with the same active-account totals shown in the accounts summary cards.
            const latestAccounts = await getAllAccounts(
                orgId,
                undefined,
                displayCurrency,
                user,
                financialYearId
            );

            const latestTotals = latestAccounts.reduce((totals, account) => {
                const subtype = Number(account.subtype);
                const balance = Number(
                    account.closingBalance
                    ?? account.convertedClosingBalance
                    ?? account.closing_balance
                    ?? account.openingBalance
                    ?? 0
                ) || 0;

                if (subtype === 12) totals.bank += balance;
                else if (subtype === 22) totals.card += balance;
                else if (subtype === 11) totals.cash += balance;
                return totals;
            }, { bank: 0, card: 0, cash: 0 });

            const latestPoint = resultSeries[resultSeries.length - 1];
            resultSeries[resultSeries.length - 1] = {
                ...latestPoint,
                bank: roundBalanceValue(latestTotals.bank),
                card: roundBalanceValue(latestTotals.card),
                cash: roundBalanceValue(latestTotals.cash)
            };
        }

        return resultSeries;
    }
};
