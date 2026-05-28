import { db } from '../../db';
import { transactions, transactionEntries, categories, subCategories, accounts, transactionTypes, branches, organizations, currencies, parties } from '../../db/schema';
import { eq, and, or, sql, gte, lte, lt, desc, asc, inArray } from 'drizzle-orm';
import { constants as fsConstants } from 'node:fs';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ExchangeRateService } from '../../shared/exchange-rate.service';
import { isNotDeleted } from '../../shared/soft-delete';

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

const REPORT_PDF_BROWSER_CANDIDATES = [
    Bun.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
].filter(Boolean) as string[];

const findAvailablePdfBrowser = async () => {
    for (const candidate of REPORT_PDF_BROWSER_CANDIDATES) {
        try {
            await access(candidate, fsConstants.X_OK);
            return candidate;
        } catch {
            // Try next installed browser candidate.
        }
    }

    throw new Error('PDF export requires Google Chrome or Chromium to be installed on the server host');
};

const stripAutoPrintScripts = (html: string) => (
    String(html || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
);

type ReportTxnTypeFilter = string | string[];
type ReportCategoryFilter = number | number[];
type ReportAccountFilter = number | number[];
type ReportPartyFilter = string | string[];
type ReportFilters = {
    txnType?: ReportTxnTypeFilter,
    txnTypeId?: number,
    categoryId?: ReportCategoryFilter,
    accountId?: ReportAccountFilter,
    party?: ReportPartyFilter
};

const normalizeTxnTypeFilters = (txnType?: ReportTxnTypeFilter): string[] => {
    if (!txnType) return [];

    const values = Array.isArray(txnType) ? txnType : [txnType];
    const seen = new Set<string>();

    return values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value) => value !== 'All Types')
        .filter((value) => {
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const hasActiveTxnTypeFilters = (txnType?: ReportTxnTypeFilter) => normalizeTxnTypeFilters(txnType).length > 0;

const normalizeCategoryFilters = (categoryId?: ReportCategoryFilter): number[] => {
    if (!categoryId) return [];

    const values = Array.isArray(categoryId) ? categoryId : [categoryId];
    const seen = new Set<number>();

    return values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .filter((value) => {
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
};

const normalizeAccountFilters = (accountId?: ReportAccountFilter): number[] => {
    if (!accountId) return [];

    const values = Array.isArray(accountId) ? accountId : [accountId];
    const seen = new Set<number>();

    return values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .filter((value) => {
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
};

const normalizePartyFilters = (party?: ReportPartyFilter): string[] => {
    if (!party) return [];

    const values = Array.isArray(party) ? party : [party];
    const seen = new Set<string>();

    return values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value) => value !== 'All Parties')
        .filter((value) => {
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const appendDirectAccountFilter = (
    conditions: any[],
    accountColumn: any,
    accountId?: ReportAccountFilter
) => {
    const accountFilters = normalizeAccountFilters(accountId);
    const firstAccountId = accountFilters[0];

    if (accountFilters.length === 1 && firstAccountId !== undefined) {
        conditions.push(eq(accountColumn, firstAccountId));
    } else if (accountFilters.length > 1) {
        conditions.push(inArray(accountColumn, accountFilters));
    }
};

const appendTransactionEntryAccountExistsFilter = (
    conditions: any[],
    transactionIdColumn: any,
    accountId?: ReportAccountFilter
) => {
    const accountFilters = normalizeAccountFilters(accountId);
    const firstAccountId = accountFilters[0];

    if (accountFilters.length === 1 && firstAccountId !== undefined) {
        conditions.push(sql`EXISTS (SELECT 1 FROM transaction_entries te WHERE te.transaction_id = ${transactionIdColumn} AND te.account_id = ${firstAccountId})`);
    } else if (accountFilters.length > 1) {
        const joinedIds = sql.join(accountFilters.map((id) => sql`${id}`), sql`, `);
        conditions.push(sql`EXISTS (SELECT 1 FROM transaction_entries te WHERE te.transaction_id = ${transactionIdColumn} AND te.account_id IN (${joinedIds}))`);
    }
};

const pickAccountName = (
    txnType: string,
    entries: Array<{ accountId?: number | null, description: string | null, accountName: string | null }>,
    preferredAccountId?: ReportAccountFilter
) => {
    const byDesc = (d: string) => entries.find(e => (e.description || '').toLowerCase() === d.toLowerCase())?.accountName;
    const type = (txnType || '').toLowerCase();
    const preferredAccountIds = normalizeAccountFilters(preferredAccountId);
    if (preferredAccountIds.length > 0) {
        const exactMatch = entries.find((e) => preferredAccountIds.includes(Number(e.accountId)))?.accountName;
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
    filters?: ReportFilters
) => {
    const txnTypeFilters = normalizeTxnTypeFilters(filters?.txnType);

    if (txnTypeFilters.length > 0) {
        const typeIds = types
            .filter((type) => txnTypeFilters.some((txnType) => type.name.toLowerCase() === txnType.toLowerCase()))
            .map((type) => Number(type.id))
            .filter(Boolean);

        const firstTypeId = typeIds[0];

        if (typeIds.length === 1 && firstTypeId !== undefined) {
            conditions.push(eq(transactions.txnTypeId, firstTypeId));
        } else if (typeIds.length > 1) {
            conditions.push(inArray(transactions.txnTypeId, typeIds));
        }
    }
    const categoryFilters = normalizeCategoryFilters(filters?.categoryId);
    const firstCategoryId = categoryFilters[0];
    if (categoryFilters.length === 1 && firstCategoryId !== undefined) {
        conditions.push(eq(transactions.categoryId, firstCategoryId));
    } else if (categoryFilters.length > 1) {
        conditions.push(inArray(transactions.categoryId, categoryFilters));
    }
    appendTransactionEntryAccountExistsFilter(conditions, transactions.id, filters?.accountId);
    const partyFilters = normalizePartyFilters(filters?.party);
    const firstPartyFilter = partyFilters[0];
    if (partyFilters.length === 1 && firstPartyFilter !== undefined) {
        conditions.push(sql`(
            EXISTS (SELECT 1 FROM parties p WHERE p.id = ${transactions.contactId} AND lower(COALESCE(p.company_name, p.name)) = lower(${firstPartyFilter}))
            OR lower(${transactions.name}) = lower(${firstPartyFilter})
        )`);
    } else if (partyFilters.length > 1) {
        const partyConditions = sql.join(
            partyFilters.map((partyName) => sql`lower(COALESCE(p.company_name, p.name)) = lower(${partyName})`),
            sql` OR `
        );
        const txnNameConditions = sql.join(
            partyFilters.map((partyName) => sql`lower(${transactions.name}) = lower(${partyName})`),
            sql` OR `
        );

        conditions.push(sql`(
            EXISTS (SELECT 1 FROM parties p WHERE p.id = ${transactions.contactId} AND (${partyConditions}))
            OR (${txnNameConditions})
        )`);
    }
};

const fetchDetailedRows = async (
    orgId: number,
    branchId: number | number[] | 'all',
    startDate: string,
    endDate: string,
    filters?: ReportFilters,
    targetCurrency?: string,
    user?: any
) => {
    const types = await db.select().from(transactionTypes);
    const conditions: any[] = [
        eq(transactions.orgId, orgId),
        isNotDeleted(transactions),
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
        partyName: sql<string>`COALESCE(${parties.companyName}, ${parties.name})`,
        amountDisplay: sql<string>`COALESCE(${transactions.finalAmount}, ${transactions.amountLocal})`
    })
        .from(transactions)
        .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
        .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .leftJoin(parties, eq(transactions.contactId, parties.id))
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
    const accountFilters = normalizeAccountFilters(filters?.accountId);

    const rows: any[] = [];
    for (const t of txns as any[]) {
        const txnEntries = entriesByTxn.get(t.id) || [];
        if (accountFilters.length > 0) {
            const hasAccount = txnEntries.some((e) => accountFilters.includes(Number(e.accountId)));
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
            party: (t.partyName || '-').trim() || '-',
            category: { name: (t.categoryName || '-').trim() || '-' },
            account: { name: (accountName || '-').trim() || '-' }
        });
    }

    return { rows, currency: finalCurrency };
};

const formatExportDate = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
};

const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const escapeHtml = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const ReportsService = {
    buildExportCsv: (reportData: any, reportType: string, searchTerm?: string) => {
        const term = (searchTerm || '').trim().toLowerCase();
        let headers: string[] = [];
        let rows: any[][] = [];

        if (reportData?.type === 'profit-loss') {
            const d = reportData.data || {};
            const incomes = Array.isArray(d.incomes) ? d.incomes : [];
            const expenses = Array.isArray(d.expenses) ? d.expenses : [];
            const filterGroups = (groups: any[]) => {
                if (!term) return groups;
                return groups
                    .map((group) => ({
                        ...group,
                        items: (group.items || []).filter((item: any) => {
                            const line = `${group.category} ${item.subCategory}`.toLowerCase();
                            return line.includes(term);
                        })
                    }))
                    .filter((group) => (group.items || []).length > 0 || String(group.category).toLowerCase().includes(term));
            };

            headers = ['Section', 'Category', 'Sub Category', 'Amount'];
            filterGroups(incomes).forEach((group) => {
                if (group.items?.length) {
                    group.items.forEach((item: any) => {
                        rows.push(['Income', group.category || 'Uncategorized', item.subCategory || '', item.amount || 0]);
                    });
                } else {
                    rows.push(['Income', group.category || 'Uncategorized', '', group.total || 0]);
                }
            });
            filterGroups(expenses).forEach((group) => {
                if (group.items?.length) {
                    group.items.forEach((item: any) => {
                        rows.push(['Expense', group.category || 'Uncategorized', item.subCategory || '', item.amount || 0]);
                    });
                } else {
                    rows.push(['Expense', group.category || 'Uncategorized', '', group.total || 0]);
                }
            });
        }
        else {
            let dataToExport = Array.isArray(reportData?.tableData) ? [...reportData.tableData] : [];
            if (term) {
                dataToExport = dataToExport.filter((item: any) => {
                    if (reportData?.type === 'transactions' || reportData?.type === 'ledger') {
                        const categoryText = typeof item.category === 'object' && item.category !== null ? (item.category.name || '') : (item.category || '');
                        return `${item.description || ''} ${categoryText} ${item.party || item.contact || ''}`.toLowerCase().includes(term);
                    }
                    if (reportData?.type === 'categories' || reportData?.type === 'accounts' || reportData?.type === 'parties') {
                        return String(item.name || '').toLowerCase().includes(term);
                    }
                    return false;
                });
            }

            if (reportData?.type === 'transactions') {
                headers = ['Date', 'Description', 'Category', 'Bank Name', 'Type', 'Amount'];
                rows = dataToExport.map((item: any) => [
                    formatExportDate(item.txnDate || item.date),
                    item.description || '',
                    typeof item.category === 'object' && item.category !== null ? item.category.name : (item.category || ''),
                    typeof item.account === 'object' && item.account !== null ? item.account.name : (item.account || item.method || ''),
                    item.txnType || item.type || '',
                    item.amountBase ?? item.amountLocal ?? item.amount ?? ''
                ]);
            } else if (reportData?.type === 'ledger') {
                headers = ['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance'];
                if (!term && reportData?.openingBalance !== undefined) {
                    rows.push(['', 'Opening Balance', '', '', '', reportData.openingBalance]);
                }
                rows.push(...dataToExport.map((item: any) => [
                    formatExportDate(item.txnDate || item.date),
                    item.description || '',
                    typeof item.category === 'object' && item.category !== null ? item.category.name : (item.category || ''),
                    item.debit || '',
                    item.credit || '',
                    item.balance || ''
                ]));
                if (!term && reportData?.closingBalance !== undefined) {
                    rows.push(['', 'Closing Balance', '', '', '', reportData.closingBalance]);
                }
            } else if (reportData?.type === 'categories' || reportData?.type === 'accounts' || reportData?.type === 'parties') {
                headers = [reportData.type === 'categories' ? 'Category' : (reportData.type === 'accounts' ? 'Account Name' : 'Party Name'), 'Opening Balance', 'Income', 'Expense', 'Investment', 'Closing Balance', 'Count'];
                rows = dataToExport.map((item: any) => [
                    item.name || '',
                    item.openingBalance ?? '',
                    item.income ?? '',
                    item.expense ?? '',
                    item.investment ?? '',
                    item.closingBalance ?? '',
                    item.count ?? ''
                ]);
            }
        }

        return [
            headers.map(escapeCsv).join(','),
            ...rows.map((row) => row.map(escapeCsv).join(','))
        ].join('\n');
    },

    buildPrintableHtml: (
        reportData: any,
        reportType: string,
        searchTerm?: string,
        reportMeta?: {
            organizationName?: string,
            organizationAddress?: string,
            organizationBranchLine?: string,
            startDate?: string,
            endDate?: string
        }
    ) => {
        const term = (searchTerm || '').trim().toLowerCase();
        const generatedDate = new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date());
        const selectedDateRange = reportMeta?.startDate && reportMeta?.endDate
            ? `${formatExportDate(reportMeta.startDate)} to ${formatExportDate(reportMeta.endDate)}`
            : '';
        const renderTable = (headers: string[], rows: string[][]) => {
            const getColumnMeta = (header: string) => {
                const lower = String(header || '').toLowerCase();
                if (lower.includes('bank name') || lower.includes('account')) return { width: '18%', charsPerLine: 24 };
                if (lower.includes('date')) return { width: '12%', charsPerLine: 14 };
                if (lower.includes('type')) return { width: '10%', charsPerLine: 12 };
                if (lower.includes('amount') || lower.includes('balance') || lower.includes('credit') || lower.includes('debit') || lower.includes('income') || lower.includes('expense') || lower.includes('investment')) {
                    return { width: '14%', charsPerLine: 14 };
                }
                if (lower.includes('description') || lower.includes('notes') || lower.includes('particulars')) return { width: '22%', charsPerLine: 28 };
                if (lower.includes('category')) return { width: '15%', charsPerLine: 20 };
                if (lower.includes('party')) return { width: '15%', charsPerLine: 20 };
                if (lower.includes('branch')) return { width: '10%', charsPerLine: 12 };
                return { width: 'auto', charsPerLine: 18 };
            };

            const wrapText = (val: any) => {
                const str = String(val ?? '');
                // Insert zero-width space every 15 chars for massive unbreakable strings 
                // This prevents `table-layout: auto` from exploding the canvas width
                const wrapped = str.replace(/([^\s]{15})(?=[^\s])/g, '$1\u200B');
                return escapeHtml(wrapped);
            };

            const columnMeta = headers.map((header) => getColumnMeta(header));
            const estimateRowUnits = (row: string[]) => {
                const maxLines = row.reduce((currentMax, value, index) => {
                    const content = String(value ?? '').replace(/\u200B/g, '').trim();
                    if (!content) return currentMax;

                    const charsPerLine = columnMeta[index]?.charsPerLine || 18;
                    const lines = content
                        .split(/\r?\n/)
                        .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);

                    return Math.max(currentMax, lines);
                }, 1);

                return Math.max(2, maxLines + 1);
            };

            const chunkRowsForPrint = (allRows: string[][]) => {
                const pages: string[][][] = [];
                let currentPageRows: string[][] = [];
                let currentUnits = 0;
                let pageIndex = 0;

                allRows.forEach((row) => {
                    const rowUnits = estimateRowUnits(row);
                    const pageBudget = pageIndex === 0 ? 28 : 34;

                    if (currentPageRows.length > 0 && currentUnits + rowUnits > pageBudget) {
                        pages.push(currentPageRows);
                        currentPageRows = [row];
                        currentUnits = rowUnits;
                        pageIndex += 1;
                        return;
                    }

                    currentPageRows.push(row);
                    currentUnits += rowUnits;
                });

                if (currentPageRows.length > 0) {
                    pages.push(currentPageRows);
                }

                return pages.length > 0 ? pages : [allRows];
            };

            const renderTablePage = (pageRows: string[][]) => `
                <table>
                    <colgroup>
                        ${columnMeta.map((meta) => `<col style="width: ${meta.width};">`).join('')}
                    </colgroup>
                    <thead>
                        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${pageRows.map((row) => `
                            <tr>
                                ${row.map((value, index) => `<td${index === row.length - 1 ? ' style="text-align:right;"' : ''}>${wrapText(value)}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            return chunkRowsForPrint(rows)
                .map((pageRows, index, pages) => `
                    <div class="report-table-page${index < pages.length - 1 ? ' report-table-page-break' : ''}">
                        ${renderTablePage(pageRows)}
                    </div>
                `)
                .join('');
        };
        const renderMetricCards = (items: Array<{ label: string, value: string }>) => `
            <div class="metric-grid">
                ${items.map((item) => `
                    <div class="metric-card">
                        <div class="metric-label">${escapeHtml(item.label)}</div>
                        <div class="metric-value">${escapeHtml(item.value)}</div>
                    </div>
                `).join('')}
            </div>
        `;
        const renderSectionTitle = (title: string) => `<h2 class="section-title">${escapeHtml(title)}</h2>`;

        const isProfitLossReport = reportData?.type === 'profit-loss';
        let content = '';

        if (reportData?.type === 'profit-loss') {
            const d = reportData.data || {};
            const formatStatementAmount = (val: number, showZero = false) => {
                const amount = Number(val || 0);
                if (!showZero && amount === 0) return '';

                return new Intl.NumberFormat('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(amount);
            };

            type PnlRow = {
                kind: 'section' | 'item' | 'balance';
                label: string;
                total?: number;
                amount?: number;
            };

            const getItemLabel = (item: any) => String(item?.subCategory || item?.account || item?.name || '').trim();

            const buildStatementRows = (groups: any[] = [], balancingRow?: { label: string, amount: number } | null): PnlRow[] => {
                const rows: PnlRow[] = [];

                groups
                    .filter((group) => String(group?.category || '').trim())
                    .forEach((group: any) => {
                        rows.push({
                            kind: 'section',
                            label: String(group.category).trim(),
                            total: Number(group.total || 0)
                        });

                        (group.items || []).forEach((item: any) => {
                            const label = getItemLabel(item);
                            if (!label) return;

                            rows.push({
                                kind: 'item',
                                label,
                                amount: Number(item.amount || 0)
                            });
                        });
                    });

                if (balancingRow?.amount && balancingRow.amount > 0) {
                    rows.push({
                        kind: 'balance',
                        label: balancingRow.label,
                        total: Number(balancingRow.amount || 0)
                    });
                }

                return rows;
            };

            const leftRows = buildStatementRows(
                d.expenses || [],
                d.netProfit > 0 ? { label: 'Nett Profit', amount: d.netProfit } : null
            );
            const rightRows = buildStatementRows(
                d.incomes || [],
                d.netLoss > 0 ? { label: 'Nett Loss', amount: d.netLoss } : null
            );

            const maxRows = Math.max(leftRows.length, rightRows.length, 1);
            const rowsHtml = [];
            for (let i = 0; i < maxRows; i++) {
                const left = leftRows[i] || null;
                const right = rightRows[i] || null;
                const isLeftLastItem = left?.kind === 'item' && leftRows[i + 1]?.kind !== 'item';
                const isRightLastItem = right?.kind === 'item' && rightRows[i + 1]?.kind !== 'item';

                rowsHtml.push(`
                    <tr class="pnl-data-row">
                        <td class="pnl-particulars ${left?.kind === 'section' ? 'pnl-section' : left?.kind === 'item' ? 'pnl-item' : left?.kind === 'balance' ? 'pnl-balance' : 'pnl-empty'}">
                            ${left?.label ? escapeHtml(left.label) : '&nbsp;'}
                        </td>
                        <td class="pnl-amount text-right ${left?.kind === 'item' ? 'pnl-item-amount' : 'pnl-empty'}">
                            ${left?.kind === 'item'
                                ? `<span class="pnl-item-value ${isLeftLastItem ? 'pnl-subtotal-line' : ''}">${escapeHtml(formatStatementAmount(left.amount || 0))}</span>`
                                : '&nbsp;'}
                        </td>
                        <td class="pnl-total text-right pnl-side-divider ${left?.kind === 'section' ? 'pnl-section-total' : left?.kind === 'balance' ? 'pnl-balance-total' : 'pnl-empty'}">
                            ${left?.kind === 'section' || left?.kind === 'balance' ? escapeHtml(formatStatementAmount(left.total || 0)) : '&nbsp;'}
                        </td>
                        <td class="pnl-particulars ${right?.kind === 'section' ? 'pnl-section pnl-right-section' : right?.kind === 'item' ? 'pnl-item pnl-right-item' : right?.kind === 'balance' ? 'pnl-balance pnl-right-section' : 'pnl-empty'}">
                            ${right?.label ? escapeHtml(right.label) : '&nbsp;'}
                        </td>
                        <td class="pnl-amount text-right ${right?.kind === 'item' ? 'pnl-item-amount' : 'pnl-empty'}">
                            ${right?.kind === 'item'
                                ? `<span class="pnl-item-value ${isRightLastItem ? 'pnl-subtotal-line' : ''}">${escapeHtml(formatStatementAmount(right.amount || 0))}</span>`
                                : '&nbsp;'}
                        </td>
                        <td class="pnl-total text-right ${right?.kind === 'section' ? 'pnl-section-total' : right?.kind === 'balance' ? 'pnl-balance-total' : 'pnl-empty'} ${right?.kind === 'balance' && right?.label === 'Nett Loss' ? 'pnl-loss-italic' : ''}">
                            ${right?.kind === 'section' || right?.kind === 'balance' ? escapeHtml(formatStatementAmount(right.total || 0)) : '&nbsp;'}
                        </td>
                    </tr>
                `);
            }

            const formatDateExact = (val?: string) => {
                if (!val) return '';
                const date = new Date(val);
                if (Number.isNaN(date.getTime())) return '';
                return new Intl.DateTimeFormat('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: '2-digit'
                }).format(date).replace(/ /g, '-');
            };

            const headerRange = (reportMeta?.startDate && reportMeta?.endDate)
                ? `${formatDateExact(reportMeta.startDate)} to ${formatDateExact(reportMeta.endDate)}`
                : (selectedDateRange || '-');

            const organizationName = String(reportMeta?.organizationName || '').trim();
            const organizationLines = String(reportMeta?.organizationAddress || '')
                .split(/\r?\n|,/)
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 3);
            const fallbackBranchLine = String(reportMeta?.organizationBranchLine || '').trim();
            const headerLines = organizationLines.length > 0
                ? organizationLines
                : (fallbackBranchLine ? [fallbackBranchLine] : []);

            content = `
                <div class="pnl-container">
                    <div class="pnl-header">
                        <div class="pnl-org-name">${escapeHtml(organizationName || 'Organization Name')}</div>
                        ${headerLines.map((line, index) => `<div class="pnl-org-line${index === headerLines.length - 1 ? ' pnl-org-line-last' : ''}">${escapeHtml(line)}</div>`).join('')}
                        <div class="pnl-title">Profit &amp; Loss A/c</div>
                        <div class="pnl-period">${escapeHtml(headerRange)}</div>
                    </div>
                    <table class="pnl-table">
                        <colgroup>
                            <col style="width:26%;">
                            <col style="width:11%;">
                            <col style="width:13%;">
                            <col style="width:26%;">
                            <col style="width:11%;">
                            <col style="width:13%;">
                        </colgroup>
                        <thead>
                            <tr class="pnl-column-row">
                                <th class="text-center">E x p e n s e s</th>
                                <th colspan="2" class="text-center pnl-side-divider">&nbsp;</th>
                                <th class="text-center">I n c o m e</th>
                                <th colspan="2" class="text-center">&nbsp;</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="height: 6px;"><td colspan="6" style="border: none;"></td></tr>
                            ${rowsHtml.join('')}
                            <tr style="height: 12px;"><td colspan="6" style="border: none;"></td></tr>
                        </tbody>
                        <tfoot>
                            <tr class="pnl-total-row">
                                <td colspan="2" class="pnl-total-label">Total</td>
                                <td class="pnl-total-cell pnl-side-divider">
                                    ${escapeHtml(formatStatementAmount(d.totalLeft || 0, true))}
                                </td>
                                <td colspan="2" class="pnl-total-label">Total</td>
                                <td class="pnl-total-cell">
                                    ${escapeHtml(formatStatementAmount(d.totalRight || 0, true))}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        }
        else if (reportData?.type === 'transactions') {
            const rows = (Array.isArray(reportData?.tableData) ? reportData.tableData : [])
                .filter((item: any) => {
                    if (!term) return true;
                    const categoryText = typeof item.category === 'object' && item.category !== null ? (item.category.name || '') : (item.category || '');
                    return `${item.description || ''} ${categoryText} ${item.party || item.contact || ''}`.toLowerCase().includes(term);
                })
                .map((item: any) => [
                    formatExportDate(item.txnDate || item.date),
                    String(item.description || ''),
                    String(typeof item.category === 'object' && item.category !== null ? item.category.name : (item.category || '')),
                    String(typeof item.account === 'object' && item.account !== null ? item.account.name : (item.account || item.method || '')),
                    String(item.txnType || item.type || ''),
                    String(item.amountBase ?? item.amountLocal ?? item.amount ?? '')
                ]);
            const summaryBlock = reportType === 'Summary' && reportData?.summary
                ? renderMetricCards([
                    { label: 'Net Profit', value: String((reportData.summary.income ?? 0) - (reportData.summary.expense ?? 0)) },
                    { label: 'Total Income', value: String(reportData.summary.income ?? 0) },
                    { label: 'Total Expense', value: String(reportData.summary.expense ?? 0) },
                    { label: 'Total Investment', value: String(reportData.summary.investment ?? 0) }
                ])
                : '';
            content = `${summaryBlock}${renderTable(['Date', 'Description', 'Category', 'Bank Name', 'Type', 'Amount'], rows)}`;
        } else if (reportData?.type === 'ledger') {
            const rows: string[][] = [];
            if (!term && reportData?.openingBalance !== undefined) {
                rows.push(['', 'Opening Balance', '', '', '', String(reportData.openingBalance)]);
            }
            (Array.isArray(reportData?.tableData) ? reportData.tableData : [])
                .filter((item: any) => {
                    if (!term) return true;
                    const categoryText = typeof item.category === 'object' && item.category !== null ? (item.category.name || '') : (item.category || '');
                    return `${item.description || ''} ${categoryText} ${item.party || item.contact || ''}`.toLowerCase().includes(term);
                })
                .forEach((item: any) => {
                    rows.push([
                        formatExportDate(item.txnDate || item.date),
                        String(item.description || ''),
                        String(typeof item.category === 'object' && item.category !== null ? item.category.name : (item.category || '')),
                        String(item.debit || ''),
                        String(item.credit || ''),
                        String(item.balance || '')
                    ]);
                });
            if (!term && reportData?.closingBalance !== undefined) {
                rows.push(['', 'Closing Balance', '', '', '', String(reportData.closingBalance)]);
            }
            content = renderTable(['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance'], rows);
        } else if (reportData?.type === 'categories' || reportData?.type === 'accounts' || reportData?.type === 'parties') {
            const nameHeader = reportData.type === 'categories' ? 'Category' : (reportData.type === 'accounts' ? 'Account Name' : 'Party Name');
            const rows = (Array.isArray(reportData?.tableData) ? reportData.tableData : [])
                .filter((item: any) => !term || String(item?.name || '').toLowerCase().includes(term))
                .map((item: any) => [
                    String(item.name || ''),
                    String(item.openingBalance ?? ''),
                    String(item.income ?? ''),
                    String(item.expense ?? ''),
                    String(item.investment ?? ''),
                    String(item.closingBalance ?? ''),
                    String(item.count ?? '')
                ]);
            content = renderTable([nameHeader, 'Opening Balance', 'Income', 'Expense', 'Investment', 'Closing Balance', 'Count'], rows);
        } else {
            const csvContent = ReportsService.buildExportCsv(reportData, reportType, searchTerm);
            const [headerLine, ...dataLines] = csvContent.split('\n');
            if (!headerLine) {
                content = renderTable([], []);
            } else {
                const headers = headerLine.split(',').map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"'));
                const rows = dataLines
                    .filter(Boolean)
                    .map((line) => line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map((cell) =>
                        cell.replace(/^"|"$/g, '').replace(/""/g, '"')
                    ));
                content = renderTable(headers, rows);
            }
        }

        return `
            <!doctype html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>${escapeHtml(reportType || 'Report')}</title>
                <style>
                    @page { size: ${isProfitLossReport ? 'A4 portrait' : 'A4 landscape'}; margin: 0mm; }
                    body { font-family: Arial, sans-serif; padding: 20mm; color: #111827; }
                    body.pnl-body {
                        font-family: Arial, Helvetica, sans-serif;
                        padding: 26mm 18mm 16mm;
                        color: #111111;
                        background: #ffffff;
                    }
                    .report-org-name { text-align: center; font-size: 24px; font-weight: 800; margin: 0 0 10px; color: #111827; }
                    h1 { font-size: 20px; margin: 0 0 6px; }
                    .report-meta { display: flex; flex-direction: column; gap: 4px; margin: 0 0 18px; font-size: 12px; color: #6b7280; }
                    .section-title { font-size: 15px; margin: 18px 0 10px; color: #111827; }
                    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0 0 18px; }
                    .metric-card { border: 1px solid #e5e7eb; background: #f8fafc; border-radius: 10px; padding: 12px; }
                    .metric-label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; margin-bottom: 6px; }
                    .metric-value { font-size: 16px; font-weight: 700; color: #111827; }
                    .report-table-page {
                        margin: 0 0 20px;
                    }
                    .report-table-page-break {
                        page-break-after: always;
                        break-after: page;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 10px;
                        table-layout: fixed;
                        border: 2px solid #000;
                        background-color: #ffffff;
                        margin-bottom: 0;
                        page-break-inside: auto;
                    }
                    thead { display: table-header-group; }
                    tbody { display: table-row-group; }
                    tr {
                        background-color: #ffffff;
                    }
                    th, td { 
                        border: 1px solid #000; 
                        padding: 8px 10px; 
                        vertical-align: middle; 
                        word-break: break-all;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                        color: #000;
                        background-color: #ffffff;
                    }
                    th { 
                        text-align: left; 
                        font-weight: 700; 
                        text-transform: uppercase;
                        border-bottom: 2px solid #000;
                    }
                    tbody tr:last-child td { border-bottom: 1px solid #000; }

                    /* Profit & Loss Specific Styles */
                    .pnl-container { padding: 0; max-width: 760px; margin: 0 auto; }
                    .pnl-header {
                        text-align: center;
                        margin: 0 auto 24px;
                        color: #111111;
                    }
                    .pnl-org-name {
                        font-size: 16px;
                        font-weight: 600;
                        letter-spacing: 0.005em;
                        text-transform: uppercase;
                        line-height: 1.12;
                        margin-bottom: 2px;
                    }
                    .pnl-org-line {
                        font-size: 10.5px;
                        line-height: 1.16;
                        color: #111111;
                    }
                    .pnl-org-line-last {
                        display: inline-block;
                        border-bottom: 1px solid #111111;
                        padding-bottom: 1px;
                    }
                    .pnl-title {
                        margin-top: 7px;
                        font-size: 15.5px;
                        font-weight: 600;
                        line-height: 1.12;
                    }
                    .pnl-period {
                        margin-top: 1px;
                        font-size: 10.5px;
                        line-height: 1.12;
                        color: #111111;
                    }

                    .pnl-table {
                        border-collapse: collapse;
                        table-layout: fixed;
                        width: 100%;
                        font-size: 10.5px;
                        border: none;
                    }
                    .pnl-table th,
                    .pnl-table td {
                        border: none;
                        padding: 0.5px 0;
                        vertical-align: top;
                    }
                    .pnl-table tbody tr { background: transparent !important; }
                    .pnl-table thead th {
                        background: transparent;
                        color: #111111;
                    }
                    .pnl-column-row th {
                        font-size: 11px;
                        font-weight: 550;
                        text-align: center;
                        letter-spacing: 0.02em;
                        text-transform: none;
                        padding-top: 1px;
                        padding-bottom: 1px;
                        border-top: 1px solid #2f2f2f;
                        border-bottom: 1px solid #2f2f2f;
                    }
                    .pnl-column-row th:first-child { padding: 0 !important; }
                    .pnl-column-row th:nth-child(3) { padding: 0 !important; }
                    .pnl-particulars { width: 30%; padding-left: 8px !important; }
                    .pnl-amount {
                        width: 10%;
                        font-size: 11px;
                        text-align: right;
                        white-space: nowrap;
                        word-break: normal;
                        padding-right: 8px !important;
                    }
                    .pnl-total {
                        width: 10%;
                        font-size: 11px;
                        text-align: right;
                        white-space: nowrap;
                        word-break: normal;
                        padding-right: 8px !important;
                    }
                    .pnl-side-divider { border-right: 1px solid #4b4b4b !important; }
                    .pnl-data-row td { background: transparent; }
                    .pnl-section {
                        font-weight: 550;
                        font-size: 11.5px;
                        color: #111111;
                        padding-top: 4px !important;
                    }
                    .pnl-item {
                        padding-left: 12px !important;
                        font-size: 10.5px;
                        color: #111111;
                        font-style: italic;
                    }
                    .pnl-right-section {
                        padding-left: 8px !important;
                        padding-right: 12px !important;
                    }
                    .pnl-right-item {
                        padding-left: 12px !important;
                    }
                    .pnl-item-amount {
                        font-size: 10.5px;
                        color: #111111;
                        font-style: italic;
                    }
                    .pnl-item-value {
                        position: relative;
                        display: inline-block;
                        min-width: 104px;
                        left: -36px;
                        text-align: right;
                    }
                    .pnl-subtotal-line {
                        border-bottom: 1px solid rgba(0, 0, 0, 0.55);
                        padding-bottom: 1px;
                    }
                    .pnl-empty {
                        color: transparent;
                    }
                    .pnl-balance {
                        padding-top: 4px !important;
                        font-size: 11px;
                    }
                    .pnl-section-total {
                        font-weight: 550;
                        padding-top: 4px !important;
                    }
                    .pnl-balance-total {
                        font-weight: 600;
                        padding-top: 4px !important;
                    }
                    .pnl-loss-italic {
                        font-style: italic;
                    }
                    .pnl-total-row td {
                        padding-top: 1px;
                        padding-bottom: 1px;
                        border-top: 1px solid #2f2f2f;
                        border-bottom: 1px solid #2f2f2f;
                        background: transparent;
                    }
                    .pnl-total-label {
                        font-size: 11px;
                        font-weight: 550;
                        letter-spacing: 0.02em;
                        text-transform: none;
                        color: #111111;
                        text-align: left;
                    }
                    .pnl-total-row td:first-child, .pnl-total-row td:nth-child(3) {
                        padding-left: 8px !important;
                    }
                    .pnl-total-cell {
                        font-size: 10.5px;
                        font-weight: 550;
                        text-align: right;
                        color: #111111;
                        white-space: nowrap;
                        word-break: normal;
                        padding-right: 8px !important;
                    }

                    .text-right { text-align: right !important; }
                    .font-bold { font-weight: bold; }
                </style>
                <script>
                    window.addEventListener('load', () => {
                        setTimeout(() => window.print(), 250);
                    });
                </script>
            </head>
            <body class="${isProfitLossReport ? 'pnl-body' : ''}">
                ${isProfitLossReport ? content : `
                    <div class="report-org-name">${escapeHtml(reportMeta?.organizationName || '')}</div>
                    <h1>${escapeHtml(reportType || 'Report')}</h1>
                    <div class="report-meta">
                        <div><strong>Date Range:</strong> ${escapeHtml(selectedDateRange || '-')}</div>
                        <div><strong>Generated Date:</strong> ${escapeHtml(generatedDate)}</div>
                    </div>
                    ${content}
                `}
            </body>
            </html>
        `;
    },

    renderPdfBufferFromHtml: async (html: string, filePrefix = 'reports') => {
        const browserPath = await findAvailablePdfBrowser();
        const safePrefix = String(filePrefix || 'reports')
            .trim()
            .replace(/[^a-z0-9_-]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            || 'reports';
        const tempDir = await mkdtemp(join(tmpdir(), 'reports-pdf-'));
        const htmlPath = join(tempDir, `${safePrefix}.html`);
        const pdfPath = join(tempDir, `${safePrefix}.pdf`);

        try {
            await writeFile(htmlPath, stripAutoPrintScripts(html), 'utf8');

            const process = Bun.spawn([
                browserPath,
                '--headless',
                '--disable-gpu',
                '--disable-extensions',
                '--no-first-run',
                '--no-default-browser-check',
                '--allow-file-access-from-files',
                '--no-pdf-header-footer',
                `--print-to-pdf=${pdfPath}`,
                pathToFileURL(htmlPath).href
            ], {
                stdout: 'pipe',
                stderr: 'pipe'
            });

            const [exitCode, stdout, stderr] = await Promise.all([
                process.exited,
                process.stdout ? new Response(process.stdout).text() : Promise.resolve(''),
                process.stderr ? new Response(process.stderr).text() : Promise.resolve('')
            ]);

            if (exitCode !== 0) {
                const details = [stderr, stdout].map((value) => value.trim()).filter(Boolean).join('\n');
                throw new Error(details ? `PDF export failed: ${details}` : 'PDF export failed');
            }

            return await readFile(pdfPath);
        } catch (error: any) {
            throw new Error(error?.message || 'Failed to render report PDF');
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    },

    // 1. Summary Report
    getSummary: async (orgId: number, branchId: number | number[] | 'all', startDate: string, endDate: string, filters?: ReportFilters, targetCurrency?: string, user?: any) => {
        // Fetch Types
        const types = await db.select().from(transactionTypes);
        const incomeId = types.find(t => t.name === 'Income')?.id;
        const expenseId = types.find(t => t.name === 'Expense')?.id;
        const investmentId = types.find(t => t.name === 'Investment')?.id;

        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const org = orgList[0];
        const finalCurrency = targetCurrency || org?.baseCurrency || 'USD';

        // 1. Calculate Date-filtered Opening Balance
        let initialAccountBalance = 0;
        const shouldIncludeInitialBalance = 
            (!branchId || branchId === 'all') && 
            !filters?.categoryId && 
            !filters?.party && 
            !hasActiveTxnTypeFilters(filters?.txnType);

        if (shouldIncludeInitialBalance) {
            const accountConditions: any[] = [
                eq(accounts.orgId, orgId),
                isNotDeleted(accounts)
            ];
            appendDirectAccountFilter(accountConditions, accounts.id, filters?.accountId);

            const accOpeningQuery = await db.select({
                openingBalance: accounts.openingBalance,
                currency: currencies.code
            })
                .from(accounts)
                .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
                .where(and(...accountConditions));

            for (const acc of accOpeningQuery as any[]) {
                const converted = await ExchangeRateService.convert(Number(acc.openingBalance || 0), acc.currency || 'USD', finalCurrency);
                initialAccountBalance += converted;
            }
        }

        const pastConditions: any[] = [
            eq(transactions.orgId, orgId),
            isNotDeleted(transactions),
            eq(transactions.status, 1),
            lt(transactions.txnDate, startDate)
        ];
        appendBranchFilter(pastConditions, transactions.branchId, branchId, user);
        appendTxnAndCategoryFilters(pastConditions, types, filters);

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

        const openingBalance = initialAccountBalance + pastTxnsValue;

        // 2. Current Period Totals (for Debit / Credit)
        const conditions = [
            eq(transactions.orgId, orgId),
            isNotDeleted(transactions),
            eq(transactions.status, 1),
            gte(transactions.txnDate, startDate),
            lte(transactions.txnDate, endDate)
        ];
        appendBranchFilter(conditions, transactions.branchId, branchId, user);

        appendTxnAndCategoryFilters(conditions, types, filters);

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
        const closingBalance = openingBalance + income - expense - investment;

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
    getCategoryWise: async (orgId: number, branchId: number | number[] | 'all', startDate: string, endDate: string, filters?: ReportFilters, targetCurrency?: string, user?: any) => {
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

    // 2b. Party-wise Report
    getPartyWise: async (orgId: number, branchId: number | number[] | 'all', startDate: string, endDate: string, filters?: ReportFilters, targetCurrency?: string, user?: any) => {
        const { rows, currency } = await fetchDetailedRows(orgId, branchId, startDate, endDate, filters, targetCurrency, user);

        const map = new Map<string, any>();
        for (const row of rows) {
            const name = (row.party || '').trim();
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
            type: 'parties',
            tableData: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)),
            currency
        };
    },

    // 3. Account-wise Report (Enhanced with Opening/Closing Balance)
    getAccountWise: async (orgId: number, branchId: number | number[] | 'all', startDate: string, endDate: string, filters?: ReportFilters, targetCurrency?: string, user?: any) => {
        const types = await db.select().from(transactionTypes);
        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const finalCurrency = targetCurrency || orgList[0]?.baseCurrency || 'USD';

        const accountConditions: any[] = [
            eq(accounts.orgId, orgId),
            isNotDeleted(accounts),
            eq(accounts.status, 1)
        ];
        // GLOBAL: Accounts are unified
        appendDirectAccountFilter(accountConditions, accounts.id, filters?.accountId);

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
            isNotDeleted(transactions),
            eq(transactions.status, 1),
            lt(transactions.txnDate, startDate)
        ];
        // GLOBAL: Account past movements are global for consistent balance
        appendDirectAccountFilter(openingMovementConditions, transactionEntries.accountId, filters?.accountId);

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
            isNotDeleted(transactions),
            eq(transactions.status, 1),
            gte(transactions.txnDate, startDate),
            lte(transactions.txnDate, endDate)
        ];
        appendBranchFilter(periodMovementConditions, transactions.branchId, branchId, user);
        appendTxnAndCategoryFilters(periodMovementConditions, types, filters);
        appendDirectAccountFilter(periodMovementConditions, transactionEntries.accountId, filters?.accountId);

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

        const selectedAccountFilters = normalizeAccountFilters(filters?.accountId);
        const tableData = Array.from(accountMap.values())
            .map((item) => {
                const count = periodCountMap.get(item.accountId) || 0;
                return {
                    ...item,
                    count,
                    closingBalance: item.openingBalance + item.periodNet
                };
            })
            .filter((item) => (selectedAccountFilters.length > 0 ? true : item.count > 0))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(({ accountId, periodNet, ...rest }) => rest);

        return {
            type: 'accounts',
            tableData,
            currency: finalCurrency
        };
    },

    // 4. Detailed Report (Transactions List)
    getDetailed: async (orgId: number, branchId: number | number[] | 'all', startDate: string, endDate: string, filters?: ReportFilters, targetCurrency?: string, user?: any) => {
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
        filters?: ReportFilters
    ) => {
        const types = await db.select().from(transactionTypes);
        const incomeId = types.find(t => t.name === 'Income')?.id;
        const expenseId = types.find(t => t.name === 'Expense')?.id;
        const investmentId = types.find(t => t.name === 'Investment')?.id;
        const transferId = types.find(t => t.name === 'Transfer')?.id;

        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const org = orgList[0];
        const finalCurrency = targetCurrency || org?.baseCurrency || 'USD';

        const selectedLedgerAccountFilters = normalizeAccountFilters(filters?.accountId);
        if (selectedLedgerAccountFilters.length === 1) {
            const selectedLedgerAccountId = selectedLedgerAccountFilters[0] as number;
            const [selectedAccount] = await db.select({
                id: accounts.id,
                name: accounts.name,
                openingBalance: accounts.openingBalance,
                currencyCode: currencies.code
            })
                .from(accounts)
                .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
                .where(and(eq(accounts.orgId, orgId), eq(accounts.id, selectedLedgerAccountId), isNotDeleted(accounts), eq(accounts.status, 1)))
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
                isNotDeleted(transactions),
                eq(transactions.status, 1),
                lt(transactions.txnDate, startDate)
            ];
            appendDirectAccountFilter(accountPastConditions, transactionEntries.accountId, filters?.accountId);
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
                isNotDeleted(transactions),
                eq(transactions.status, 1),
                gte(transactions.txnDate, startDate),
                lte(transactions.txnDate, endDate)
            ];
            appendDirectAccountFilter(accountLedgerConditions, transactionEntries.accountId, filters?.accountId);
            appendBranchFilter(accountLedgerConditions, transactions.branchId, branchId, user);
            appendTxnAndCategoryFilters(accountLedgerConditions, types, filters);

            const accountLedgerRows = await db.select({
                entryId: transactionEntries.id,
                id: transactions.id,
                txnDate: transactions.txnDate,
                name: transactions.name,
                notes: transactions.notes,
                contact: sql<string>`COALESCE(${parties.companyName}, ${parties.name})`,
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
                    party: row.contact,
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
            isNotDeleted(transactions),
            eq(transactions.status, 1),
            lt(transactions.txnDate, startDate)
        ];
        appendBranchFilter(pastConditions, transactions.branchId, branchId, user);
        appendTxnAndCategoryFilters(pastConditions, types, filters);

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

        let initialAccountBalance = 0;
        
        const shouldIncludeLedgerInitialBalance = 
            (!branchId || branchId === 'all') && 
            !filters?.categoryId && 
            !filters?.party && 
            !hasActiveTxnTypeFilters(filters?.txnType);

        if (shouldIncludeLedgerInitialBalance) {
            const accountConditions: any[] = [
                eq(accounts.orgId, orgId),
                isNotDeleted(accounts)
            ];
            appendDirectAccountFilter(accountConditions, accounts.id, filters?.accountId);

            const accOpeningQuery = await db.select({
                openingBalance: accounts.openingBalance,
                currency: currencies.code
            })
                .from(accounts)
                .leftJoin(currencies, eq(accounts.currencyId, currencies.id))
                .where(and(...accountConditions));

            for (const acc of accOpeningQuery as any[]) {
                const converted = await ExchangeRateService.convert(Number(acc.openingBalance || 0), acc.currency || 'USD', finalCurrency);
                initialAccountBalance += converted;
            }
        }

        const finalOpeningBalance = initialAccountBalance + pastTxnsValue;

        const ledgerConditions: any[] = [
            eq(transactions.orgId, orgId),
            isNotDeleted(transactions),
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
            contact: sql<string>`COALESCE(${parties.companyName}, ${parties.name})`,
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
                party: t.contact,
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
        filters?: ReportFilters,
        targetCurrency?: string,
        user?: any
    ) => {
        const types = await db.select().from(transactionTypes);
        const incomeTypeId = types.find(t => (t.name || '').toLowerCase() === 'income')?.id;
        const expenseTypeId = types.find(t => (t.name || '').toLowerCase() === 'expense')?.id;

        const baseConditions: any[] = [
            eq(transactions.orgId, orgId),
            isNotDeleted(transactions),
            eq(transactions.status, 1),
            gte(transactions.txnDate, startDate),
            lte(transactions.txnDate, endDate)
        ];
        appendBranchFilter(baseConditions, transactions.branchId, branchId, user);

        // Apply optional filters
        if (filters?.txnTypeId) {
            baseConditions.push(eq(transactions.txnTypeId, filters.txnTypeId));
        } else if (hasActiveTxnTypeFilters(filters?.txnType)) {
            const typeIds = types
                .filter((type) => normalizeTxnTypeFilters(filters?.txnType).some((txnType) => type.name.toLowerCase() === txnType.toLowerCase()))
                .map((type) => Number(type.id))
                .filter(Boolean);

            const firstTypeId = typeIds[0];

            if (typeIds.length === 1 && firstTypeId !== undefined) {
                baseConditions.push(eq(transactions.txnTypeId, firstTypeId));
            } else if (typeIds.length > 1) {
                baseConditions.push(inArray(transactions.txnTypeId, typeIds));
            }
        } else if (incomeTypeId && expenseTypeId) {
            baseConditions.push(inArray(transactions.txnTypeId, [incomeTypeId, expenseTypeId]));
        }

        const categoryFilters = normalizeCategoryFilters(filters?.categoryId);
        const firstCategoryId = categoryFilters[0];
        if (categoryFilters.length === 1 && firstCategoryId !== undefined) {
            baseConditions.push(eq(transactions.categoryId, firstCategoryId));
        } else if (categoryFilters.length > 1) {
            baseConditions.push(inArray(transactions.categoryId, categoryFilters));
        }
        appendTransactionEntryAccountExistsFilter(baseConditions, transactions.id, filters?.accountId);
        const partyFilters = normalizePartyFilters(filters?.party);
        const firstPartyFilter = partyFilters[0];
        if (partyFilters.length === 1 && firstPartyFilter !== undefined) {
            baseConditions.push(sql`(
                EXISTS (SELECT 1 FROM parties p WHERE p.id = ${transactions.contactId} AND lower(COALESCE(p.company_name, p.name)) = lower(${firstPartyFilter}))
                OR lower(${transactions.name}) = lower(${firstPartyFilter})
            )`);
        } else if (partyFilters.length > 1) {
            const partyConditions = sql.join(
                partyFilters.map((partyName) => sql`lower(COALESCE(p.company_name, p.name)) = lower(${partyName})`),
                sql` OR `
            );
            const txnNameConditions = sql.join(
                partyFilters.map((partyName) => sql`lower(${transactions.name}) = lower(${partyName})`),
                sql` OR `
            );

            baseConditions.push(sql`(
                EXISTS (SELECT 1 FROM parties p WHERE p.id = ${transactions.contactId} AND (${partyConditions}))
                OR (${txnNameConditions})
            )`);
        }

        // Only include transactions that HAVE a category
        baseConditions.push(sql`${transactions.categoryId} IS NOT NULL`);

        const orgList = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
        const finalCurrency = targetCurrency || orgList[0]?.baseCurrency || 'USD';

        // Fetch rows: transaction amount grouped by type, category, sub-category, currency
        const rows = await db.select({
            txnTypeId: transactions.txnTypeId,
            categoryId: categories.id,
            categoryName: categories.name,
            subCategoryId: subCategories.id,
            subCategoryName: subCategories.name,
            currencyCode: currencies.code,
            totalLocal: sql<string>`SUM(COALESCE(${transactions.finalAmount}, ${transactions.amountLocal}))`
        })
            .from(transactions)
            .innerJoin(categories, eq(transactions.categoryId, categories.id))
            .leftJoin(subCategories, eq(transactions.subCategoryId, subCategories.id))
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .where(and(...baseConditions))
            .groupBy(
                transactions.txnTypeId,
                categories.id,
                categories.name,
                subCategories.id,
                subCategories.name,
                currencies.code
            );

        // Category → sub-category maps for income and expense
        type SubItem = { subCategory: string, amount: number };
        type CategoryGroup = { category: string, total: number, items: SubItem[] };

        const incomeMap = new Map<string, { total: number, itemMap: Map<string, number> }>();
        const expenseMap = new Map<string, { total: number, itemMap: Map<string, number> }>();

        for (const row of rows as any[]) {
            const amount = Number(row.totalLocal || 0);
            if (amount <= 0) continue;

            const converted = await ExchangeRateService.convert(
                amount,
                row.currencyCode || 'USD',
                finalCurrency
            );
            if (converted <= 0) continue;

            const isIncome = incomeTypeId && Number(row.txnTypeId) === Number(incomeTypeId);
            const isExpense = expenseTypeId && Number(row.txnTypeId) === Number(expenseTypeId);
            if (!isIncome && !isExpense) continue;

            const targetMap = isIncome ? incomeMap : expenseMap;
            const categoryName = (row.categoryName || '').toString().trim();
            if (!categoryName) continue; // Strictly exclude transactions with no category
            const subCategoryName = (row.subCategoryName || '').toString().trim();

            if (!targetMap.has(categoryName)) {
                targetMap.set(categoryName, { total: 0, itemMap: new Map() });
            }
            const group = targetMap.get(categoryName)!;
            group.total += converted;

            if (subCategoryName) {
                group.itemMap.set(subCategoryName, (group.itemMap.get(subCategoryName) || 0) + converted);
            }
        }

        const finalizeMap = (map: Map<string, { total: number, itemMap: Map<string, number> }>): CategoryGroup[] => {
            return Array.from(map.entries())
                .map(([category, value]) => ({
                    category,
                    total: value.total,
                    items: Array.from(value.itemMap.entries())
                        .map(([subCategory, amount]) => ({ subCategory, amount }))
                        .sort((a, b) => b.amount - a.amount)
                }))
                .sort((a, b) => b.total - a.total);
        };

        const incomes = finalizeMap(incomeMap);
        const expenses = finalizeMap(expenseMap);

        const totalIncome = incomes.reduce((sum, g) => sum + g.total, 0);
        const totalExpense = expenses.reduce((sum, g) => sum + g.total, 0);
        const diff = totalIncome - totalExpense;

        const netProfit = diff >= 0 ? diff : 0;
        const netLoss = diff < 0 ? Math.abs(diff) : 0;
        const totalLeft = diff >= 0 ? totalExpense + diff : totalExpense;
        const totalRight = diff < 0 ? totalIncome + Math.abs(diff) : totalIncome;

        return {
            type: 'profit-loss',
            currency: finalCurrency,
            data: {
                expenses,
                incomes,
                totalExpense,
                totalIncome,
                netProfit,
                netLoss,
                totalLeft,
                totalRight
            },
            summary: {
                totalIncome,
                totalExpense,
                netProfit: diff,
                income: totalIncome,
                expense: totalExpense,
                net: diff
            }
        };
    }
};
