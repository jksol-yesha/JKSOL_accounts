
import { db } from '../../db';
import { accounts, branches, organizations, currencies, users, transactionEntries, transactions, auditLogs, financialYears } from '../../db/schema';
import { eq, and, desc, inArray, SQL, aliasedTable, sql, lt } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { ExchangeRateService } from '../../shared/exchange-rate.service';
import { resolveBankFromIfsc } from '../../shared/ifsc-bank';
import {
    validateSubtypeMatchesType,
    getAccountTypeName,
    getAccountSubtypeName,
    ACCOUNT_TYPE_LABELS,
    ACCOUNT_SUBTYPE_LABELS
} from './constants';

const DEFAULT_ORG_ID = 1;
const DEFAULT_BRANCH_ID = 1;

export const getAllAccounts = async (
    branchId?: number | number[] | 'all' | null,
    branchName?: string,
    orgId: number = DEFAULT_ORG_ID,
    status?: 1 | 2,
    targetCurrency?: string,
    user?: any,
    financialYearId?: number
) => {
    const filters: (SQL | undefined)[] = [eq(accounts.orgId, orgId)];

    // We no longer filter accounts by branch. Accounts are global across the organization.

    if (status) {
        filters.push(eq(accounts.status, status));
    }

    const parentAccountsTable = aliasedTable(accounts, 'parent_accounts');

    const result = await db.select({
        account: accounts,
        currency: currencies,
        branch: branches,
        creator: {
            id: users.id,
            fullName: users.fullName,
            email: users.email
        },
        parentAccount: parentAccountsTable
    })
        .from(accounts)
        .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
        .leftJoin(branches, eq(accounts.branchId, branches.id))
        .leftJoin(users, eq(accounts.createdBy, users.id))
        .leftJoin(parentAccountsTable, eq(accounts.parentAccountId, parentAccountsTable.id))
        .where(and(...filters.filter((f): f is SQL => f !== undefined)))
        .orderBy(desc(accounts.createdAt));

    const rows = result as any[];
    const accountIds = rows.map((row) => Number(row.account?.id)).filter(Boolean);
    if (accountIds.length === 0) return [];

    const latestEditorByAccountId = new Map<number, { id: number, fullName: string | null }>();

    const latestAuditsPromise = db.select({
        entityId: auditLogs.entityId,
        actionBy: auditLogs.actionBy,
        actionAt: auditLogs.actionAt,
        editorName: users.fullName
    })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actionBy, users.id))
        .where(and(
            eq(auditLogs.orgId, orgId),
            eq(auditLogs.entity, 'account'),
            eq(auditLogs.action, 'update'),
            inArray(auditLogs.entityId, accountIds)
        ))
        .orderBy(desc(auditLogs.actionAt));

    const orgPromise = db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    const financialYearPromise = financialYearId
        ? db.select().from(financialYears).where(eq(financialYears.id, financialYearId)).limit(1)
        : Promise.resolve([]);

    const [accountUpdateAudits, orgList, financialYearList] = await Promise.all([
        latestAuditsPromise,
        orgPromise,
        financialYearPromise
    ]);

    const selectedFinancialYear = financialYearList[0];

    const allTimeBalancePromise = db.select({
        accountId: accounts.id,
        netDelta: sql<string>`
            COALESCE(SUM(
                CASE
                    WHEN ${transactions.id} IS NULL THEN 0
                    ELSE COALESCE(${transactionEntries.debit}, 0) - COALESCE(${transactionEntries.credit}, 0)
                END
            ), 0)
        `
    })
        .from(accounts)
        .leftJoin(transactionEntries, eq(transactionEntries.accountId, accounts.id))
        .leftJoin(transactions, and(
            eq(transactions.id, transactionEntries.transactionId),
            eq(transactions.orgId, orgId),
            eq(transactions.status, 1)
        ))
        .where(and(...filters.filter((f): f is SQL => f !== undefined)))
        .groupBy(accounts.id);

    const beforeFinancialYearBalancePromise = selectedFinancialYear
        ? db.select({
            accountId: accounts.id,
            netDelta: sql<string>`
                COALESCE(SUM(
                    CASE
                        WHEN ${transactions.id} IS NULL THEN 0
                        ELSE COALESCE(${transactionEntries.debit}, 0) - COALESCE(${transactionEntries.credit}, 0)
                    END
                ), 0)
            `
        })
            .from(accounts)
            .leftJoin(transactionEntries, eq(transactionEntries.accountId, accounts.id))
            .leftJoin(transactions, and(
                eq(transactions.id, transactionEntries.transactionId),
                eq(transactions.orgId, orgId),
                eq(transactions.status, 1),
                lt(transactions.txnDate, selectedFinancialYear.startDate)
            ))
            .where(and(...filters.filter((f): f is SQL => f !== undefined)))
            .groupBy(accounts.id)
        : Promise.resolve([]);

    const withinFinancialYearBalancePromise = selectedFinancialYear
        ? db.select({
            accountId: accounts.id,
            netDelta: sql<string>`
                COALESCE(SUM(
                    CASE
                        WHEN ${transactions.id} IS NULL THEN 0
                        ELSE COALESCE(${transactionEntries.debit}, 0) - COALESCE(${transactionEntries.credit}, 0)
                    END
                ), 0)
            `
        })
            .from(accounts)
            .leftJoin(transactionEntries, eq(transactionEntries.accountId, accounts.id))
            .leftJoin(transactions, and(
                eq(transactions.id, transactionEntries.transactionId),
                eq(transactions.orgId, orgId),
                eq(transactions.status, 1),
                eq(transactions.financialYearId, selectedFinancialYear.id)
            ))
            .where(and(...filters.filter((f): f is SQL => f !== undefined)))
            .groupBy(accounts.id)
        : Promise.resolve([]);

    const [allTimeBalanceRows, beforeFinancialYearBalanceRows, withinFinancialYearBalanceRows] = await Promise.all([
        allTimeBalancePromise,
        beforeFinancialYearBalancePromise,
        withinFinancialYearBalancePromise
    ]);

    for (const log of accountUpdateAudits as any[]) {
        const entityId = Number(log.entityId);
        if (!entityId || latestEditorByAccountId.has(entityId)) continue;
        latestEditorByAccountId.set(entityId, {
            id: Number(log.actionBy),
            fullName: log.editorName || null
        });
    }

    const allTimeNetDeltaByAccount = new Map<number, number>(
        (allTimeBalanceRows as any[]).map((row) => [Number(row.accountId), Number(row.netDelta || 0)])
    );
    const beforeFinancialYearNetDeltaByAccount = new Map<number, number>(
        (beforeFinancialYearBalanceRows as any[]).map((row) => [Number(row.accountId), Number(row.netDelta || 0)])
    );
    const withinFinancialYearNetDeltaByAccount = new Map<number, number>(
        (withinFinancialYearBalanceRows as any[]).map((row) => [Number(row.accountId), Number(row.netDelta || 0)])
    );

    // Dynamic Conversion
    const baseCurrency = (targetCurrency || orgList[0]?.baseCurrency || 'USD').toUpperCase();
    const sourceCurrencies = new Set(
        rows.map((row) => String(row.currency?.code || 'USD').toUpperCase())
    );
    const ratesByCurrency = new Map<string, number>();
    await Promise.all(
        Array.from(sourceCurrencies).map(async (fromCurrency) => {
            if (fromCurrency === baseCurrency) {
                ratesByCurrency.set(fromCurrency, 1);
                return;
            }
            const rate = await ExchangeRateService.getRate(fromCurrency, baseCurrency, orgId);
            ratesByCurrency.set(fromCurrency, rate || 1);
        })
    );

    const enriched = rows.map((row) => {
        const acc = row.account;
        const openingBalanceLocal = Number(acc.openingBalance || 0);
        const accountId = Number(acc.id);
        const openingBalanceDate = acc.openingBalanceDate || null;
        const hasSelectedFinancialYear = Boolean(selectedFinancialYear);

        let effectiveOpeningBalanceLocal = openingBalanceLocal;
        let closingBalanceLocal = openingBalanceLocal + (allTimeNetDeltaByAccount.get(accountId) || 0);

        if (selectedFinancialYear) {
            const openingBalanceBeforeFinancialYear = openingBalanceDate && openingBalanceDate < selectedFinancialYear.startDate
                ? openingBalanceLocal
                : 0;
            const openingBalanceWithinFinancialYear = openingBalanceDate &&
                openingBalanceDate >= selectedFinancialYear.startDate &&
                openingBalanceDate <= selectedFinancialYear.endDate
                ? openingBalanceLocal
                : 0;

            effectiveOpeningBalanceLocal =
                openingBalanceBeforeFinancialYear + (beforeFinancialYearNetDeltaByAccount.get(accountId) || 0);

            closingBalanceLocal =
                effectiveOpeningBalanceLocal +
                openingBalanceWithinFinancialYear +
                (withinFinancialYearNetDeltaByAccount.get(accountId) || 0);
        }

        const accountCurrency = String(row.currency?.code || 'USD').toUpperCase();
        const rate = ratesByCurrency.get(accountCurrency) ?? 1;
        const convertedOpening = effectiveOpeningBalanceLocal * rate;
        const convertedClosing = closingBalanceLocal * rate;
        const bankMeta = resolveBankFromIfsc(acc.ifsc);

        return {
            ...acc,
            currency: row.currency,
            branch: row.branch,
            creator: row.creator,
            lastEditor: latestEditorByAccountId.get(Number(acc.id)) || null,
            parentAccount: row.parentAccount,
            currencyCode: accountCurrency,
            baseCurrency,
            financialYearId: selectedFinancialYear?.id ?? null,
            financialYearScoped: hasSelectedFinancialYear,
            convertedBalance: convertedOpening,
            closingBalanceLocal,
            closingBalance: convertedClosing,
            closing_balance: convertedClosing,
            bankCode: bankMeta.bankCode,
            bankName: bankMeta.bankName,
            bankLogoKey: bankMeta.bankLogoKey,
            typeLabel: getAccountTypeName(acc.accountType),
            subtypeLabel: getAccountSubtypeName(acc.subtype),
            parentAccountName: row.parentAccount?.name || null,
            isActive: acc.status === 1
        };
    });

    return enriched;
};

// Helper internal function to check valid branch
const validateBranch = async (branchId: number, orgId: number) => {
    const [branch] = await db.select().from(branches).where(and(eq(branches.id, branchId), eq(branches.orgId, orgId)));
    if (!branch) throw new Error('Invalid branch for this organization');
    if (branch.status === 2) throw new Error('Cannot create account for an inactive branch');
};

export const createAccount = async (data: {
    branchId?: number;
    branchName?: string;

    name: string;
    accountType: number;
    subtype?: number | null;
    parentAccountId?: number | null;
    currencyCode: string;
    fxRate?: string | number;
    openingBalance: string | number;
    openingBalanceDate: string;
    description?: string;
    isActive?: boolean;

    accountNo?: string; // legacy support
    accountNumber?: string | null;
    ifsc?: string | null;
    zipCode?: string | null;
    bankBranchName?: string | null;

    orgId?: number;
    userId: number;
    targetCurrency?: string;
}) => {
    const orgId = data.orgId || DEFAULT_ORG_ID;
    let branchId = data.branchId;

    // 1. If branch name provided, find specific branch in Org
    if (data.branchName) {
        const [branch] = await db.select().from(branches).where(and(eq(branches.orgId, orgId), eq(branches.name, data.branchName)));
        if (!branch) throw new Error(`Invalid branch name: ${data.branchName}`);
        branchId = branch.id;
    }

    // Default branch fallback
    if (!branchId) branchId = DEFAULT_BRANCH_ID;

    // Validate Branch
    await validateBranch(branchId, orgId);

    // Validate Type & Subtype
    let accountSubtype = data.subtype !== undefined ? data.subtype : null;
    if (accountSubtype === 0) accountSubtype = null;

    if (!validateSubtypeMatchesType(data.accountType, accountSubtype)) {
        throw new Error(`Invalid Subtype ${accountSubtype} for Account Type ${data.accountType}`);
    }

    // Validate Parent Account (if provided)
    if (data.parentAccountId) {
        const [parent] = await db.select().from(accounts).where(eq(accounts.id, data.parentAccountId));
        if (!parent) throw new Error('Parent account not found');
        if (parent.accountType !== data.accountType) {
            throw new Error('Parent account must belong to the same Account Type');
        }
        if (parent.branchId !== branchId) {
            throw new Error('Parent account must belong to the same branch');
        }
    }

    // Check Uniqueness
    const [existing] = await db.select().from(accounts).where(and(eq(accounts.branchId, branchId), eq(accounts.name, data.name)));
    if (existing) throw new Error(`Account '${data.name}' already exists in this branch.`);

    // 2. Insert Account

    // Get Currency ID
    let currencyId = null;
    const normalizedCurrencyCode = (data.currencyCode || 'USD').toUpperCase();
    if (data.currencyCode) {
        const [currency] = await db.select().from(currencies).where(eq(currencies.code, normalizedCurrencyCode));
        if (currency) currencyId = currency.id;
    }

    const insertValues: any = {
        orgId: orgId,
        branchId: branchId,
        name: data.name,
        accountType: data.accountType,
        subtype: accountSubtype,
        parentAccountId: data.parentAccountId || null,
        description: data.description || null,

        // Ensure numeric storage for balance
        openingBalance: String(data.openingBalance || '0'),
        openingBalanceDate: data.openingBalanceDate,

        accountNumber: (data.accountNumber || (data as any).accountNo || null),
        ifsc: (data.ifsc || null),
        zipCode: (data.zipCode || (data as any).zip_code || null),
        bankBranchName: (data.bankBranchName || (data as any).bank_branch_name || null),
        currencyId: currencyId,
        status: (data.isActive === false) ? 2 : 1,
        createdBy: data.userId
    };

    console.log('[AccountsService.createAccount] Inserting Values:', JSON.stringify(insertValues, null, 2));

    const [result] = await db.insert(accounts).values(insertValues);

    const [newAccount] = await db.select().from(accounts).where(eq(accounts.id, result.insertId));
    console.log('[AccountsService.createAccount] saved bank fields:', {
        id: result.insertId,
        accountNumber: newAccount?.accountNumber,
        ifsc: newAccount?.ifsc,
        zipCode: (newAccount as any)?.zipCode,
        bankBranchName: (newAccount as any)?.bankBranchName
    });

    if (newAccount) {
        await AuditService.log(
            orgId,
            'account',
            newAccount.id,
            'create',
            data.userId,
            null,
            newAccount
        );
    }

    // Return enriched format immediately? or just raw? 
    // Controller usually fetches fresh or we construct it.
    // Return enriched row so websocket listeners can render converted values immediately.
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    const baseCurrency = (data.targetCurrency || org?.baseCurrency || 'USD').toUpperCase();
    const accountCurrency = normalizedCurrencyCode || 'USD';
    const openingBalanceNum = Number(newAccount?.openingBalance || 0);

    let fxRate = Number(data.fxRate || 1);
    if (accountCurrency !== baseCurrency && fxRate === 1) {
        const fetchedRate = await ExchangeRateService.getRate(accountCurrency, baseCurrency, orgId);
        if (fetchedRate !== 1) {
            fxRate = fetchedRate;
        }
    }

    const convertedBalance = Math.round(((openingBalanceNum * fxRate) + Number.EPSILON) * 100) / 100;
    const bankMeta = resolveBankFromIfsc(newAccount?.ifsc);

    return {
        ...newAccount,
        currencyCode: accountCurrency,
        baseCurrency,
        fxRate: fxRate.toString(),
        convertedBalance,
        bankCode: bankMeta.bankCode,
        bankName: bankMeta.bankName,
        bankLogoKey: bankMeta.bankLogoKey,
        isActive: newAccount!.status === 1,
        typeLabel: getAccountTypeName(newAccount!.accountType),
        subtypeLabel: getAccountSubtypeName(newAccount!.subtype)
    };
};

export const updateAccount = async (id: number, data: {
    name?: string;
    accountType?: number;
    subtype?: number;
    parentAccountId?: number | null;
    currencyCode?: string;
    openingBalance?: string | number;
    openingBalanceDate?: string;
    description?: string;
    isActive?: boolean;

    accountNo?: string;
    accountNumber?: string | null;
    ifsc?: string | null;
    zipCode?: string | null;
    bankBranchName?: string | null;
    status?: 1 | 2;
}, orgId: number = DEFAULT_ORG_ID, userId?: number) => {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    if (!account) throw new Error('Account not found');
    if (account.orgId !== orgId) throw new Error('Unauthorized access to this account');

    // Check Org Status
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (org && org.status === 2) throw new Error('Cannot update account for an inactive organization');

    // Uniqueness check only if name changes
    if (data.name && data.name !== account.name) {
        const [existing] = await db.select()
            .from(accounts)
            .where(
                and(
                    eq(accounts.branchId, account.branchId),
                    eq(accounts.name, data.name)
                )
            );
        if (existing) throw new Error(`Account '${data.name}' already exists in this branch.`);
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;

    // Type/Subtype Update Logic
    if (data.accountType !== undefined || data.subtype !== undefined) {
        const newType = data.accountType !== undefined ? data.accountType : account.accountType;
        let newSubtype = data.subtype !== undefined ? data.subtype : account.subtype;
        if (newSubtype === 0) newSubtype = null;

        if (!validateSubtypeMatchesType(newType, newSubtype)) {
            throw new Error(`Invalid Subtype ${newSubtype} for Account Type ${newType}`);
        }
        if (data.accountType !== undefined) updateData.accountType = data.accountType;
        if (data.subtype !== undefined) updateData.subtype = newSubtype;
    }

    if (data.parentAccountId !== undefined) {
        if (data.parentAccountId) {
            // Check parent validity
            const [parent] = await db.select().from(accounts).where(eq(accounts.id, data.parentAccountId));
            if (!parent) throw new Error('Parent account not found');
            const targetType = data.accountType || account.accountType;
            if (parent.accountType !== targetType) {
                throw new Error('Parent account must belong to the same Account Type');
            }
            if (parent.branchId !== account.branchId) {
                throw new Error('Parent account must belong to the same branch');
            }
        }
        updateData.parentAccountId = data.parentAccountId;
    }

    if (data.openingBalance !== undefined) updateData.openingBalance = String(data.openingBalance);
    if (data.openingBalanceDate) updateData.openingBalanceDate = data.openingBalanceDate;
    if (data.currencyCode) {
        const [currency] = await db.select().from(currencies).where(eq(currencies.code, data.currencyCode));
        if (currency) updateData.currencyId = currency.id;
    }
    if (data.description !== undefined) updateData.description = data.description;

    // Active/Status Logic
    if (data.isActive !== undefined) {
        updateData.status = data.isActive ? 1 : 2;
    } else if (data.status) {
        updateData.status = data.status;
    }

    // Support both casings/names for legacy
    if (data.accountNumber !== undefined) updateData.accountNumber = data.accountNumber;
    else if ((data as any).accountNo !== undefined) updateData.accountNumber = (data as any).accountNo;
    else if ((data as any).account_number !== undefined) updateData.accountNumber = (data as any).account_number;

    if (data.ifsc !== undefined) updateData.ifsc = (data.ifsc || null);

    if (data.zipCode !== undefined) updateData.zipCode = (data.zipCode || null);
    else if ((data as any).zip_code !== undefined) updateData.zipCode = ((data as any).zip_code || null);

    if (data.bankBranchName !== undefined) updateData.bankBranchName = (data.bankBranchName || null);
    else if ((data as any).bank_branch_name !== undefined) updateData.bankBranchName = ((data as any).bank_branch_name || null);
    else if ((data as any).bank_branch !== undefined) updateData.bankBranchName = ((data as any).bank_branch || null);

    await db.update(accounts).set(updateData).where(eq(accounts.id, id));

    const [updated] = await db.select().from(accounts).where(eq(accounts.id, id));
    console.log('[AccountsService.updateAccount] saved bank fields:', {
        id,
        accountNumber: updated?.accountNumber,
        ifsc: updated?.ifsc,
        zipCode: (updated as any)?.zipCode,
        bankBranchName: (updated as any)?.bankBranchName
    });

    // Audit Log
    if (updated && userId) {
        await AuditService.log(
            orgId,
            'account',
            id,
            'update',
            userId,
            account,
            updated
        );
    }

    const bankMeta = resolveBankFromIfsc(updated?.ifsc);
    return {
        ...updated,
        bankCode: bankMeta.bankCode,
        bankName: bankMeta.bankName,
        bankLogoKey: bankMeta.bankLogoKey
    };
};

// Specific opening balance update
export const updateOpeningBalance = async (id: number, data: {
    openingBalance: string;
    openingBalanceDate: string;
}, orgId: number = DEFAULT_ORG_ID) => {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    if (!account) throw new Error('Account not found');
    if (account.orgId !== orgId) throw new Error('Unauthorized access to this account');

    // Check Org Status
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (org && org.status === 2) throw new Error('Cannot update account for an inactive organization');

    await db.update(accounts)
        .set({
            openingBalance: data.openingBalance,
            openingBalanceDate: data.openingBalanceDate
        })
        .where(eq(accounts.id, id));

    const [updated] = await db.select().from(accounts).where(eq(accounts.id, id));
    return updated;
};

export const deleteAccount = async (id: number, orgId: number = DEFAULT_ORG_ID, skipBranch: boolean = false, branchId?: number, userId?: number) => {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    if (!account) throw new Error('Account not found');

    if (account.orgId !== orgId) throw new Error('Unauthorized access to this account');

    // Check Org Status
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (org && org.status === 2) throw new Error('Cannot delete account for an inactive organization');

    if (!skipBranch) {
        if (!branchId) throw new Error('Branch ID is required for deletion unless skipBranch is true');
        if (account.branchId !== branchId) throw new Error('Account does not belong to the specified branch');
    }

    // Soft delete logic check? User said "Delete button soft deletes OR prevents delete if transactions exist"
    // "Delete Account" usually means hard delete from user perspective if no transactions, OR status=Inactive.
    // Given the `isActive` field, maybe we should just set isActive=false?
    // But existing `deleteAccount` did a db.delete.
    // We will stick to `db.delete` which will fail if foreign keys exist (transactions), catching that error in controller.

    await db.delete(accounts).where(eq(accounts.id, id));

    // Audit Log
    if (userId) {
        await AuditService.log(
            orgId,
            'account',
            id,
            'delete',
            userId,
            account,
            null
        );
    }
    return true;
};

export const getAccountNetSettlement = async (
    accountId: number,
    orgId: number = DEFAULT_ORG_ID,
    targetCurrency?: string,
    user?: any
) => {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    if (!account) throw new Error('Account not found');
    if (account.orgId !== orgId) throw new Error('Unauthorized access to this account');

    if (user?.role === 'member') {
        const userBranchIds = typeof user.branchIds === 'string'
            ? user.branchIds.split(',').filter(Boolean).map(Number)
            : (Array.isArray(user.branchIds) ? user.branchIds : []);
        if (!userBranchIds.includes(Number(account.branchId))) {
            throw new Error('Forbidden: You do not have access to this branch');
        }
    }

    const counterpartEntries = aliasedTable(transactionEntries, 'counterpart_entries');
    const counterpartAccounts = aliasedTable(accounts, 'counterpart_accounts');

    const rows = await db.select({
        counterpartyId: counterpartEntries.accountId,
        counterpartyName: counterpartAccounts.name,
        currencyCode: currencies.code,
        netLocal: sql<string>`COALESCE(SUM(COALESCE(${transactionEntries.credit}, 0) - COALESCE(${transactionEntries.debit}, 0)), 0)`
    })
        .from(transactionEntries)
        .innerJoin(transactions, and(
            eq(transactions.id, transactionEntries.transactionId),
            eq(transactions.orgId, orgId),
            eq(transactions.status, 1)
        ))
        .innerJoin(counterpartEntries, and(
            eq(counterpartEntries.transactionId, transactionEntries.transactionId),
            sql`${counterpartEntries.accountId} <> ${transactionEntries.accountId}`
        ))
        .innerJoin(counterpartAccounts, eq(counterpartAccounts.id, counterpartEntries.accountId))
        .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
        .where(eq(transactionEntries.accountId, accountId))
        .groupBy(counterpartEntries.accountId, counterpartAccounts.name, currencies.code)
        .having(sql`COALESCE(SUM(COALESCE(${transactionEntries.credit}, 0) - COALESCE(${transactionEntries.debit}, 0)), 0) <> 0`);

    const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    const finalCurrency = (targetCurrency || orgList[0]?.baseCurrency || 'USD').toUpperCase();

    const ratesByCurrency = new Map<string, number>();
    const sourceCurrencies = new Set(
        (rows as any[]).map((row) => String(row.currencyCode || 'USD').toUpperCase())
    );
    await Promise.all(
        Array.from(sourceCurrencies).map(async (fromCurrency) => {
            if (fromCurrency === finalCurrency) {
                ratesByCurrency.set(fromCurrency, 1);
                return;
            }
            const rate = await ExchangeRateService.getRate(fromCurrency, finalCurrency, orgId);
            ratesByCurrency.set(fromCurrency, rate || 1);
        })
    );

    const merged = new Map<number, { counterparty_id: number; counterparty_name: string; net_amount: number }>();
    for (const row of rows as any[]) {
        const counterpartyId = Number(row.counterpartyId);
        const currencyCode = String(row.currencyCode || 'USD').toUpperCase();
        const rate = ratesByCurrency.get(currencyCode) ?? 1;
        const converted = Number(row.netLocal || 0) * rate;
        const current = merged.get(counterpartyId) || {
            counterparty_id: counterpartyId,
            counterparty_name: row.counterpartyName || 'Unknown',
            net_amount: 0
        };
        current.net_amount += converted;
        merged.set(counterpartyId, current);
    }

    return {
        account_id: accountId,
        currency: finalCurrency,
        items: Array.from(merged.values()).filter(item => Number(item.net_amount) !== 0)
    };
};
