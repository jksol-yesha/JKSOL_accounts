import { db } from '../../db';
import { transactions, transactionEntries, categories, subCategories, accounts, transactionTypes, branches, organizations, currencies, parties } from '../../db/schema';
import { eq, and, or, sql, gte, lte, lt, desc, asc, inArray } from 'drizzle-orm';
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
    if (filters?.accountId) {
        conditions.push(sql`EXISTS (SELECT 1 FROM transaction_entries te WHERE te.transaction_id = ${transactions.id} AND te.account_id = ${filters.accountId})`);
    }
    if (filters?.party && filters.party !== 'All Parties') {
        conditions.push(sql`(
            EXISTS (SELECT 1 FROM parties p WHERE p.id = ${transactions.contactId} AND lower(COALESCE(p.company_name, p.name)) = lower(${filters.party}))
            OR lower(${transactions.name}) = lower(${filters.party})
        )`);
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
                    if (reportData?.type === 'categories' || reportData?.type === 'accounts') {
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
            } else if (reportData?.type === 'categories' || reportData?.type === 'accounts') {
                headers = [reportData.type === 'categories' ? 'Category' : 'Account Name', 'Opening Balance', 'Income', 'Expense', 'Investment', 'Closing Balance', 'Count'];
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
        reportMeta?: { organizationName?: string, startDate?: string, endDate?: string }
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
        const renderTable = (headers: string[], rows: string[][]) => `
            <table>
                <thead>
                    <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${rows.map((row) => `
                        <tr>
                            ${row.map((value, index) => `<td${index === row.length - 1 ? ' style="text-align:right;"' : ''}>${escapeHtml(value)}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
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
            const currencyCode = String(reportData?.currency || 'USD').toUpperCase();
            const formatCurrency = (val: number, showZero = false) => {
                const amount = Number(val || 0);
                if (!showZero && amount === 0) return '';

                try {
                    return new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: currencyCode,
                        currencyDisplay: 'narrowSymbol',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(amount);
                } catch {
                    return new Intl.NumberFormat('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(amount);
                }
            };

            type PnlRow = {
                type: 'section' | 'category';
                name: string;
                total?: number;
                amount?: number;
            };

            const leftRows: PnlRow[] = [];
            const rightRows: PnlRow[] = [];

            // Dynamically add all expense categories
            (d.expenses || []).forEach((group: any) => {
                leftRows.push({ type: 'section', name: group.category, total: group.total });
                (group.items || []).forEach((item: any) => {
                    leftRows.push({ type: 'category', name: item.subCategory, amount: item.amount });
                });
            });

            if (d.netProfit > 0) {
                leftRows.push({ type: 'section', name: 'Nett Profit', total: d.netProfit });
            }

            // Dynamically add all income categories
            (d.incomes || []).forEach((group: any) => {
                rightRows.push({ type: 'section', name: group.category, total: group.total });
                (group.items || []).forEach((item: any) => {
                    rightRows.push({ type: 'category', name: item.subCategory, amount: item.amount });
                });
            });

            if (d.netLoss > 0) {
                rightRows.push({ type: 'section', name: 'Nett Loss', total: d.netLoss });
            }

            const maxRows = Math.max(leftRows.length, rightRows.length);
            const rowsHtml = [];
            for (let i = 0; i < maxRows; i++) {
                const left = leftRows[i];
                const right = rightRows[i];

                rowsHtml.push(`
                    <tr class="pnl-data-row">
                        <td class="pnl-particulars ${left?.type === 'section' ? 'pnl-section pnl-section-start' : left?.type === 'category' ? 'pnl-category' : 'pnl-empty'}">
                            ${left?.name ? escapeHtml(left.name) : ''}
                        </td>
                        <td class="pnl-sub-amount text-right ${left?.type === 'section' ? 'pnl-section-start' : left?.type === 'category' ? 'pnl-category-amount' : 'pnl-empty'}">
                            ${left?.type === 'category' ? formatCurrency(left.amount || 0) : ''}
                        </td>
                        <td class="pnl-total-amount text-right pnl-side-divider ${left?.type === 'section' ? 'pnl-section-start pnl-section-total' : left?.type === 'category' ? 'pnl-category-total' : 'pnl-empty'}">
                            ${left?.type === 'section' ? formatCurrency(left.total || 0) : ''}
                        </td>
                        <td class="pnl-particulars ${right?.type === 'section' ? 'pnl-section pnl-section-start' : right?.type === 'category' ? 'pnl-category' : 'pnl-empty'}">
                            ${right?.name ? escapeHtml(right.name) : ''}
                        </td>
                        <td class="pnl-sub-amount text-right ${right?.type === 'section' ? 'pnl-section-start' : right?.type === 'category' ? 'pnl-category-amount' : 'pnl-empty'}">
                            ${right?.type === 'category' ? formatCurrency(right.amount || 0) : ''}
                        </td>
                        <td class="pnl-total-amount text-right ${right?.type === 'section' ? 'pnl-section-start pnl-section-total' : right?.type === 'category' ? 'pnl-category-total' : 'pnl-empty'}">
                            ${right?.type === 'section' ? formatCurrency(right.total || 0) : ''}
                        </td>
                    </tr>
                `);
            }

            const formatDateExact = (val?: string) => {
                if (!val) return '';
                const date = new Date(val);
                if (Number.isNaN(date.getTime())) return '';
                const day = date.getDate();
                const month = date.toLocaleString('en-GB', { month: 'short' });
                const year = date.getFullYear().toString().slice(-2);
                return `${day}-${month}-${year}`;
            };

            const headerRange = (reportMeta?.startDate && reportMeta?.endDate)
                ? `${formatDateExact(reportMeta.startDate)} to ${formatDateExact(reportMeta.endDate)}`
                : (selectedDateRange || '-');

            content = `
                <div class="pnl-container">
                    <div class="pnl-header">
                        <div class="org-name">${escapeHtml(reportMeta?.organizationName || '')}</div>
                        <div class="pnl-title">Profit &amp; Loss Statement</div>
                        <div class="pnl-period">${escapeHtml(headerRange)}</div>
                    </div>
                    <table class="pnl-table">
                        <thead>
                            <tr class="pnl-column-row">
                                <th>Particulars</th>
                                <th class="text-right">Amount</th>
                                <th class="text-right pnl-side-divider">Total</th>
                                <th>Particulars</th>
                                <th class="text-right">Amount</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml.join('')}
                        </tbody>
                        <tfoot>
                            <tr class="pnl-total-row">
                                <td class="pnl-total-label">Total</td>
                                <td class="pnl-total-cell pnl-side-divider" colspan="2">
                                    ${formatCurrency(d.totalLeft || 0, true)}
                                </td>
                                <td class="pnl-total-label">Total</td>
                                <td class="pnl-total-cell" colspan="2">
                                    ${formatCurrency(d.totalRight || 0, true)}
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
        } else if (reportData?.type === 'categories' || reportData?.type === 'accounts') {
            const nameHeader = reportData.type === 'categories' ? 'Category' : 'Account Name';
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
                    @page { margin: 0mm; }
                    body { font-family: Arial, sans-serif; padding: 20mm; color: #111827; }
                    body.pnl-body {
                        font-family: Inter, Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                        padding: 20mm 15mm;
                        color: #0f172a;
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
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th, td { border: 1px solid #e5e7eb; padding: 6px 8px; vertical-align: top; }
                    th { background: #f8fafc; text-align: left; font-weight: 700; }
                    tbody tr:nth-child(even) { background: #fcfcfd; }

                    /* Profit & Loss Specific Styles */
                    .pnl-container { padding: 0; max-width: 1080px; margin: 0 auto; }
                    .pnl-header {
                        text-align: center;
                        margin: 0 auto 24px;
                        color: #0f172a;
                    }
                    .pnl-header .org-name {
                        font-size: 26px;
                        font-weight: 800;
                        letter-spacing: 0.02em;
                        margin-bottom: 8px;
                        color: #0f172a;
                    }
                    .pnl-header .pnl-title {
                        font-size: 18px;
                        font-weight: 700;
                        margin-bottom: 4px;
                        color: #111827;
                    }
                    .pnl-header .pnl-period {
                        font-size: 11px;
                        font-weight: 500;
                        color: #64748b;
                    }

                    .pnl-table {
                        border-collapse: collapse;
                        table-layout: fixed;
                        width: 100%;
                        font-size: 11px;
                        border-top: 1px solid #d9e1ea;
                        border-bottom: 1px solid #d9e1ea;
                    }
                    .pnl-table th,
                    .pnl-table td {
                        border: none;
                        padding: 7px 10px;
                        vertical-align: top;
                    }
                    .pnl-table tbody tr { background: transparent !important; }
                    .pnl-table thead th {
                        background: transparent;
                        color: #475569;
                    }
                    .pnl-side-row th {
                        font-size: 10px;
                        font-weight: 700;
                        letter-spacing: 0.12em;
                        text-transform: uppercase;
                        padding-top: 0;
                        padding-bottom: 10px;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    .pnl-column-row th {
                        font-size: 10px;
                        font-weight: 700;
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                        padding-top: 8px;
                        padding-bottom: 8px;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    .pnl-side-heading { text-align: left; }
                    .pnl-particulars { width: 30%; }
                    .pnl-sub-amount {
                        width: 10%;
                        font-size: 10.75px;
                        color: #334155;
                    }
                    .pnl-total-amount {
                        width: 10%;
                        font-size: 11px;
                        color: #0f172a;
                    }
                    .pnl-side-divider { border-right: 1px solid #e2e8f0 !important; }
                    .pnl-data-row td { border-bottom: 1px solid #f1f5f9; }
                    .pnl-section-start { border-top: 1px solid #e5e7eb !important; padding-top: 13px !important; }
                    .pnl-section {
                        font-weight: 700;
                        font-size: 12px;
                        color: #0f172a;
                        white-space: nowrap;
                    }
                    .pnl-section-total {
                        font-weight: 700;
                        font-size: 12px;
                    }
                    .pnl-category {
                        padding-left: 18px !important;
                        font-size: 11px;
                        font-weight: 500;
                        color: #334155;
                    }
                    .pnl-category-amount {
                        font-size: 10.75px;
                        color: #334155;
                    }
                    .pnl-category-total,
                    .pnl-empty {
                        color: transparent;
                    }
                    .pnl-total-row td {
                        padding-top: 10px;
                        padding-bottom: 10px;
                        border-top: 1.5px solid #cbd5e1;
                        border-bottom: 2px solid #94a3b8;
                        background: transparent;
                    }
                    .pnl-total-label {
                        font-size: 10px;
                        font-weight: 800;
                        letter-spacing: 0.16em;
                        text-transform: uppercase;
                        color: #0f172a;
                    }
                    .pnl-total-cell {
                        font-size: 12px;
                        font-weight: 800;
                        text-align: right;
                        color: #0f172a;
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
            isNotDeleted(transactions),
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
            .where(and(eq(accounts.orgId, orgId), isNotDeleted(accounts), eq(accounts.status, 1)));

        let initialAccountBalance = 0;
        for (const acc of accountRows) {
            initialAccountBalance += await ExchangeRateService.convert(Number(acc.openingBalance || 0), acc.currencyCode || 'USD', finalCurrency);
        }

        const openingBalance = initialAccountBalance + (opIn - opOut - opInv);

        // 2. Current Period Totals
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
            isNotDeleted(accounts),
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
            isNotDeleted(transactions),
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
            isNotDeleted(transactions),
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
                .where(and(eq(accounts.orgId, orgId), eq(accounts.id, filters.accountId), isNotDeleted(accounts), eq(accounts.status, 1)))
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
                isNotDeleted(transactions),
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
            isNotDeleted(accounts),
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
        filters?: { txnType?: string, txnTypeId?: number, categoryId?: number, accountId?: number, party?: string },
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
        } else if (filters?.txnType && filters.txnType !== 'All Types') {
            const typeId = types.find(t => t.name.toLowerCase() === filters.txnType?.toLowerCase())?.id;
            if (typeId) baseConditions.push(eq(transactions.txnTypeId, typeId));
        } else if (incomeTypeId && expenseTypeId) {
            baseConditions.push(inArray(transactions.txnTypeId, [incomeTypeId, expenseTypeId]));
        }

        if (filters?.categoryId) {
            baseConditions.push(eq(transactions.categoryId, filters.categoryId));
        }
        if (filters?.accountId) {
            baseConditions.push(sql`EXISTS (SELECT 1 FROM transaction_entries te WHERE te.transaction_id = ${transactions.id} AND te.account_id = ${filters.accountId})`);
        }
        if (filters?.party && filters.party !== 'All Parties') {
            baseConditions.push(sql`(
                EXISTS (SELECT 1 FROM parties p WHERE p.id = ${transactions.contactId} AND lower(COALESCE(p.company_name, p.name)) = lower(${filters.party}))
                OR lower(${transactions.name}) = lower(${filters.party})
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
