
import { db } from '../../db';
import { transactions, transactionEntries, accounts, auditLogs, transactionTypes, categories, subCategories, currencies, financialYears, branches, organizations, users, parties, importedStatements } from '../../db/schema';
import { eq, and, or, desc, lte, gte, inArray, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { ExchangeRateService } from '../../shared/exchange-rate.service';
import { CurrencyMasterService } from '../../shared/currency-master.service';
import { PDFParserService } from '../../shared/pdf-parser.service';
import { read, utils, write } from 'xlsx';

import { DELETED_STATUS, isActiveStatus, isNotDeleted } from '../../shared/soft-delete';

interface ImportError {
    row: number;
    message: string;
}

interface TransactionExportFilters {
    searchTerm?: string;
    appliedFilters?: {
        moneyFlow?: string;
        scope?: string;
        timePeriod?: string;
        startDate?: string;
        endDate?: string;
        payee?: string;
        activeIds?: number[];
    };
    sortConfig?: {
        key?: string;
        direction?: string;
    };
}

interface GroupedExportTransaction {
    id: number;
    name: string;
    txnDate: string | null;
    txnType: string;
    status: number | string | null;
    contact: string;
    accountName: string;
    categoryName: string;
    notes: string;
    amount: number;
    branchNames: string[];
}

export class TransactionService {
    private static formatExportDate(value?: string | Date | null) {
        if (!value) return '-';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(date);
    }

    private static escapeCsvValue(value: unknown) {
        const stringValue = value == null ? '' : String(value);
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    private static normalizeStatus(status: number | string | null | undefined) {
        return Number(status) === 1 ? 'Posted' : 'Draft';
    }

    private static filterGroupedTransactions(
        transactions: GroupedExportTransaction[],
        filters: TransactionExportFilters
    ) {
        let result = [...transactions];
        const searchTerm = (filters.searchTerm || '').trim().toLowerCase();
        const appliedFilters = filters.appliedFilters || {};
        const sortConfig = filters.sortConfig || {};

        if (searchTerm) {
            result = result.filter((txn) =>
                (txn.contact || '').toLowerCase().includes(searchTerm) ||
                (txn.name || '').toLowerCase().includes(searchTerm) ||
                (txn.notes || '').toLowerCase().includes(searchTerm) ||
                (txn.accountName || '').toLowerCase().includes(searchTerm) ||
                (txn.categoryName || '').toLowerCase().includes(searchTerm) ||
                (txn.txnType || '').toLowerCase().includes(searchTerm) ||
                String(txn.status || '').toLowerCase().includes(searchTerm) ||
                (txn.txnDate || '').toLowerCase().includes(searchTerm) ||
                String(txn.amount).includes(searchTerm)
            );
        }

        if (appliedFilters.moneyFlow && appliedFilters.moneyFlow !== 'All') {
            if (appliedFilters.moneyFlow === 'In') {
                result = result.filter((txn) => txn.txnType === 'income');
            } else if (appliedFilters.moneyFlow === 'Out') {
                result = result.filter((txn) => ['expense', 'transfer', 'investment'].includes(txn.txnType));
            }
        }

        if (appliedFilters.scope && appliedFilters.scope !== 'All Transactions') {
            result = result.filter((txn) => txn.txnType === appliedFilters.scope!.toLowerCase());
        }

        if (appliedFilters.payee && appliedFilters.payee !== 'All') {
            const payees = appliedFilters.payee.split(',').map(p => p.trim());
            result = result.filter((txn) => payees.includes(txn.contact!));
        }

        if (appliedFilters.timePeriod && appliedFilters.timePeriod !== 'All Time') {
            const now = new Date();
            result = result.filter((txn) => {
                const date = txn.txnDate ? new Date(txn.txnDate) : null;
                if (!date || Number.isNaN(date.getTime())) return false;

                if (appliedFilters.timePeriod === 'This Month') {
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                }
                if (appliedFilters.timePeriod === 'Last Month') {
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
                }
                if (appliedFilters.timePeriod === 'Last 6 Months') {
                    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                    return date >= sixMonthsAgo && date <= now;
                }
                if (appliedFilters.timePeriod === 'This Year') {
                    return date.getFullYear() === now.getFullYear();
                }
                if (appliedFilters.timePeriod === 'Last Year') {
                    return date.getFullYear() === now.getFullYear() - 1;
                }
                if (appliedFilters.timePeriod === 'Custom Range') {
                    if (appliedFilters.startDate && appliedFilters.endDate) {
                        const start = new Date(appliedFilters.startDate);
                        const end = new Date(appliedFilters.endDate);
                        end.setHours(23, 59, 59, 999);
                        return date >= start && date <= end;
                    }
                }

                return true;
            });
        }

        if (sortConfig.key) {
            result.sort((a, b) => {
                let aValue: any = '';
                let bValue: any = '';

                switch (sortConfig.key) {
                    case 'account':
                        aValue = a.accountName || '';
                        bValue = b.accountName || '';
                        break;
                    case 'category':
                        aValue = a.categoryName || '';
                        bValue = b.categoryName || '';
                        break;
                    case 'payee':
                        aValue = a.contact || '';
                        bValue = b.contact || '';
                        break;
                    case 'type':
                        aValue = a.txnType || '';
                        bValue = b.txnType || '';
                        break;
                    case 'name':
                        aValue = a.name || '';
                        bValue = b.name || '';
                        break;
                    case 'notes':
                        aValue = a.notes || '';
                        bValue = b.notes || '';
                        break;
                    case 'status':
                        aValue = a.status || '';
                        bValue = b.status || '';
                        break;
                    case 'amountBase':
                        aValue = Number(a.amount || 0);
                        bValue = Number(b.amount || 0);
                        break;
                    default:
                        if (sortConfig.key) {
                            aValue = (a as any)[sortConfig.key] || '';
                            bValue = (b as any)[sortConfig.key] || '';
                        } else {
                            aValue = '';
                            bValue = '';
                        }
                        break;
                }

                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }

    private static enrichExportTransaction(txn: any) {
        let accountName = txn.account?.name || '-';
        let categoryName = txn.category?.name || '-';

        if (Array.isArray(txn.entries) && txn.entries.length > 0) {
            const type = (txn.transactionType?.name || txn.txnType || '').toLowerCase();
            const typeId = txn.txnTypeId;

            if (type === 'expense' || typeId === 2) {
                const expenseEntry = txn.entries.find((entry: any) => Number(entry.debit || 0) > 0);
                const assetEntry = txn.entries.find((entry: any) => Number(entry.credit || 0) > 0);
                if (expenseEntry?.account?.name) categoryName = expenseEntry.account.name;
                if (assetEntry?.account?.name) accountName = assetEntry.account.name;
            } else if (type === 'income' || typeId === 1) {
                const assetEntry = txn.entries.find((entry: any) => Number(entry.debit || 0) > 0);
                const incomeEntry = txn.entries.find((entry: any) => Number(entry.credit || 0) > 0);
                if (assetEntry?.account?.name) accountName = assetEntry.account.name;
                if (incomeEntry?.account?.name) categoryName = incomeEntry.account.name;
            } else if (type === 'transfer' || typeId === 4 || type === 'investment' || typeId === 3) {
                const toEntry = txn.entries.find((entry: any) => Number(entry.debit || 0) > 0);
                const fromEntry = txn.entries.find((entry: any) => Number(entry.credit || 0) > 0);
                if (fromEntry?.account?.name) accountName = fromEntry.account.name;
                if (toEntry?.account?.name) categoryName = toEntry.account.name;
            }
        }

        return {
            ...txn,
            account: { ...(txn.account || {}), name: accountName },
            category: { ...(txn.category || {}), name: categoryName }
        };
    }

    static async getGroupedExportData(
        orgId: number,
        branchId: number | number[] | 'all' | null,
        financialYearId: number,
        targetCurrency?: string,
        user?: any,
        filters: TransactionExportFilters = {}
    ) {
        let transactions = await this.getAll(orgId, branchId, financialYearId, undefined, targetCurrency, user, undefined, filters.appliedFilters?.startDate ? { startDate: filters.appliedFilters.startDate, endDate: filters.appliedFilters.endDate } : undefined);
        
        if (filters.appliedFilters && filters.appliedFilters.activeIds && Array.isArray(filters.appliedFilters.activeIds)) {
            const allowedIds = new Set(filters.appliedFilters.activeIds.map(Number));
            transactions = transactions.filter(txn => allowedIds.has(txn.id));
        }

        const enrichedTransactions = transactions.map((txn: any) => this.enrichExportTransaction(txn));
        const grouped = new Map<string, GroupedExportTransaction>();

        transactions.forEach((txn: any) => {
            const date = txn.txnDate ? new Date(txn.txnDate).toISOString().split('T')[0] : '';
            const amount = Number(txn.amountBaseCurrency ?? txn.finalAmountLocal ?? txn.amountBase ?? 0);
            const amountKey = amount.toFixed(2);
            const party = (txn.contact || txn.payee || txn.counterpartyName || '').trim().toLowerCase();
            const type = (txn.transactionType?.name || txn.txnType || '').toLowerCase();
            const notes = (txn.notes || txn.description || '').trim().toLowerCase();
            const baseKey = `${date}|${amountKey}|${party}|${type}|${notes}`;
            const branchName = txn.branch?.name || 'Unknown';

            const existing = grouped.get(baseKey);
            if (existing) {
                if (!existing.branchNames.includes(branchName)) {
                    existing.branchNames.push(branchName);
                }
                return;
            }

            grouped.set(baseKey, {
                id: txn.id,
                name: txn.name || '',
                txnDate: txn.txnDate || null,
                txnType: type,
                status: txn.status ?? null,
                contact: txn.contact || txn.payee || txn.counterpartyName || '',
                accountName: txn.account?.name || '-',
                categoryName: txn.category?.name || '-',
                notes: txn.notes || txn.description || '',
                amount,
                branchNames: [branchName]
            });
        });

        return this.filterGroupedTransactions(Array.from(grouped.values()), filters);
    }

    private static getExportColumns(visibleColumns?: string[]) {
        const COLUMNS = [
            { key: 'id', header: 'Id', width: 10, extract: (txn: any, index: number) => index + 1 },
            { key: null, header: 'Name', width: 35, extract: (txn: any) => txn.name || '' },
            { key: 'date', header: 'Date', width: 15, extract: (txn: any) => this.formatExportDate(txn.txnDate) },
            { key: 'type', header: 'Type', width: 15, extract: (txn: any) => txn.txnType ? txn.txnType.charAt(0).toUpperCase() + txn.txnType.slice(1) : '' },
            { key: 'party', header: 'Payee', width: 35, extract: (txn: any) => txn.contact || '' },
            { key: 'account', header: 'Account', width: 30, extract: (txn: any) => txn.accountName || '' },
            { key: 'category', header: 'Category', width: 30, extract: (txn: any) => txn.categoryName || '' },
            { key: 'notes', header: 'Notes', width: 50, extract: (txn: any) => txn.notes || '' },
            { key: 'amount', header: 'Amount', width: 15, htmlAlign: 'right', extract: (txn: any) => Number(txn.amount || 0).toFixed(2), extractValue: (txn: any, index?: number) => Number(txn.amount || 0) },
            { key: 'branch', header: 'Branches', width: 70, extract: (txn: any) => Array.isArray(txn.branchNames) ? txn.branchNames.join(', ') : (txn.branchNames || ''), extractHtml: (txn: any, index?: number) => Array.isArray(txn.branchNames) ? txn.branchNames.join('<br />') : (txn.branchNames || '') },
            { key: 'createdBy', header: 'Created By', width: 25, extract: (txn: any) => txn.createdByName || txn.createdByDisplayName || txn.creatorName || '' }
        ];

        if (!visibleColumns || visibleColumns.length === 0) {
            return COLUMNS.filter(c => c.key !== 'createdBy');
        }

        return COLUMNS.filter(c => c.key === null || visibleColumns.includes(c.key));
    }

    static buildExportCsv(groupedTransactions: GroupedExportTransaction[], visibleColumns?: string[]) {
        const columns = this.getExportColumns(visibleColumns);
        const headers = columns.map(c => c.header);
        const rows = groupedTransactions.map((txn, index) => columns.map(c => c.extract(txn, index)));

        return [
            headers.map((header) => this.escapeCsvValue(header)).join(','),
            ...rows.map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
        ].join('\n');
    }

    static buildExportExcel(groupedTransactions: GroupedExportTransaction[], visibleColumns?: string[]) {
        const columns = this.getExportColumns(visibleColumns);
        const headers = columns.map(c => c.header);
        const rows = groupedTransactions.map((txn, index) => {
            const rowData: any = {};
            columns.forEach(c => {
                rowData[c.header] = c.extractValue ? c.extractValue(txn, index) : c.extract(txn, index);
            });
            return rowData;
        });

        const worksheet = utils.json_to_sheet(rows, { header: headers });
        worksheet['!cols'] = columns.map(c => ({ wch: c.width }));

        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Transactions');
        
        return write(workbook, { type: 'buffer', bookType: 'xlsx' });
    }

    static buildPrintableHtml(groupedTransactions: GroupedExportTransaction[], visibleColumns?: string[]) {
        const columns = this.getExportColumns(visibleColumns);
        
        const rows = groupedTransactions.map((txn, index) => `
            <tr>
                ${columns.map(c => `<td${c.htmlAlign ? ` style="text-align:${c.htmlAlign};"` : ''}>${c.extractHtml ? c.extractHtml(txn, index) : c.extract(txn, index) ?? '-'}</td>`).join('\n                ')}
            </tr>
        `).join('');

        const headerHtml = columns.map(c => `<th>${c.header}</th>`).join('\n                            ');

        return `
            <!doctype html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Transactions</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
                    h1 { font-size: 20px; margin: 0 0 16px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; vertical-align: top; }
                    th { background: #f8fafc; text-align: left; font-weight: 700; }
                    tbody tr:nth-child(even) { background: #fcfcfd; }
                    @media print {
                        @page { size: auto; margin: 0; }
                        body { padding: 1.5cm; }
                        h1 { margin-bottom: 12px; }
                    }
                </style>
                <script>
                    window.addEventListener('load', () => {
                        setTimeout(() => {
                            window.print();
                        }, 250);
                    });
                </script>
            </head>
            <body>
                <h1>Transactions</h1>
                <table>
                    <thead>
                        <tr>
                            ${headerHtml}
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </body>
            </html>
        `;
    }

    static async importTransactions(buffer: Buffer, orgId: number, user: any, defaultFinancialYearId?: number, defaultBranchId?: number, autoGenerate: boolean = false) {
        const workbook = read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) return { success: false, message: 'Invalid Excel File' };

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return { success: false, message: 'Invalid Worksheet' };

        const rows: any[] = utils.sheet_to_json(sheet);
        if (rows.length > 0) {
        }

        if (rows.length === 0) {
            return { success: false, message: 'File is empty' };
        }

        const normalizedRows = rows.map(r => {
            const nr: any = {};
            for (const key of Object.keys(r)) {
                nr[key.toLowerCase().replace(/\s+/g, '').replace(/_/g, '')] = r[key];
            }
            return nr;
        });

        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        if (!org || !isActiveStatus(org.status)) throw new Error('Organization is inactive or not found');

        const allBranches = await db.query.branches.findMany({
            where: and(eq(branches.orgId, orgId), isNotDeleted(branches))
        });
        const branchMap = new Map(allBranches.map(b => [b.id, b]));

        // Caches for lookups
        let allCategories = await db.query.categories.findMany({
            where: and(eq(categories.orgId, orgId), isNotDeleted(categories))
        });
        let categoryMap = new Map(allCategories.map(c => [c.id, c]));
        let categoryNameMap = new Map(allCategories.map(c => [c.name.toLowerCase(), c]));

        let allAccounts = await db.query.accounts.findMany({
            where: and(eq(accounts.orgId, orgId), isNotDeleted(accounts))
        });
        let accountMap = new Map(allAccounts.map(a => [a.id, a]));
        let accountNameMap = new Map(allAccounts.map(a => [a.name.toLowerCase(), a]));

        const allTxnTypes = await db.select().from(transactionTypes);
        const typeMap = new Map(allTxnTypes.map(t => [t.name.toLowerCase(), t.id]));

        // Missing Items Tracking
        const missingCategories = new Map<string, { name: string, branchId: number, typeName: string }>();
        const missingAccounts = new Map<string, { name: string, branchId: number, accountType: string }>();

        // Phase 1: Scan for missing items
        for (const row of normalizedRows) {
            const branchId = row.branchid || row.branch_id || defaultBranchId;
            if (!branchId) continue;

            let typeName = row.type || row.txntype || row['type(income/expense/investment)'] || row['type(income/expense/transfer)'];
            if (!typeName) {
                const rowAmt = row.amount || row.amountlocal || row.deposit || row.withdrawal || 0;
                typeName = (Number(rowAmt) < 0 || row.withdrawal) ? 'Expense' : 'Income';
            }
            const normalizedTypeName = String(typeName).trim().toLowerCase();

            const catName = row.category;
            if (catName && !categoryNameMap.has(String(catName).trim().toLowerCase())) {
                missingCategories.set(String(catName).trim().toLowerCase(), {
                    name: String(catName).trim(),
                    branchId,
                    typeName: normalizedTypeName
                });
            }

            const accName = row.account;
            const accType = row.accounttype || row.account_type || 'other';
            if (accName && !accountNameMap.has(String(accName).trim().toLowerCase())) {
                missingAccounts.set(String(accName).trim().toLowerCase(), {
                    name: String(accName).trim(),
                    branchId,
                    accountType: String(accType).trim().toLowerCase()
                });
            }
        }

        // Check if we can proceed
        if (!autoGenerate && (missingCategories.size > 0 || missingAccounts.size > 0)) {
            return {
                success: false,
                message: 'Missing entities detected',
                missingData: {
                    categories: Array.from(missingCategories.values()),
                    accounts: Array.from(missingAccounts.values()),
                    subCategories: []
                }
            };
        }

        // Phase 2: Auto-generate items
        if (autoGenerate) {
            await db.transaction(async (tx) => {
                for (const cat of missingCategories.values()) {
                    const tid = typeMap.get(cat.typeName) || typeMap.get('expense')!;
                    await tx.insert(categories).values({
                        name: cat.name,
                        orgId: orgId as number,
                        txnTypeId: tid,
                        status: 1
                    } as any);
                }
                for (const acc of missingAccounts.values()) {
                    const at = acc.accountType;
                    let mat = 1;
                    if (at.includes('liability') || at.includes('credit')) mat = 2;
                    else if (at.includes('equity')) mat = 3;
                    else if (at.includes('income')) mat = 4;
                    else if (at.includes('expense')) mat = 5;

                    await tx.insert(accounts).values({
                        name: acc.name,
                        orgId: orgId as number,
                        accountType: mat,
                        openingBalance: '0',
                        openingBalanceDate: new Date().toISOString().split('T')[0],
                        status: 1
                    } as any);
                }
            });
            // Refresh caches
            allCategories = await db.query.categories.findMany({
                where: and(eq(categories.orgId, orgId), isNotDeleted(categories))
            });
            categoryNameMap = new Map(allCategories.map(c => [c.name.toLowerCase(), c]));
            categoryMap = new Map(allCategories.map(c => [c.id, c]));
            allAccounts = await db.query.accounts.findMany({
                where: and(eq(accounts.orgId, orgId), isNotDeleted(accounts))
            });
            accountNameMap = new Map(allAccounts.map(a => [a.name.toLowerCase(), a]));
            accountMap = new Map(allAccounts.map(a => [a.id, a]));
        }

        const errors: ImportError[] = [];
        const validTransactions: any[] = [];

        const resolveCategoryId = (idCandidate: any, valueCandidate: any) => {
            const normalizedId = Number(idCandidate);
            if (Number.isFinite(normalizedId) && normalizedId > 0) {
                return normalizedId;
            }

            if (valueCandidate === undefined || valueCandidate === null || valueCandidate === '') return null;
            const matched = categoryNameMap.get(String(valueCandidate).trim().toLowerCase());
            return matched?.id || null;
        };

        const resolveAccountId = (idCandidate: any, valueCandidate: any) => {
            const normalizedId = Number(idCandidate ?? valueCandidate);
            if (Number.isFinite(normalizedId) && normalizedId > 0) {
                return normalizedId;
            }

            if (valueCandidate === undefined || valueCandidate === null || valueCandidate === '') return null;
            const matched = accountNameMap.get(String(valueCandidate).trim().toLowerCase());
            return matched?.id || null;
        };

        for (let i = 0; i < normalizedRows.length; i++) {
            const row = normalizedRows[i];
            const rowNum = i + 2;
            const rowErrors: string[] = [];

            let branchId = row.branchid || row.branch_id || defaultBranchId;
            const branch = branchMap.get(branchId);
            if (!branch) rowErrors.push(`Branch ${branchId} not found`);

            let dateStr = row.date || row.txndate || row.transactiondate || row['date(yyyy-mm-ddormm/dd/yyyy)'];
            if (!dateStr) {
                // Look for any key containing 'date'
                const dateKey = Object.keys(row).find(k => k.includes('date'));
                if (dateKey) dateStr = row[dateKey];
            }

            let txnDate: string | null = null;
            if (dateStr) {
                if (typeof dateStr === 'number') {
                    const d = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    txnDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
                } else {
                    // Try parsing DD/MM/YYYY or MM/DD/YYYY if standard fail
                    let d = new Date(dateStr);
                    if (isNaN(d.getTime()) && typeof dateStr === 'string' && dateStr.includes('/')) {
                        const parts = dateStr.split('/');
                        if (parts.length === 3) {
                            const p0 = parts[0];
                            const p1 = parts[1];
                            const p2 = parts[2];
                            if (p0 && p1 && p2) {
                                // Try YYYY-MM-DD construction
                                const iso = p2.length === 4 ? `${p2}-${p1}-${p0}` : `${p2}-${p0}-${p1}`;
                                d = new Date(iso);
                            }
                        }
                    }
                    if (!isNaN(d.getTime())) {
                        txnDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    }
                }
            }
            if (!txnDate) rowErrors.push('Invalid date');

            const amount = row.amount || row.amountlocal || row.deposit || row.withdrawal;
            if (amount === undefined || isNaN(Number(amount))) rowErrors.push('Invalid amount');

            let typeVal = row.type || row.txntype || row['type(income/expense/investment)'] || row['type(income/expense/transfer)'];
            if (!typeVal) typeVal = (Number(amount) < 0 || row.withdrawal) ? 'Expense' : 'Income';
            const tid = typeMap.get(String(typeVal).trim().toLowerCase());
            if (!tid) rowErrors.push(`Invalid type: ${typeVal}`);

            const catId = resolveCategoryId(
                row.categoryid,
                row.category ?? row.Category
            );

            const accId = resolveAccountId(
                row.accountid,
                row.account ?? row.Account
            );

            const rawFromAccountValue = row.fromaccount ?? row.fromaccountname ?? row.fromaccountid;
            const rawToAccountValue = row.toaccount ?? row.toaccountname ?? row.toaccountid;
            const explicitFromAccountId = resolveAccountId(row.fromaccountid, rawFromAccountValue);
            const explicitToAccountId = resolveAccountId(row.toaccountid, rawToAccountValue);

            // Extra validation before insertion
            const normalizedType = tid ? Array.from(typeMap.entries()).find(([k, v]) => v === tid)?.[0] : null;
            const effectiveFromAccountId = normalizedType === 'transfer' ? (explicitFromAccountId || accId) : null;
            const effectiveToAccountId = normalizedType === 'transfer' ? (explicitToAccountId || catId) : null;

            if (normalizedType === 'transfer') {
                if (!effectiveFromAccountId) {
                    rowErrors.push('From Account is required for transfer (use Account or FromAccountId)');
                } else if (!accountMap.get(Number(effectiveFromAccountId))) {
                    rowErrors.push(`From Account ID ${effectiveFromAccountId} not found`);
                }

                if (!effectiveToAccountId) {
                    rowErrors.push('To Account is required for transfer (use ToAccountId or Category)');
                } else if (!accountMap.get(Number(effectiveToAccountId))) {
                    rowErrors.push(`To Account ID ${effectiveToAccountId} not found`);
                }

                if (effectiveFromAccountId && effectiveToAccountId && Number(effectiveFromAccountId) === Number(effectiveToAccountId)) {
                    rowErrors.push('From and To accounts must be different for transfer');
                }
            } else {
                if (!accId) {
                    rowErrors.push('Missing account');
                } else if (!accountMap.get(Number(accId))) {
                    rowErrors.push(`Account ID ${accId} not found`);
                }

                if (catId && !categoryMap.get(Number(catId))) {
                    rowErrors.push(`Category ID ${catId} not found`);
                }

                if (!catId && (normalizedType === 'expense' || normalizedType === 'income')) {
                    rowErrors.push(`Category is required for ${normalizedType} transactions`);
                }
            }

            if (rowErrors.length > 0) {
                errors.push({ row: rowNum, message: rowErrors.join(', ') });
            } else {
                let party = row.party || row.payee || row.counterpartyname || row.counterparty;
                if (!party) party = row.name || row.description;

                validTransactions.push({
                    _rowNum: rowNum,
                    orgId,
                    branchId,
                    financialYearId: defaultFinancialYearId || 0, // Fallback handled by create if needed
                    name: row.name || row.description || party || 'Imported Transaction',
                    txnDate,
                    txnTypeId: tid,
                    categoryId: catId || null,
                    accountId: accId,
                    fromAccountId: effectiveFromAccountId,
                    toAccountId: effectiveToAccountId,
                    contact: party || null,
                    notes: (row.notes || row.description || '').trim(),
                    amountLocal: Math.abs(Number(amount)),
                    isTaxable: row.is_taxable === 1 || row.is_taxable === true || row.isTaxable === 1 || row.isTaxable === true,
                    isGstInclusive: row.is_gst_inclusive === 1 || row.is_gst_inclusive === true || row.isGstInclusive === 1 || row.isGstInclusive === true,
                    gstType: row.gst_type || row.gstType || 1,
                    gstRate: row.gst_rate || row.gstRate || 0,
                    currencyCode: row.currency || row.currencycode || (branch ? branch.currencyCode : 'USD'),
                    fxRate: Number(row.fxrate || 1),
                    status: 1,
                    createdBy: user.id
                });
            }
        }

        if (errors.length > 0) {
            return {
                success: false,
                totalRows: rows.length,
                insertedRows: 0,
                errors,
                message: 'No transactions were imported. Please review the row errors below.'
            };
        }

        let successCount = 0;
        for (const txn of validTransactions) {
            const originalRowNum = txn._rowNum;
            delete txn._rowNum;
            try {
                // Transfer mapping
                if (txn.txnTypeId === 4) {
                    if (!txn.toAccountId) txn.toAccountId = txn.categoryId;
                    if (!txn.fromAccountId) txn.fromAccountId = txn.accountId;
                    txn.categoryId = null;
                }
                const fy = await db.query.financialYears.findFirst({
                    where: and(
                        eq(financialYears.orgId, orgId),
                        lte(financialYears.startDate, txn.txnDate as any),
                        gte(financialYears.endDate, txn.txnDate as any)
                    )
                });

                if (!fy) {
                    errors.push({ row: originalRowNum, message: `Transaction date ${txn.txnDate} does not fall within any defined financial year` });
                    continue;
                }

                await TransactionService.create(txn);
                successCount++;
            } catch (e: any) {
                console.error(`[IMPORT ROW ${originalRowNum} FAILED]`, e.message);
                errors.push({ row: originalRowNum, message: `Insertion failed: ${e.message}` });
            }
        }



        const partialSuccess = successCount > 0 && errors.length > 0;
        if (successCount === 0) {
            return {
                success: false,
                totalRows: rows.length,
                insertedRows: 0,
                errors,
                message: 'No transactions were imported. Please review the row errors below.'
            };
        }

        return {
            success: true,
            partialSuccess,
            totalRows: rows.length,
            insertedRows: successCount,
            errors,
            message: partialSuccess
                ? `Imported ${successCount} of ${rows.length} transactions. Some rows failed.`
                : 'Transactions imported successfully.'
        };
    }

    /**
     * Import transactions from PDF bank statement
     */
    static async importFromPDF(
        buffer: Buffer,
        orgId: number,
        user: any,
        accountId: number,
        branchId: number,
        financialYearId?: number
    ) {
        try {
            // Parse PDF and extract transactions
            const parsedTransactions = await PDFParserService.parseStatement(buffer);

            if (parsedTransactions.length === 0) {
                return {
                    success: false,
                    message: 'No transactions found in the PDF statement'
                };
            }

            // Convert to import format
            const formattedTransactions = PDFParserService.convertToTransactionFormat(
                parsedTransactions,
                accountId,
                branchId
            );

            // Convert to Excel-like structure and use existing import logic
            const rows = formattedTransactions.map(txn => ({
                ...txn,
                date: txn.date,
                Date: txn.Date,
                type: txn.type,
                Type: txn.Type,
                amount: txn.amount,
                Amount: txn.Amount,
                account_id: txn.account_id,
                accountId: txn.accountId,
                branch_id: txn.branch_id,
                branchId: txn.branchId,
                status: txn.status,
                Status: txn.Status
            }));

            // Reuse the existing validation and insertion logic
            // Transform rows array to match Excel import format
            const mockWorkbook = { SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } };

            // Process using similar logic to Excel import
            return await this.processImportedRows(
                rows,
                orgId,
                user,
                financialYearId,
                branchId
            );

        } catch (error: any) {
            console.error('PDF Import Error:', error);
            return {
                success: false,
                message: error.message || 'Failed to import from PDF'
            };
        }
    }

    /**
     * Common processing logic for imported rows (used by both Excel and PDF imports)
     */
    static async processImportedRows(
        rows: any[],
        orgId: number,
        user: any,
        defaultFinancialYearId?: number,
        defaultBranchId?: number,
        filename?: string
    ) {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        if (!org || !isActiveStatus(org.status)) throw new Error('Organization is inactive or not found');

        const allBranches = await db.query.branches.findMany({
            where: and(eq(branches.orgId, orgId), isNotDeleted(branches))
        });
        const branchMap = new Map(allBranches.map(b => [b.id, b]));

        let allAccounts = await db.query.accounts.findMany({
            where: and(eq(accounts.orgId, orgId), isNotDeleted(accounts))
        });
        let accountMap = new Map(allAccounts.map(a => [a.id, a]));
        let accountNameMap = new Map(allAccounts.map(a => [a.name.toLowerCase(), a]));

        let allCategories = await db.query.categories.findMany({
            where: and(eq(categories.orgId, orgId), isNotDeleted(categories))
        });
        let categoryMap = new Map(allCategories.map(c => [c.id, c]));
        let categoryNameMap = new Map(allCategories.map(c => [c.name.toLowerCase(), c]));

        const allTxnTypes = await db.select().from(transactionTypes);
        const typeMap = new Map(allTxnTypes.map(t => [t.name.toLowerCase(), t.id]));

        const errors: ImportError[] = [];
        const validTransactions: any[] = [];

        // Iterate and Validate
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;
            const rowErrors: string[] = [];

            // 1. Validate Branch
            let branchId = row.branch_id || row.branchId || defaultBranchId;
            if (!branchId) {
                rowErrors.push('Missing branch_id');
            } else {
                branchId = Number(branchId);
                const branch = branchMap.get(branchId);
                if (!branch) {
                    rowErrors.push(`Branch ID ${branchId} not found`);
                } else if (!isActiveStatus(branch.status)) {
                    rowErrors.push(`Branch ${branch.name} is inactive`);
                } else {
                    const userBranchIds = typeof user.branchIds === 'string'
                        ? user.branchIds.split(',').filter(Boolean).map(Number)
                        : (Array.isArray(user.branchIds) ? user.branchIds : []);
                    if (user.role === 'member' && !userBranchIds.includes(branchId)) {
                        rowErrors.push(`User does not have access to Branch ID ${branchId}`);
                    }
                }
            }

            // 2. Validate Date
            const dateStr = row.date || row.Date || row.txnDate || row.txn_date || row['Transaction Date'] || row['transaction date'];
            let txnDate: string | null = null;
            if (!dateStr) {
                rowErrors.push('Missing date');
            } else {
                if (typeof dateStr === 'number') {
                    const dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    txnDate = dateObj.toISOString().split('T')[0] || null;
                } else {
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) {
                        rowErrors.push(`Invalid date format: ${dateStr}`);
                    } else {
                        txnDate = d.toISOString().split('T')[0] || null;
                    }
                }
            }

            // 3. Validate Amount
            const amount = row.amount || row.Amount || row.amountLocal || row.amount_local;
            if (amount === undefined || amount === null || amount === '') {
                rowErrors.push('Missing amount');
            } else if (isNaN(Number(amount))) {
                rowErrors.push(`Invalid amount: ${amount}`);
            }

            // 4. Validate Type
            const typeVal = row.type || row.Type || row.txnType || row.txn_type;
            let txnTypeId: number | undefined;
            if (!typeVal) {
                rowErrors.push('Missing type');
            } else {
                const normalized = String(typeVal).toLowerCase();
                txnTypeId = typeMap.get(normalized);
                if (!txnTypeId) {
                    rowErrors.push(`Invalid transaction type: ${typeVal} (Allowed: Income, Expense, Investment)`);
                }
            }

            // 5. Validate Account
            let accId = row.account_id || row.accountId;
            if (!accId) {
                const accName = row.account || row.Account;
                if (accName) {
                    const matched = accountNameMap.get(String(accName).toLowerCase());
                    if (matched) accId = matched.id;
                }
            }

            if (!accId) {
                rowErrors.push('Missing account (ID or Name)');
            } else {
                accId = Number(accId);
                const account = accountMap.get(accId);
                if (!account) {
                    rowErrors.push(`Account ID ${accId} not found`);
                }
            }

            // 6. Extract Category and Contact
            let categoryId = row.category_id || row.categoryId || null;
            if (categoryId) {
                categoryId = Number(categoryId);
                if (!categoryMap.has(categoryId)) {
                    categoryId = null; // Fallback to auto-create if ID is invalid
                }
            } 
            
            if (!categoryId) {
                const normalizedType = typeVal ? String(typeVal).toLowerCase() : '';
                const isExpense = normalizedType === 'expense' || txnTypeId === 2;
                const isIncome = normalizedType === 'income' || txnTypeId === 1;
                
                if (isExpense || isIncome) {
                    const defaultCatName = isExpense ? 'Uncategorized Expense' : 'Uncategorized Income';
                    let matchedCat = categoryNameMap.get(defaultCatName.toLowerCase());
                    
                    if (matchedCat) {
                        categoryId = matchedCat.id;
                    } else {
                        const tid = typeMap.get(isExpense ? 'expense' : 'income');
                        const [newCat] = await db.insert(categories).values({
                            name: defaultCatName,
                            orgId: orgId as number,
                            txnTypeId: tid,
                            status: 1
                        } as any).$returningId();
                        
                        categoryId = newCat?.id || 0;
                        categoryMap.set(categoryId, { id: categoryId, name: defaultCatName } as any);
                        categoryNameMap.set(defaultCatName.toLowerCase(), { id: categoryId, name: defaultCatName } as any);
                    }
                }
            }
            
            let contactId = row.contact_id || row.contactId || null;
            if (contactId) contactId = Number(contactId);

            const normalizedType = typeVal ? String(typeVal).toLowerCase() : '';
            const isTransfer = normalizedType === 'transfer' || txnTypeId === 4;

            let fromAccountId = null;
            let toAccountId = null;

            if (isTransfer) {
                fromAccountId = accId;
                toAccountId = categoryId; // For transfers, category dropdown acts as the other account
                if (!fromAccountId || !toAccountId) {
                    rowErrors.push('Transfer requires both accounts');
                } else if (fromAccountId === toAccountId) {
                    rowErrors.push('Source and Destination accounts must be different');
                }
            }

            if (rowErrors.length > 0) {
                errors.push({ row: rowNum, message: rowErrors.join(', ') });
            } else {
                console.log('DEBUG_IMPORT_TXN', {
                    rowCatId: row.category_id,
                    rowContId: row.contact_id,
                    parsedCatId: categoryId,
                    parsedContId: contactId,
                    finalName: row.name || row.Name || row.description || row.Description || row.notes || row.Notes || 'Imported Transaction',
                });
                validTransactions.push({
                    orgId,
                    branchId,
                    txnDate,
                    txnTypeId: txnTypeId!,
                    categoryId: isTransfer ? null : categoryId,
                    subCategoryId: null,
                    accountId: accId,
                    fromAccountId,
                    toAccountId,
                    contactId: contactId || null,
                    contact: row.contact || row.Contact || row.payee || row.Payee || null,
                    name: row.name || row.Name || row.description || row.Description || row.notes || row.Notes || 'Imported Transaction',
                    payee: row.payee || row.Payee || row.counterparty_name || row.counterpartyName || row.Counterparty || null,
                    notes: row.notes || row.Notes || row.description || row.Description || '',
                    amountLocal: amount,
                    isTaxable: row.is_taxable === 1 || row.is_taxable === true || row.isTaxable === 1 || row.isTaxable === true,
                    isGstInclusive: row.is_gst_inclusive === 1 || row.is_gst_inclusive === true || row.isGstInclusive === 1 || row.isGstInclusive === true,
                    gstType: row.gst_type || row.gstType || 1,
                    gstRate: row.gst_rate || row.gstRate || 0,
                    currencyCode: row.currency || row.currencyCode || branchMap.get(branchId)!.currencyCode,
                    fxRate: row.fx_rate || row.fxRate || 1,
                    status: 1, // Posted
                    createdBy: user.id
                });
            }
        }

        if (errors.length > 0) {
            return {
                success: false,
                totalRows: rows.length,
                insertedRows: 0,
                errors
            };
        }

        // --- DUPLICATE CHECKING ---
        let skippedRows = 0;
        let newValidTransactions = validTransactions;

        if (validTransactions.length > 0) {
            const dates = validTransactions.map(t => new Date(t.txnDate).getTime());
            const minDateObj = new Date(Math.min(...dates));
            const maxDateObj = new Date(Math.max(...dates));
            const minDate = minDateObj.toISOString().split('T')[0];
            const maxDate = maxDateObj.toISOString().split('T')[0];

            const generateHash = (txnDate: string, amount: string | number, notes: string) => {
                const cleanNotes = (notes || '').toLowerCase().replace(/\s+/g, '').trim();
                const cleanAmount = Number(amount).toFixed(2);
                return `${txnDate}_${cleanAmount}_${cleanNotes}`;
            };

            const existingTxns = await db.select({
                txnDate: transactions.txnDate,
                amountLocal: transactions.amountLocal,
                notes: transactions.notes,
            }).from(transactions).where(and(
                eq(transactions.orgId, orgId),
                gte(transactions.txnDate, minDate as any),
                lte(transactions.txnDate, maxDate as any),
                isNotDeleted(transactions)
            ));

            const existingHashes = new Set(existingTxns.map(t => generateHash(t.txnDate as string, t.amountLocal, t.notes || '')));

            newValidTransactions = validTransactions.filter(txn => {
                const hash = generateHash(txn.txnDate, txn.amountLocal, txn.notes || '');
                return !existingHashes.has(hash);
            });
            
            skippedRows = validTransactions.length - newValidTransactions.length;
        }
        // --- END DUPLICATE CHECKING ---

        // Bulk Insert
        try {
            const fys = await db.query.financialYears.findMany({
                where: eq(financialYears.orgId, orgId)
            });

            let importedStatementId: number | undefined;
            if (filename && newValidTransactions.length > 0) {
                const fyToUse = defaultFinancialYearId || fys[0]?.id;
                const branchToUse = defaultBranchId || newValidTransactions[0]?.branchId;
                if (fyToUse && branchToUse) {
                    const stmtResult = await db.insert(importedStatements).values({
                        orgId,
                        branchId: branchToUse,
                        financialYearId: fyToUse,
                        filename,
                        importedBy: user.id,
                        transactionCount: newValidTransactions.length,
                        status: 1
                    });
                    importedStatementId = Number(stmtResult[0].insertId);
                }
            }

            const createdTxns = [];
            // Use serial execution for safety with shared resources/logic, 
            // though parallel Promise.all could be used if strict ordering isn't required.
            // Serial is safer for debugging and rate limits.
            for (const txn of newValidTransactions) {
                try {
                    const fy = fys.find(f => f.startDate <= txn.txnDate && f.endDate >= txn.txnDate);
                    if (!fy) continue;

                    const payload = {
                        ...txn,
                        // Ensure numeric fields are passed as numbers/strings as expected by create
                        amountLocal: txn.amountLocal,
                        fxRate: txn.fxRate,
                        txnTypeId: txn.txnTypeId,
                        importedStatementId,
                        // Pass account IDs mapping
                        // import logic mapped these to: categoryId, accountId, fromAccountId, toAccountId
                    };

                    const res = await TransactionService.create(payload);
                    createdTxns.push(res);
                } catch (e: any) {
                    console.error("Import Row Failed", e.message);
                }
            }

            // Broadcast


            return {
                success: true,
                totalRows: rows.length,
                insertedRows: createdTxns.length,
                skippedRows: skippedRows,
                errors: []
            };

        } catch (error: any) {
            console.error("Bulk Insert Failed", error);
            return {
                success: false,
                totalRows: rows.length,
                insertedRows: 0,
                errors: [{ row: 0, message: `Database Error: ${error.message}` }]
            };
        }
    }

    private static normalizeTransactionPayload(data: any): any {
        // Helper to clean inputs
        const normalizeString = (val: any) => (val && typeof val === 'string' && val.trim() !== '') ? val.trim() : null;
        const normalizeNumber = (val: any) => (val !== undefined && val !== null && !isNaN(Number(val))) ? Number(val) : null;

        const rawStatus = data.status !== undefined && data.status !== null ? String(data.status).toLowerCase() : 'draft';
        let status = 0;
        if (rawStatus === 'posted' || rawStatus === '1') status = 1;
        else if (rawStatus === 'draft' || rawStatus === '0') status = 0;
        else status = isNaN(Number(rawStatus)) ? 0 : Number(rawStatus);

        return {
            name: normalizeString(data.name) || 'Transaction',
            txnDate: data.txnDate,
            txnTypeId: normalizeNumber(data.txnTypeId),
            // We return 'any' so these fields can be used by create() even if not in 'transactions' schema
            categoryId: normalizeNumber(data.categoryId),
            subCategoryId: normalizeNumber(data.subCategoryId),
            accountId: normalizeNumber(data.accountId),
            fromAccountId: normalizeNumber(data.fromAccountId),
            toAccountId: normalizeNumber(data.toAccountId),
            contactId: normalizeNumber(data.contactId),
            contact: normalizeString(data.contact),
            notes: normalizeString(data.notes),
            currencyCode: data.currencyCode || 'USD',
            amountLocal: data.amountLocal,
            fxRate: data.fxRate || '1',
            attachmentPath: data.attachmentPath || null,
            status,
            importedStatementId: normalizeNumber(data.importedStatementId),
        };
    }

    private static async resolvePartyId(
        tx: any,
        orgId: number,
        branchId: number,
        contactId?: number | null,
        contactName?: string | null
    ): Promise<number | null> {
        if (contactId && Number(contactId) > 0) {
            const [partyById] = await tx.select({ id: parties.id })
                .from(parties)
                .where(and(
                    eq(parties.id, Number(contactId)),
                    eq(parties.orgId, orgId),
                    isNotDeleted(parties)
                ))
                .limit(1);
            if (partyById?.id) return partyById.id;
        }
        if (!contactName || !String(contactName).trim()) return null;

        const normalized = String(contactName).trim().toLowerCase();
        const [party] = await tx.select({ id: parties.id })
            .from(parties)
            .where(and(
                eq(parties.orgId, orgId),
                isNotDeleted(parties),
                sql`lower(${parties.name}) = ${normalized}`
            ))
            .limit(1);

        return party?.id || null;
    }

    private static getContactDisplay(txn: any, party: any) {
        // Prefer company name for linked parties; fall back to contact name only if needed.
        return party?.companyName || party?.name || txn?.name || null;
    }

    private static async ensureActiveAccount(
        tx: any,
        accountId: number | null | undefined,
        orgId: number,
        label: string
    ) {
        if (!accountId) return null;

        const [account] = await tx.select({
            id: accounts.id,
            status: accounts.status
        })
            .from(accounts)
            .where(and(
                eq(accounts.id, accountId),
                eq(accounts.orgId, orgId),
                isNotDeleted(accounts)
            ))
            .limit(1);

        if (!account) throw new Error(`${label} account not found`);
        if (!isActiveStatus(account.status)) throw new Error(`${label} account is inactive`);
        return account;
    }

    private static async ensureActiveCategory(
        tx: any,
        categoryId: number | null | undefined,
        orgId: number
    ) {
        if (!categoryId) return null;

        const [category] = await tx.select({
            id: categories.id,
            status: categories.status
        })
            .from(categories)
            .where(and(
                eq(categories.id, categoryId),
                eq(categories.orgId, orgId),
                isNotDeleted(categories)
            ))
            .limit(1);

        if (!category) throw new Error('Category not found');
        if (!isActiveStatus(category.status)) throw new Error('Category is inactive');
        return category;
    }

    private static async ensureActiveSubCategory(
        tx: any,
        subCategoryId: number | null | undefined,
        categoryId: number | null | undefined
    ) {
        if (!subCategoryId) return null;

        const [subCategory] = await tx.select({
            id: subCategories.id,
            status: subCategories.status,
            categoryId: subCategories.categoryId
        })
            .from(subCategories)
            .where(and(
                eq(subCategories.id, subCategoryId),
                isNotDeleted(subCategories)
            ))
            .limit(1);

        if (!subCategory) throw new Error('Subcategory not found');
        if (!isActiveStatus(subCategory.status)) throw new Error('Subcategory is inactive');
        if (categoryId && Number(subCategory.categoryId) !== Number(categoryId)) {
            throw new Error('Subcategory does not belong to the selected category');
        }

        return subCategory;
    }

    static async create(data: any) {
        return await db.transaction(async (tx) => {
            const [org] = await tx.select().from(organizations).where(eq(organizations.id, data.orgId!));
            if (!org) throw new Error('Organization not found');
            if (!isActiveStatus(org.status)) throw new Error('Cannot create transaction for an inactive organization');

            const branch = await tx.query.branches.findFirst({
                where: and(eq(branches.id, data.branchId), isNotDeleted(branches))
            });
            if (!branch) throw new Error('Branch not found');
            if (!isActiveStatus(branch.status)) throw new Error('Cannot create transaction for an inactive branch');

            const txnDate = data.txnDate;
            const fy = await tx.query.financialYears.findFirst({
                where: and(
                    eq(financialYears.orgId, data.orgId!),
                    lte(financialYears.startDate, txnDate as any),
                    gte(financialYears.endDate, txnDate as any)
                )
            });

            if (!fy) {
                throw new Error(`Transaction date (${txnDate}) does not fall within any defined Financial Year.`);
            }

            let fxRate = Number(data.fxRate || 1);
            const branchCurrency = String(branch.currencyCode || '').toUpperCase();
            const transactionCurrency = String(data.currencyCode || branch.currencyCode || '').toUpperCase();

            if (transactionCurrency === branchCurrency) {
                fxRate = 1;
            } else if (fxRate === 1) {
                const fetchedRate = await ExchangeRateService.getRate(data.currencyCode, branchCurrency, data.orgId);
                if (fetchedRate !== 1) {
                    fxRate = fetchedRate;
                }
            }

            const rawBase = Number(data.amountLocal) * fxRate;
            const amountBase = (Math.round((rawBase + Number.EPSILON) * 100) / 100).toString();
            const totalAmount = data.amountLocal;

            // Validate txnTypeId
            if (!data.txnTypeId) throw new Error('Transaction Type ID is required');
            const txnType = await tx.query.transactionTypes.findFirst({ where: eq(transactionTypes.id, data.txnTypeId) });
            if (!txnType) throw new Error('Invalid Transaction Type ID');

            const typeName = txnType.name.toLowerCase();

            if (data.categoryId) {
                await this.ensureActiveCategory(tx, Number(data.categoryId), data.orgId);
            }
            if (data.subCategoryId) {
                await this.ensureActiveSubCategory(tx, Number(data.subCategoryId), Number(data.categoryId || 0) || null);
            }
            if (data.accountId) {
                await this.ensureActiveAccount(tx, Number(data.accountId), data.orgId, 'Selected');
            }
            if (data.fromAccountId) {
                await this.ensureActiveAccount(tx, Number(data.fromAccountId), data.orgId, 'Source');
            }
            if (data.toAccountId) {
                await this.ensureActiveAccount(tx, Number(data.toAccountId), data.orgId, 'Destination');
            }

            // Prepare Header Payload
            const resolvedContactId = await this.resolvePartyId(
                tx,
                data.orgId,
                data.branchId,
                data.contactId,
                data.contact
            );

            const isTaxableFlag =
                data.isTaxable === true ||
                data.isTaxable === 1 ||
                data.isTaxable === 'true';
            const normalizedName = typeof data.name === 'string' ? data.name.trim() : '';
            const resolvedName = typeName === 'transfer'
                ? normalizedName
                : (normalizedName || 'Transaction');

            const headerPayload: any = {
                orgId: data.orgId,
                branchId: data.branchId,
                financialYearId: fy.id,
                name: resolvedName,
                txnDate: data.txnDate,
                txnTypeId: data.txnTypeId,
                contactId: resolvedContactId,
                categoryId: data.categoryId || null,
                subCategoryId: data.subCategoryId || null,
                notes: data.notes || '',
                amountLocal: totalAmount,
                amountBase: amountBase,
                fxRate: fxRate.toString(),
                attachmentPath: data.attachmentPath || null,
                status: data.status !== undefined ? data.status : 1, // Default to Posted
                createdBy: data.createdBy,
                // GST fields
                isTaxable: isTaxableFlag ? 1 : 0,
                gstType: isTaxableFlag ? (data.gstType || null) : null,
                gstRate: isTaxableFlag ? (data.gstRate != null ? data.gstRate.toString() : null) : null,
                cgstAmount: isTaxableFlag ? (data.cgstAmount != null ? data.cgstAmount.toString() : null) : null,
                sgstAmount: isTaxableFlag ? (data.sgstAmount != null ? data.sgstAmount.toString() : null) : null,
                igstAmount: isTaxableFlag ? (data.igstAmount != null ? data.igstAmount.toString() : null) : null,
                gstTotal: isTaxableFlag ? (data.gstTotal != null ? data.gstTotal.toString() : null) : null,
                finalAmount: isTaxableFlag
                    ? (data.finalAmount != null ? data.finalAmount.toString() : amountBase)
                    : amountBase,
            };

            // Resolve Currency ID
            const resolvedCurrency = await CurrencyMasterService.ensureCurrencyExists(data.currencyCode || 'USD', tx);
            headerPayload.currencyId = resolvedCurrency.id;

            // Insert Header
            const [headerRes] = await tx.insert(transactions).values(headerPayload).$returningId();
            if (!headerRes) throw new Error('Failed to create transaction header');
            const transactionId = headerRes.id;

            // Prepare Entries based on Type
            const entries: any[] = [];
            const amount = isTaxableFlag && data.finalAmount != null ? Number(data.finalAmount) : Number(totalAmount);

            if (typeName === 'expense' || data.txnTypeId === 2) {
                if (data.categoryId === null || data.categoryId === undefined || data.accountId === null || data.accountId === undefined) throw new Error('Expense requires Category (Expense Account) and Paid From Account');

                entries.push({
                    transactionId,
                    accountId: data.categoryId, // Expense
                    debit: amount.toFixed(2),
                    credit: (0).toFixed(2),
                    description: 'Expense'
                });

                entries.push({
                    transactionId,
                    accountId: data.accountId, // Asset (Paid From)
                    debit: (0).toFixed(2),
                    credit: amount.toFixed(2),
                    description: 'Paid From'
                });

            } else if (typeName === 'income' || data.txnTypeId === 1) {
                if (data.categoryId === null || data.categoryId === undefined || data.accountId === null || data.accountId === undefined) throw new Error('Income requires Category (Income Account) and Deposit To Account');

                entries.push({
                    transactionId,
                    accountId: data.accountId, // Asset (Deposit To)
                    debit: amount.toFixed(2),
                    credit: (0).toFixed(2),
                    description: 'Deposit To'
                });

                entries.push({
                    transactionId,
                    accountId: data.categoryId, // Income
                    debit: (0).toFixed(2),
                    credit: amount.toFixed(2),
                    description: 'Income Source'
                });

            } else if (typeName === 'transfer' || data.txnTypeId === 4) {
                // Logic for transfer might come as fromAccountId/toAccountId fields
                // If frontend sends 'categoryId' as null, checks other fields
                const fromId = data.fromAccountId || data.accountId; // Frontend might send 'from' as 'accountId'
                const toId = data.toAccountId || data.categoryId; // Unlikely, but 'categoryId' might be reused for 'to' in some generic forms

                // Better to rely on explicit fromAccountId/toAccountId if possible, or mapping
                // Based on previous import logic: 
                // Transfer: fromAccountId -> fromAccountId, toAccountId -> toAccountId.

                if (data.fromAccountId === null || data.fromAccountId === undefined || data.toAccountId === null || data.toAccountId === undefined) throw new Error('Transfer requires From Account and To Account');
                if (data.fromAccountId === data.toAccountId) throw new Error('Cannot transfer to the same account');

                entries.push({
                    transactionId,
                    accountId: data.toAccountId,
                    debit: amount.toFixed(2),
                    credit: (0).toFixed(2),
                    description: 'Transfer In'
                });

                entries.push({
                    transactionId,
                    accountId: data.fromAccountId,
                    debit: (0).toFixed(2),
                    credit: amount.toFixed(2),
                    description: 'Transfer Out'
                });
            } else if (typeName === 'investment' || data.txnTypeId === 3) {
                if (data.toAccountId === null || data.toAccountId === undefined || data.accountId === null || data.accountId === undefined) throw new Error('Investment requires Investment Account and Paid From Account');
                if (data.toAccountId === data.accountId) throw new Error('Investment Account and Paid From Account cannot be the same account');

                entries.push({
                    transactionId,
                    accountId: data.toAccountId, // Investment Account (Asset)
                    debit: amount.toFixed(2),
                    credit: (0).toFixed(2),
                    description: 'Investment'
                });

                entries.push({
                    transactionId,
                    accountId: data.accountId, // Asset (Paid From)
                    debit: (0).toFixed(2),
                    credit: amount.toFixed(2),
                    description: 'Paid From'
                });
            } else {
                // For 'General Journal' or others, specific handling needed.
                // Assuming strict 3 types for now as per requirements.
                // If unknown, logs warning but proceeds? No, strict.
                // throw new Error(`Unsupported Transaction Type: ${typeName}`);
            }

            if (entries.length > 0) {
                await tx.insert(transactionEntries).values(entries);
            }

            await AuditService.log(
                data.orgId!,
                'transaction',
                transactionId,
                'create',
                data.createdBy,
                null,
                { header: headerPayload, entries }
            );

            const [createdTransaction] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
            return {
                ...createdTransaction,
                contact: data.contact || null
            };
        });
    }

    static async getAll(orgId: number, branchId: number | number[] | 'all' | null, financialYearId: number, limit?: number, targetCurrency?: string, user?: any, accountId?: number, dateRange?: { startDate?: string; endDate?: string }) {
        const filters = [
            eq(transactions.orgId, orgId),
            isNotDeleted(transactions)
        ];

        if (dateRange?.startDate) {
            filters.push(gte(transactions.txnDate, dateRange.startDate as any));
            if (dateRange.endDate) {
                filters.push(lte(transactions.txnDate, dateRange.endDate as any));
            }
        } else {
            filters.push(eq(transactions.financialYearId, financialYearId));
        }

        if (Array.isArray(branchId)) {
            filters.push(inArray(transactions.branchId, branchId.length ? branchId : [-1]));
        } else if (branchId !== 'all' && branchId !== null) {
            filters.push(eq(transactions.branchId, branchId));
        }

        if (accountId) {
             const matchingTxnsQuery = db.select({ id: transactionEntries.transactionId })
                 .from(transactionEntries)
                 .where(eq(transactionEntries.accountId, accountId));
                 
             filters.push(inArray(transactions.id, matchingTxnsQuery));
        }

        const orgPromise = db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

        const limitClause = limit === -1 ? undefined : (limit ? limit : (accountId ? undefined : 50));

        let txnsQuery = db.select({
            transaction: transactions,
            transactionType: transactionTypes,
            category: categories,
            subCategory: subCategories,
            branch: branches,
            currency: currencies,
            creator: {
                id: users.id,
                fullName: users.fullName,
                email: users.email
            },
            latestUpdaterName: sql<string | null>`(
                SELECT COALESCE(u.full_name, u.email)
                FROM audit_logs a
                LEFT JOIN users u ON u.id = a.action_by
                WHERE a.org_id = ${orgId}
                  AND lower(a.entity) = 'transaction'
                  AND lower(a.action) = 'update'
                  AND a.entity_id = ${transactions.id}
                ORDER BY a.id DESC
                LIMIT 1
            )`,
            createdActionAt: sql<string | null>`(
                SELECT DATE_FORMAT(CONVERT_TZ(a.action_at, @@session.time_zone, '+00:00'), '%Y-%m-%dT%H:%i:%sZ')
                FROM audit_logs a
                WHERE a.org_id = ${orgId}
                  AND lower(a.entity) = 'transaction'
                  AND lower(a.action) = 'create'
                  AND a.entity_id = ${transactions.id}
                ORDER BY a.id ASC
                LIMIT 1
            )`,
            latestUpdateActionAt: sql<string | null>`(
                SELECT DATE_FORMAT(CONVERT_TZ(a.action_at, @@session.time_zone, '+00:00'), '%Y-%m-%dT%H:%i:%sZ')
                FROM audit_logs a
                WHERE a.org_id = ${orgId}
                  AND lower(a.entity) = 'transaction'
                  AND lower(a.action) = 'update'
                  AND a.entity_id = ${transactions.id}
                ORDER BY a.id DESC
                LIMIT 1
            )`,
            party: parties
        })
            .from(transactions)
            .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .leftJoin(subCategories, eq(transactions.subCategoryId, subCategories.id))
            .leftJoin(branches, eq(transactions.branchId, branches.id))
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .leftJoin(users, eq(transactions.createdBy, users.id))
            .leftJoin(parties, eq(transactions.contactId, parties.id))
            .where(and(...filters))
            .orderBy(desc(transactions.txnDate), desc(transactions.createdAt))
            .$dynamic();
            
        if (limitClause !== undefined) {
            txnsQuery = txnsQuery.limit(limitClause);
        }

        const txns = await txnsQuery;

        // Batch fetch entries
        const txnIds = txns.map(r => r.transaction.id);
        const allEntries = txnIds.length > 0
            ? await db.select({
                entry: transactionEntries,
                account: accounts
            })
                .from(transactionEntries)
                .leftJoin(accounts, eq(transactionEntries.accountId, accounts.id))
                .where(inArray(transactionEntries.transactionId, txnIds))
            : [];

        const entriesByTxnId = new Map<number, Array<any>>();
        for (const row of allEntries) {
            const list = entriesByTxnId.get(row.entry.transactionId) || [];
            list.push({ ...row.entry, account: row.account });
            entriesByTxnId.set(row.entry.transactionId, list);
        }
        // Map them together
        const results = txns.map(row => {
            const txn = row.transaction;
            const contactDisplay = this.getContactDisplay(txn, row.party);
            return {
                ...txn,
                contactId: txn.contactId,
                contact: contactDisplay,
                createdActionAt: row.createdActionAt || null,
                latestUpdateActionAt: row.latestUpdateActionAt || null,
                transactionType: row.transactionType,
                category: row.category,
                subCategory: row.subCategory,
                branch: row.branch,
                currency: row.currency,
                creator: row.creator,
                latestUpdaterName: row.latestUpdaterName || null,
                entries: entriesByTxnId.get(txn.id) || []
            };
        });

        const orgList = await orgPromise;
        const baseCurrency = targetCurrency || orgList[0]?.baseCurrency || 'USD';
        const requiredRates = new Set<string>();
        for (const txn of results) {
            const currencyCode = (txn as any).currency?.code || 'USD';
            if (currencyCode !== baseCurrency) {
                requiredRates.add(currencyCode);
            }
        }

        const ratesByCurrency = new Map<string, number>();
        await Promise.all(
            Array.from(requiredRates).map(async (fromCurrency) => {
                const rate = await ExchangeRateService.getRate(fromCurrency, baseCurrency, orgId);
                ratesByCurrency.set(fromCurrency, rate);
            })
        );

        const enriched = results.map((txn) => {
            const baseAmountToConvert = txn.isTaxable && txn.finalAmount != null ? Number(txn.finalAmount) : Number(txn.amountLocal || 0);
            const currencyCode = (txn as any).currency?.code || 'USD';
            const rate = currencyCode === baseCurrency ? 1 : (ratesByCurrency.get(currencyCode) ?? 1);
            const converted = baseAmountToConvert * rate;

            return {
                ...txn,
                totalAmount: undefined,
                txnType: (txn as any).transactionType?.name?.toLowerCase(),
                categoryName: (txn as any).category?.name || null,
                subCategoryName: (txn as any).subCategory?.name || null,
                currencyCode,
                baseCurrency,
                amountBaseCurrency: converted,
                finalAmountLocal: baseAmountToConvert,
                payee: txn.contact,
                counterpartyName: txn.contact,
                createdByName:
                    (txn as any).latestUpdaterName ||
                    (txn as any).creator?.fullName ||
                    (txn as any).creator?.email ||
                    'System'
            };
        });

        return enriched;
    }

    static async getById(id: number, orgId: number) {
        const [txnRow] = await db.select({
            transaction: transactions,
            transactionType: transactionTypes,
            category: categories,
            subCategory: subCategories,
            branch: branches,
            currency: currencies,
            creator: {
                id: users.id,
                fullName: users.fullName,
                email: users.email
            },
            party: parties
        })
            .from(transactions)
            .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .leftJoin(subCategories, eq(transactions.subCategoryId, subCategories.id))
            .leftJoin(branches, eq(transactions.branchId, branches.id))
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .leftJoin(users, eq(transactions.createdBy, users.id))
            .leftJoin(parties, eq(transactions.contactId, parties.id))
            .where(and(eq(transactions.id, id), eq(transactions.orgId, orgId), isNotDeleted(transactions)))
            .limit(1);

        if (!txnRow) return null;

        const entries = await db.select({
            entry: transactionEntries,
            account: accounts
        })
            .from(transactionEntries)
            .leftJoin(accounts, eq(transactionEntries.accountId, accounts.id))
            .where(eq(transactionEntries.transactionId, id));

        const contactDisplay = this.getContactDisplay(txnRow.transaction, txnRow.party);
        const txn = {
            ...txnRow.transaction,
            contact: contactDisplay,
            contactId: txnRow.transaction.contactId,
            transactionType: txnRow.transactionType,
            category: txnRow.category,
            subCategory: txnRow.subCategory,
            branch: txnRow.branch,
            currency: txnRow.currency,
            creator: txnRow.creator,
            entries: entries.map(e => ({ ...e.entry, account: e.account }))
        };

        let fromAccountId = null;
        let toAccountId = null;
        let accountId = null;

        const creditEntry = txn.entries.find(e => Number((e as any).credit) > 0);
        const debitEntry = txn.entries.find(e => Number((e as any).debit) > 0);

        if (txn.transactionType?.id === 4) {
            // Transfer
            if (creditEntry) fromAccountId = creditEntry.accountId;
            if (debitEntry) toAccountId = debitEntry.accountId;
        } else if (txn.transactionType?.id === 3 || txn.transactionType?.name?.toLowerCase() === 'investment') {
            // Investment
            if (creditEntry) fromAccountId = creditEntry.accountId;
            if (debitEntry) toAccountId = debitEntry.accountId;
        } else if (txn.transactionType?.id === 2 || txn.transactionType?.name?.toLowerCase() === 'expense') {
            // Expense: Paid From (Credit)
            if (creditEntry) accountId = creditEntry.accountId;
        } else if (txn.transactionType?.id === 1 || txn.transactionType?.name?.toLowerCase() === 'income') {
            // Income: Deposit To (Debit)
            if (debitEntry) accountId = debitEntry.accountId;
        }

        return {
            ...txn,
            txnType: txn.transactionType?.name?.toLowerCase(),
            categoryName: txn.category?.name || null,
            subCategoryName: txn.subCategory?.name || null,
            currencyCode: txn.currency?.code || null,
            contactId: txn.contactId,
            payee: txn.contact,
            counterpartyName: txn.contact,
            accountId,
            fromAccountId,
            toAccountId,
            createdByName: txn.creator?.fullName || txn.creator?.email || 'System'
        };
    }

    static async update(id: number, orgId: number, data: any, userId: number) {
        return await db.transaction(async (tx) => {
            const [existingRow] = await tx.select({
                transaction: transactions,
                transactionType: transactionTypes,
                currency: currencies
            })
                .from(transactions)
                .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(eq(transactions.id, id), eq(transactions.orgId, orgId), isNotDeleted(transactions)))
                .limit(1);

            if (!existingRow) throw new Error('Transaction not found');
            const existing = { ...existingRow.transaction, transactionType: existingRow.transactionType, currency: existingRow.currency };


            if (!existing) throw new Error('Transaction not found');

            let financialYearId = existing.financialYearId;
            if (data.txnDate) {
                const [fy] = await tx.select().from(financialYears).where(and(
                    eq(financialYears.orgId, orgId),
                    lte(financialYears.startDate, data.txnDate as any),
                    gte(financialYears.endDate, data.txnDate as any)
                )).limit(1);
                if (!fy) throw new Error(`Transaction date (${data.txnDate}) does not fall within any defined Financial Year.`);
                financialYearId = fy.id;
            }

            let finalFxRate = existing.fxRate;
            const [branch] = await tx.select()
                .from(branches)
                .where(and(eq(branches.id, existing.branchId), isNotDeleted(branches)))
                .limit(1);
            const branchCurrency = String(branch?.currencyCode || '').toUpperCase();
            const nextCurrencyCode = String(data.currencyCode || (existing as any).currency?.code || '').toUpperCase();

            if (nextCurrencyCode && nextCurrencyCode === branchCurrency) {
                finalFxRate = '1';
            } else if (data.fxRate) {
                finalFxRate = data.fxRate;
            } else if (data.currencyCode && data.currencyCode !== (existing as any).currency?.code) {
                // Update Rate
                if (branch) {
                    finalFxRate = (await ExchangeRateService.getRate(data.currencyCode, branch.currencyCode, existing.orgId)).toString();
                }
            }

            const headerPayload: any = {
                financialYearId,
                updatedAt: new Date(),
                createdBy: userId,
                fxRate: finalFxRate,
                amountLocal: data.amountLocal || existing.amountLocal,
                // Update other fields if present
                ...(data.name && { name: data.name }),
                ...(data.txnDate && { txnDate: data.txnDate }),
                ...(data.txnTypeId && { txnTypeId: data.txnTypeId }),
                ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
                ...(data.subCategoryId !== undefined && { subCategoryId: data.subCategoryId }),
                ...(data.notes !== undefined && { notes: data.notes }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.attachmentPath !== undefined && { attachmentPath: data.attachmentPath }),
                // GST fields
                ...(data.isTaxable !== undefined && { isTaxable: data.isTaxable === true || data.isTaxable === 1 || data.isTaxable === 'true' ? 1 : 0 }),
                ...(data.gstType !== undefined && { gstType: data.gstType }),
                ...(data.gstRate !== undefined && { gstRate: data.gstRate != null ? data.gstRate.toString() : null }),
                ...(data.cgstAmount !== undefined && { cgstAmount: data.cgstAmount != null ? data.cgstAmount.toString() : null }),
                ...(data.sgstAmount !== undefined && { sgstAmount: data.sgstAmount != null ? data.sgstAmount.toString() : null }),
                ...(data.igstAmount !== undefined && { igstAmount: data.igstAmount != null ? data.igstAmount.toString() : null }),
                ...(data.gstTotal !== undefined && { gstTotal: data.gstTotal != null ? data.gstTotal.toString() : null }),
                ...(data.finalAmount !== undefined && { finalAmount: data.finalAmount != null ? data.finalAmount.toString() : null }),
            };

            if (data.contactId !== undefined || data.contact !== undefined) {
                headerPayload.contactId = await this.resolvePartyId(
                    tx,
                    orgId,
                    existing.branchId,
                    data.contactId,
                    data.contact
                );
            }

            // Calculate Currency ID if code changed
            if (data.currencyCode) {
                const resolvedCurrency = await CurrencyMasterService.ensureCurrencyExists(data.currencyCode, tx);
                headerPayload.currencyId = resolvedCurrency.id;
            }

            const resolvedCategoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
            const resolvedSubCategoryId = data.subCategoryId !== undefined ? data.subCategoryId : existing.subCategoryId;

            if (resolvedCategoryId) {
                await this.ensureActiveCategory(tx, Number(resolvedCategoryId), orgId);
            }
            if (resolvedSubCategoryId) {
                await this.ensureActiveSubCategory(tx, Number(resolvedSubCategoryId), Number(resolvedCategoryId || 0) || null);
            }
            if (data.accountId) {
                await this.ensureActiveAccount(tx, Number(data.accountId), orgId, 'Selected');
            }
            if (data.fromAccountId) {
                await this.ensureActiveAccount(tx, Number(data.fromAccountId), orgId, 'Source');
            }
            if (data.toAccountId) {
                await this.ensureActiveAccount(tx, Number(data.toAccountId), orgId, 'Destination');
            }

            await tx.update(transactions)
                .set(headerPayload)
                .where(eq(transactions.id, id));

            // If financial critical fields changed (amount, type, accounts), recreate entries.
            // Simpler: Just recreate entries if ANY data passed that 'could' affect them.
            // Or: Always recreate entries based on merged data.

            const mergedData = {
                ...existing,
                ...data,
                ...data,
                // ensure we have mapped fields for entry creation logic
                amountLocal: data.amountLocal || existing.amountLocal
            };

            // Determine Type (New or Old)
            const txnTypeId = data.txnTypeId || existing.txnTypeId;
            const [txnType] = await tx.select().from(transactionTypes).where(eq(transactionTypes.id, txnTypeId)).limit(1);
            if (!txnType) throw new Error('Invalid Transaction Type ID');
            const typeName = txnType.name.toLowerCase();

            // Delete old entries
            await tx.delete(transactionEntries).where(eq(transactionEntries.transactionId, id));

            // Re-create Entries
            const entries: any[] = [];
            const isTxnTaxable = (data.isTaxable !== undefined ? data.isTaxable : existing.isTaxable) === true
                || (data.isTaxable !== undefined ? data.isTaxable : existing.isTaxable) === 1
                || (data.isTaxable !== undefined ? data.isTaxable : existing.isTaxable) === 'true';
            const txnFinalAmt = data.finalAmount !== undefined ? data.finalAmount : existing.finalAmount;
            const amount = isTxnTaxable && txnFinalAmt != null ? Number(txnFinalAmt) : Number(mergedData.amountLocal);

            // Reuse logic (duplicated for now to avoid refactoring 'create' into helper in this step)
            if (typeName === 'expense' || txnTypeId === 2) {
                // Need categoryId and accountId.
                // In 'update', data might contain 'categoryId'
                const catId = data.categoryId || (existing as any).entries?.find((e: any) => e.debit > 0)?.accountId; // Heuristic?
                if (data.categoryId === null || data.categoryId === undefined || data.accountId === null || data.accountId === undefined) {
                    throw new Error('Expense requires Category (Expense Account) and Paid From Account');
                }
                if (data.categoryId !== undefined && data.accountId !== undefined) {
                    entries.push({ transactionId: id, accountId: data.categoryId, debit: amount.toFixed(2), credit: (0).toFixed(2), description: 'Expense' });
                    entries.push({ transactionId: id, accountId: data.accountId, debit: (0).toFixed(2), credit: amount.toFixed(2), description: 'Paid From' });
                }
            } else if (typeName === 'income' || txnTypeId === 1) {
                if (data.categoryId === null || data.categoryId === undefined || data.accountId === null || data.accountId === undefined) {
                    throw new Error('Income requires Category (Income Account) and Deposit To Account');
                }
                if (data.categoryId !== undefined && data.accountId !== undefined) {
                    entries.push({ transactionId: id, accountId: data.accountId, debit: amount.toFixed(2), credit: (0).toFixed(2), description: 'Deposit To' });
                    entries.push({ transactionId: id, accountId: data.categoryId, debit: (0).toFixed(2), credit: amount.toFixed(2), description: 'Income Source' });
                }
            } else if (typeName === 'transfer' || txnTypeId === 4) {
                if (data.fromAccountId === null || data.fromAccountId === undefined || data.toAccountId === null || data.toAccountId === undefined) {
                    throw new Error('Transfer requires From Account and To Account');
                }
                if (data.fromAccountId !== undefined && data.toAccountId !== undefined) {
                    entries.push({ transactionId: id, accountId: data.toAccountId, debit: amount.toFixed(2), credit: (0).toFixed(2), description: 'Transfer In' });
                    entries.push({ transactionId: id, accountId: data.fromAccountId, debit: (0).toFixed(2), credit: amount.toFixed(2), description: 'Transfer Out' });
                }
            } else if (typeName === 'investment' || txnTypeId === 3) {
                if (data.toAccountId === null || data.toAccountId === undefined || data.accountId === null || data.accountId === undefined) {
                    throw new Error('Investment requires Investment Account and Paid From Account');
                }
                if (data.toAccountId === data.accountId) {
                    throw new Error('Investment Account and Paid From Account cannot be the same account');
                }
                if (data.toAccountId !== undefined && data.accountId !== undefined) {
                    entries.push({ transactionId: id, accountId: data.toAccountId, debit: amount.toFixed(2), credit: (0).toFixed(2), description: 'Investment' });
                    entries.push({ transactionId: id, accountId: data.accountId, debit: (0).toFixed(2), credit: amount.toFixed(2), description: 'Paid From' });
                }
            }

            if (entries.length > 0) {
                await tx.insert(transactionEntries).values(entries);
            } else {
                // If no entries created (e.g. partial update of validation failed), 
                // and we deleted old ones... DATA LOSS.
                // IMPORTANT: PROPER UPDATE LOGIC REQUIRED.
                // For now: Only delete entries if entries are being re-provided.
                // Refinement: If `entries.length === 0` and we expected them, throw error to rollback transaction.
                // But we only populate 'entries' if data provided.
                // If data.categoryId/accountId NOT provided, we assume we keep old entries?
                // No, amount might have changed.

                // SAFE BACKUP: If no account info in data, we try to restore old entries but with new amount?
                // Too complex. 
                // DECISION: Only allow Full Update of financial info. If not provided, assume keep old entries UNLESS amount changed.
                // If amount changed but no accounts provided -> Throw Error "Accounts required if amount changes".
            }

            await AuditService.log(
                orgId,
                'transaction',
                id,
                'update',
                userId,
                existing,
                headerPayload
            );

            const [updated] = await tx.select().from(transactions).where(eq(transactions.id, id)).limit(1);
            const [updater] = await tx.select({
                fullName: users.fullName,
                email: users.email
            }).from(users).where(eq(users.id, userId)).limit(1);

            return {
                ...updated,
                createdByName: updater?.fullName || updater?.email || 'System'
            };
        });
    }

    static async delete(id: number, orgId: number, userId: number) {
        const existing = await db.query.transactions.findFirst({
            where: and(eq(transactions.id, id), eq(transactions.orgId, orgId), isNotDeleted(transactions))
        });

        if (!existing) throw new Error('Transaction not found');

        await db.update(transactions)
            .set({
                status: DELETED_STATUS,
                updatedAt: new Date()
            })
            .where(eq(transactions.id, id));

        await AuditService.log(
            orgId,
            'transaction',
            id,
            'delete',
            userId,
            existing,
            null
        );

        return true;
    }

    static async getTransactionTypes() {
        return await db.select().from(transactionTypes);
    }

    static async getImportedStatements(orgId: number, branchId?: number, financialYearId?: number) {
        let conditions = [eq(importedStatements.orgId, orgId)];
        if (branchId) conditions.push(eq(importedStatements.branchId, branchId));
        if (financialYearId) conditions.push(eq(importedStatements.financialYearId, financialYearId));

        const results = await db.select({
            id: importedStatements.id,
            filename: importedStatements.filename,
            importedAt: importedStatements.importedAt,
            transactionCount: importedStatements.transactionCount,
            status: importedStatements.status,
            userId: users.id,
            userName: users.fullName
        }).from(importedStatements)
          .leftJoin(users, eq(importedStatements.importedBy, users.id))
          .where(and(...conditions))
          .orderBy(desc(importedStatements.importedAt));

        return results.map(row => ({
            id: row.id,
            filename: row.filename,
            importedAt: row.importedAt,
            transactionCount: row.transactionCount,
            status: row.status,
            user: {
                id: row.userId,
                name: row.userName
            }
        }));
    }

    static async revertImportedStatement(id: number, orgId: number, user: any) {
        // Fetch the statement
        const [statement] = await db.select().from(importedStatements).where(and(eq(importedStatements.id, id), eq(importedStatements.orgId, orgId)));
        if (!statement) {
            return { success: false, message: 'Statement not found' };
        }
        if (statement.status === 0) {
            return { success: false, message: 'Statement is already reverted' };
        }

        // We can just use the existing delete logic
        await db.delete(transactions).where(and(eq(transactions.importedStatementId, id), eq(transactions.orgId, orgId)));

        // Mark statement as reverted
        await db.update(importedStatements).set({ status: 0 }).where(eq(importedStatements.id, id));

        return { success: true, message: `Successfully reverted imported statement` };
    }

}
