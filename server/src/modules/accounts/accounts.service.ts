
import { db } from '../../db';
import { accounts, branches, organizations, currencies, users, transactionEntries, transactions, auditLogs, financialYears } from '../../db/schema';
import { eq, and, desc, inArray, SQL, aliasedTable, sql, lt } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { ExchangeRateService } from '../../shared/exchange-rate.service';
import { CurrencyMasterService } from '../../shared/currency-master.service';
import { resolveBankFromIfsc } from '../../shared/ifsc-bank';
import { DELETED_STATUS, isActiveStatus, isNotDeleted } from '../../shared/soft-delete';
import {
    validateSubtypeMatchesType,
    getAccountTypeName,
    getAccountSubtypeName,
    ACCOUNT_TYPES,
    ACCOUNT_SUBTYPES,
    ACCOUNT_TYPE_LABELS,
    ACCOUNT_SUBTYPE_LABELS
} from './constants';

const DEFAULT_ORG_ID = 1;
const DEFAULT_BRANCH_ID = 1;


const buildDeletedAccountName = (name: string) => {
    const suffix = ` [DELETED ${Date.now()}]`;
    const maxLength = 120;
    const trimmedName = String(name || '').trim();
    const baseName = trimmedName.slice(0, Math.max(0, maxLength - suffix.length)).trim();
    return `${baseName || 'Account'}${suffix}`;
};

export const getAllAccounts = async (
    orgId: number = DEFAULT_ORG_ID,
    status?: 1 | 2 | 3,
    targetCurrency?: string,
    user?: any,
    financialYearId?: number
) => {
    const filters: (SQL | undefined)[] = [eq(accounts.orgId, orgId), isNotDeleted(accounts)];

    // Accounts are global across the organization.

    if (status) {
        filters.push(eq(accounts.status, status));
    }

    const result = await db.select({
        account: accounts,
        currency: currencies,
        creator: {
            id: users.id,
            fullName: users.fullName,
            email: users.email
        }
    })
        .from(accounts)
        .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
        .leftJoin(users, eq(accounts.createdBy, users.id))
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
        currencyCode: currencies.code,
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
            isNotDeleted(transactions)
        ))
        .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
        .where(and(...filters.filter((f): f is SQL => f !== undefined)))
        .groupBy(accounts.id, currencies.code);

    const beforeFinancialYearBalancePromise = selectedFinancialYear
        ? db.select({
            accountId: accounts.id,
            currencyCode: currencies.code,
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
                lt(transactions.txnDate, selectedFinancialYear.startDate),
                isNotDeleted(transactions)
            ))
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .where(and(...filters.filter((f): f is SQL => f !== undefined)))
            .groupBy(accounts.id, currencies.code)
        : Promise.resolve([]);

    const withinFinancialYearBalancePromise = selectedFinancialYear
        ? db.select({
            accountId: accounts.id,
            currencyCode: currencies.code,
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
                eq(transactions.financialYearId, selectedFinancialYear.id),
                isNotDeleted(transactions)
            ))
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .where(and(...filters.filter((f): f is SQL => f !== undefined)))
            .groupBy(accounts.id, currencies.code)
        : Promise.resolve([]);

    const transactionCountPromise = db.select({
        accountId: transactionEntries.accountId,
        count: sql<number>`count(DISTINCT ${transactionEntries.transactionId})`
    })
        .from(transactionEntries)
        .innerJoin(transactions, and(
            eq(transactions.id, transactionEntries.transactionId),
            eq(transactions.orgId, orgId),
            eq(transactions.status, 1),
            isNotDeleted(transactions)
        ))
        .where(inArray(transactionEntries.accountId, accountIds))
        .groupBy(transactionEntries.accountId);

    const [allTimeBalanceRows, beforeFinancialYearBalanceRows, withinFinancialYearBalanceRows, transactionCountRows] = await Promise.all([
        allTimeBalancePromise,
        beforeFinancialYearBalancePromise,
        withinFinancialYearBalancePromise,
        transactionCountPromise
    ]);

    for (const log of accountUpdateAudits as any[]) {
        const entityId = Number(log.entityId);
        if (!entityId || latestEditorByAccountId.has(entityId)) continue;
        latestEditorByAccountId.set(entityId, {
            id: Number(log.actionBy),
            fullName: log.editorName || null
        });
    }

    const baseCurrency = (targetCurrency || orgList[0]?.baseCurrency || 'USD').toUpperCase();
    const ratesByCurrency = new Map<string, number>();
    const convertToBase = async (amount: number, fromCurrency?: string | null) => {
        const numericAmount = Number(amount || 0);
        if (!numericAmount) return 0;

        const normalizedCurrency = String(fromCurrency || baseCurrency || 'USD').toUpperCase();
        if (normalizedCurrency === baseCurrency) return numericAmount;

        if (!ratesByCurrency.has(normalizedCurrency)) {
            const rate = await ExchangeRateService.getRate(normalizedCurrency, baseCurrency, orgId);
            ratesByCurrency.set(normalizedCurrency, rate || 1);
        }

        return numericAmount * (ratesByCurrency.get(normalizedCurrency) ?? 1);
    };

    const accumulateConvertedNetDeltas = async (balanceRows: any[]) => {
        const totalsByAccount = new Map<number, number>();

        for (const row of balanceRows as any[]) {
            const accountId = Number(row.accountId);
            if (!accountId) continue;

            const convertedNet = await convertToBase(Number(row.netDelta || 0), row.currencyCode);
            totalsByAccount.set(accountId, (totalsByAccount.get(accountId) || 0) + convertedNet);
        }

        return totalsByAccount;
    };

    const [
        allTimeNetDeltaByAccount,
        beforeFinancialYearNetDeltaByAccount,
        withinFinancialYearNetDeltaByAccount
    ] = await Promise.all([
        accumulateConvertedNetDeltas(allTimeBalanceRows as any[]),
        accumulateConvertedNetDeltas(beforeFinancialYearBalanceRows as any[]),
        accumulateConvertedNetDeltas(withinFinancialYearBalanceRows as any[])
    ]);

    const transactionCountByAccount = new Map<number, number>();
    for (const row of transactionCountRows as any[]) {
        const accountId = Number(row.accountId);
        if (accountId) transactionCountByAccount.set(accountId, Number(row.count || 0));
    }

    const enriched = await Promise.all(rows.map(async (row) => {
        const acc = row.account;
        const openingBalanceLocal = Number(acc.openingBalance || 0);
        const accountId = Number(acc.id);
        const openingBalanceDate = acc.openingBalanceDate || null;
        const hasSelectedFinancialYear = Boolean(selectedFinancialYear);
        const accountCurrency = String(row.currency?.code || 'USD').toUpperCase();
        const openingBalanceBase = await convertToBase(openingBalanceLocal, accountCurrency);

        let effectiveOpeningBalance = openingBalanceBase;
        let closingBalance = openingBalanceBase + (allTimeNetDeltaByAccount.get(accountId) || 0);

        if (selectedFinancialYear) {
            const isOpeningBalanceActiveByEndOfYear = !openingBalanceDate || openingBalanceDate <= selectedFinancialYear.endDate;

            effectiveOpeningBalance =
                (isOpeningBalanceActiveByEndOfYear ? openingBalanceBase : 0) +
                (beforeFinancialYearNetDeltaByAccount.get(accountId) || 0);

            closingBalance =
                effectiveOpeningBalance +
                (withinFinancialYearNetDeltaByAccount.get(accountId) || 0);
        }

        const bankMeta = resolveBankFromIfsc(acc.ifsc);

        return {
            ...acc,
            currency: row.currency,
            creator: row.creator,
            lastEditor: latestEditorByAccountId.get(Number(acc.id)) || null,
            currencyCode: accountCurrency,
            baseCurrency,
            financialYearId: selectedFinancialYear?.id ?? null,
            financialYearScoped: hasSelectedFinancialYear,
            convertedBalance: effectiveOpeningBalance,
            closingBalanceLocal: closingBalance,
            closingBalance,
            closing_balance: closingBalance,
            bankCode: bankMeta.bankCode,
            bankName: acc.bankName ?? null,
            bankLogoKey: bankMeta.bankLogoKey,
            typeLabel: getAccountTypeName(acc.accountType),
            subtypeLabel: getAccountSubtypeName(acc.subtype),
            totalTransactions: transactionCountByAccount.get(accountId) || 0,
            isActive: acc.status === 1
        };
    }));

    return enriched;
};

export const createAccount = async (data: {
    name: string;
    accountType: number;
    subtype?: number | null;
    currencyCode: string;
    fxRate?: string | number;
    openingBalance: string | number;
    openingBalanceDate: string;
    description?: string;
    isActive?: boolean;

    accountNo?: string; // legacy support
    accountHolderName?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
    ifsc?: string | null;
    zipCode?: string | null;
    bankBranchName?: string | null;

    orgId?: number;
    userId: number;
    branchId?: number | null;
    targetCurrency?: string;
}) => {
    const orgId = data.orgId || DEFAULT_ORG_ID;
    const normalizedBranchId =
        data.branchId === undefined || data.branchId === null
            ? null
            : Number(data.branchId);
    let branchCurrencyCode: string | null = null;

    // Validate Type & Subtype
    let accountSubtype = data.subtype !== undefined ? data.subtype : null;
    if (accountSubtype === 0) accountSubtype = null;

    if (!validateSubtypeMatchesType(data.accountType, accountSubtype)) {
        throw new Error(`Invalid Subtype ${accountSubtype} for Account Type ${data.accountType}`);
    }

    if (normalizedBranchId !== null) {
        if (!Number.isFinite(normalizedBranchId)) {
            throw new Error('Selected office branch is invalid.');
        }

        const [selectedBranch] = await db.select({ id: branches.id, currencyCode: branches.currencyCode })
            .from(branches)
            .where(and(eq(branches.id, normalizedBranchId), eq(branches.orgId, orgId)))
            .limit(1);

        if (!selectedBranch) {
            throw new Error('Selected office branch is invalid or no longer exists for this organization.');
        }

        branchCurrencyCode = selectedBranch.currencyCode || null;
    }

    const isBankAccount = data.accountType === ACCOUNT_TYPES.ASSET && accountSubtype === ACCOUNT_SUBTYPES.BANK;
    const normalizedAccountHolderName = String(data.accountHolderName ?? (data as any).account_holder_name ?? '').trim();
    const normalizedBankName = String(data.bankName ?? (data as any).bank_name ?? '').trim();
    const normalizedIfscOrIban = String(data.ifsc || '').trim().toUpperCase();
    const normalizedSwiftOrNic = String(data.zipCode ?? (data as any).zip_code ?? '').trim().toUpperCase();
    const isForexBranch = branchCurrencyCode ? branchCurrencyCode.toUpperCase() !== 'INR' : false;

    if (isBankAccount && !normalizedAccountHolderName) {
        throw new Error('Account holder name is required for Bank accounts');
    }

    if (isBankAccount && !normalizedBankName) {
        throw new Error('Bank name is required for Bank accounts');
    }

    if (isBankAccount && !isForexBranch && !normalizedIfscOrIban) {
        throw new Error('IFSC is required for Indian bank accounts');
    }

    if (isBankAccount && !isForexBranch && !normalizedSwiftOrNic) {
        throw new Error('SWIFT/BIC code is required for Indian bank accounts');
    }


    // Check Uniqueness
    const [existing] = await db.select()
        .from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.name, data.name), isNotDeleted(accounts)));
    if (existing) throw new Error(`Account '${data.name}' already exists in this organization.`);

    // 2. Insert Account

    // Get Currency ID
    const resolvedCurrency = await CurrencyMasterService.ensureCurrencyExists(data.currencyCode || 'USD');
    const currencyId = resolvedCurrency.id;
    const normalizedCurrencyCode = resolvedCurrency.code;

    const [creator] = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.id, data.userId))
        .limit(1);

    if (!creator) {
        throw new Error('Current user is invalid. Please log in again.');
    }

    const insertValues = {
        orgId,
        name: data.name,
        accountType: data.accountType,
        subtype: accountSubtype,
        openingBalance: String(data.openingBalance || '0'),
        openingBalanceDate: data.openingBalanceDate,
        accountHolderName: isBankAccount ? normalizedAccountHolderName : '',
        bankName: isBankAccount ? normalizedBankName : '',
        accountNumber: data.accountNumber || (data as any).accountNo || null,
        ifsc: normalizedIfscOrIban || null,
        description: data.description || null,
        status: (data.isActive === false) ? 2 : 1,
        createdBy: data.userId,
        currencyId,
        branchId: normalizedBranchId,
        zipCode: normalizedSwiftOrNic || null,
        bankBranchName: data.bankBranchName || (data as any).bank_branch_name || null,
    };

    const result = await db.insert(accounts).values(insertValues);
    const insertedId = Number((result as any)?.[0]?.insertId ?? (result as any)?.insertId);
    const [newAccount] = await db.select().from(accounts).where(eq(accounts.id, insertedId));

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
        bankName: newAccount?.bankName || null,
        bankCode: bankMeta.bankCode,
        bankLogoKey: bankMeta.bankLogoKey,
        isActive: newAccount!.status === 1,
        typeLabel: getAccountTypeName(newAccount!.accountType),
        subtypeLabel: getAccountSubtypeName(newAccount!.subtype)
    };
};

export const updateAccount = async (id: number, data: {
    name?: string;
    accountType?: number;
    subtype?: number | null;
    currencyCode?: string;
    openingBalance?: string | number;
    openingBalanceDate?: string;
    description?: string;
    isActive?: boolean;

    accountNo?: string;
    accountHolderName?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
    ifsc?: string | null;
    zipCode?: string | null;
    bankBranchName?: string | null;
    branchId?: number | null;
    status?: 1 | 2;
}, orgId: number = DEFAULT_ORG_ID, userId?: number) => {
    const [account] = await db.select().from(accounts).where(and(eq(accounts.id, id), isNotDeleted(accounts)));
    if (!account) throw new Error('Account not found');
    if (account.orgId !== orgId) throw new Error('Unauthorized access to this account');

    // Check Org Status
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (org && !isActiveStatus(org.status)) throw new Error('Cannot update account for an inactive organization');

    // Uniqueness check only if name changes
    if (data.name && data.name !== account.name) {
        const [existing] = await db.select()
            .from(accounts)
            .where(
                and(
                    eq(accounts.orgId, account.orgId),
                    eq(accounts.name, data.name),
                    isNotDeleted(accounts)
                )
            );
        if (existing) throw new Error(`Account '${data.name}' already exists in this organization.`);
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


    if (data.openingBalance !== undefined) updateData.openingBalance = String(data.openingBalance);
    if (data.openingBalanceDate) updateData.openingBalanceDate = data.openingBalanceDate;
    if (data.currencyCode) {
        const resolvedCurrency = await CurrencyMasterService.ensureCurrencyExists(data.currencyCode);
        updateData.currencyId = resolvedCurrency.id;
    }
    if (data.description !== undefined) updateData.description = data.description;

    const nextAccountType = data.accountType !== undefined ? data.accountType : account.accountType;
    const nextSubtype = data.subtype !== undefined ? data.subtype : account.subtype;
    const isBankAccount = nextAccountType === ACCOUNT_TYPES.ASSET && nextSubtype === ACCOUNT_SUBTYPES.BANK;
    const requestedBranchId =
        data.branchId === undefined || data.branchId === null
            ? account.branchId
            : Number(data.branchId);
    let branchCurrencyCode: string | null = null;

    if (requestedBranchId !== null && requestedBranchId !== undefined) {
        if (!Number.isFinite(requestedBranchId)) {
            throw new Error('Selected office branch is invalid.');
        }

        const [selectedBranch] = await db.select({ id: branches.id, currencyCode: branches.currencyCode })
            .from(branches)
            .where(and(eq(branches.id, requestedBranchId), eq(branches.orgId, orgId)))
            .limit(1);

        if (!selectedBranch) {
            throw new Error('Selected office branch is invalid or no longer exists for this organization.');
        }

        branchCurrencyCode = selectedBranch.currencyCode || null;
    }

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

    if (data.ifsc !== undefined) updateData.ifsc = (String(data.ifsc || '').trim().toUpperCase() || null);

    if (data.zipCode !== undefined) updateData.zipCode = (String(data.zipCode || '').trim().toUpperCase() || null);
    else if ((data as any).zip_code !== undefined) updateData.zipCode = (String((data as any).zip_code || '').trim().toUpperCase() || null);

    if (data.branchId !== undefined) updateData.branchId = (data.branchId || null);

    if (data.bankBranchName !== undefined) updateData.bankBranchName = (data.bankBranchName || null);
    else if ((data as any).bank_branch_name !== undefined) updateData.bankBranchName = ((data as any).bank_branch_name || null);
    else if ((data as any).bank_branch !== undefined) updateData.bankBranchName = ((data as any).bank_branch || null);

    if (data.accountHolderName !== undefined) updateData.accountHolderName = String(data.accountHolderName || '').trim();
    else if ((data as any).account_holder_name !== undefined) updateData.accountHolderName = String((data as any).account_holder_name || '').trim();
    else if (!isBankAccount) updateData.accountHolderName = '';

    if (isBankAccount && !(updateData.accountHolderName ?? account.accountHolderName)?.trim()) {
        throw new Error('Account holder name is required for Bank accounts');
    }

    if (data.bankName !== undefined) updateData.bankName = String(data.bankName || '').trim();
    else if ((data as any).bank_name !== undefined) updateData.bankName = String((data as any).bank_name || '').trim();
    else if (!isBankAccount) updateData.bankName = '';

    if (isBankAccount && !(updateData.bankName ?? account.bankName)?.trim()) {
        throw new Error('Bank name is required for Bank accounts');
    }

    const isForexBranch = branchCurrencyCode ? branchCurrencyCode.toUpperCase() !== 'INR' : false;
    const nextIfscOrIban = String(updateData.ifsc ?? account.ifsc ?? '').trim().toUpperCase();
    const nextSwiftOrNic = String(updateData.zipCode ?? account.zipCode ?? '').trim().toUpperCase();

    if (isBankAccount && !isForexBranch && !nextIfscOrIban) {
        throw new Error('IFSC is required for Indian bank accounts');
    }

    if (isBankAccount && !isForexBranch && !nextSwiftOrNic) {
        throw new Error('SWIFT/BIC code is required for Indian bank accounts');
    }

    await db.update(accounts).set(updateData).where(eq(accounts.id, id));

    const [updated] = await db.select().from(accounts).where(eq(accounts.id, id));

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
        bankName: updated?.bankName || null,
        bankCode: bankMeta.bankCode,
        bankLogoKey: bankMeta.bankLogoKey
    };
};

// Specific opening balance update
export const updateOpeningBalance = async (id: number, data: {
    openingBalance: string;
    openingBalanceDate: string;
}, orgId: number = DEFAULT_ORG_ID) => {
    const [account] = await db.select().from(accounts).where(and(eq(accounts.id, id), isNotDeleted(accounts)));
    if (!account) throw new Error('Account not found');
    if (account.orgId !== orgId) throw new Error('Unauthorized access to this account');

    // Check Org Status
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (org && !isActiveStatus(org.status)) throw new Error('Cannot update account for an inactive organization');

    await db.update(accounts)
        .set({
            openingBalance: data.openingBalance,
            openingBalanceDate: data.openingBalanceDate
        })
        .where(eq(accounts.id, id));

    const [updated] = await db.select().from(accounts).where(eq(accounts.id, id));
    return updated;
};

export const deleteAccount = async (id: number, orgId: number = DEFAULT_ORG_ID, userId?: number) => {
    const [account] = await db.select().from(accounts).where(and(eq(accounts.id, id), isNotDeleted(accounts)));
    if (!account) throw new Error('Account not found');

    if (account.orgId !== orgId) throw new Error('Unauthorized access to this account');

    // Check Org Status
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (org && !isActiveStatus(org.status)) throw new Error('Cannot delete account for an inactive organization');

    const [usage] = await db.select({ id: transactionEntries.id })
        .from(transactionEntries)
        .innerJoin(transactions, eq(transactionEntries.transactionId, transactions.id))
        .where(and(
            eq(transactionEntries.accountId, id),
            eq(transactions.orgId, orgId),
            isNotDeleted(transactions)
        ))
        .limit(1);

    if (usage) {
        throw new Error("Cannot delete this account because it is used in associated records (Transactions).");
    }

    await db.update(accounts)
        .set({
            name: buildDeletedAccountName(account.name),
            status: DELETED_STATUS,
            updatedAt: new Date()
        })
        .where(eq(accounts.id, id));

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
    const [account] = await db.select().from(accounts).where(and(eq(accounts.id, accountId), isNotDeleted(accounts)));
    if (!account) throw new Error('Account not found');
    if (account.orgId !== orgId) throw new Error('Unauthorized access to this account');

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
            eq(transactions.status, 1),
            isNotDeleted(transactions)
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
