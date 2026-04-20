
import { ReportsService } from './reports.service';
import type { ElysiaContext } from '../../shared/auth.middleware';
import { db } from '../../db';
import { branches, organizations } from '../../db/schema';
import { and, eq, inArray } from 'drizzle-orm';

const parseBranchValue = (raw: any): number | number[] | 'all' | null => {
    if (raw === undefined || raw === null || raw === '') return null;
    if (raw === 'all') return 'all';
    if (Array.isArray(raw)) {
        const ids = raw.map(Number).filter(Boolean);
        return ids.length ? ids : null;
    }
    const str = String(raw).trim();
    if (str.includes(',')) {
        const ids = str.split(',').map(s => Number(s.trim())).filter(Boolean);
        return ids.length ? ids : null;
    }
    const num = Number(str);
    return Number.isFinite(num) && num > 0 ? num : null;
};

const parseNumeric = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = Number(val);
    return Number.isFinite(num) && num > 0 ? num : undefined;
};

const buildReportHeaderName = async (
    orgId: number,
    branchId: number | number[] | 'all'
) => {
    const [orgRow] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

    const organizationName = orgRow?.name || '';
    if (!organizationName || branchId === 'all') return organizationName;

    let branchRows: Array<{ name: string }> = [];
    if (Array.isArray(branchId)) {
        if (branchId.length === 0) return organizationName;
        branchRows = await db
            .select({ name: branches.name })
            .from(branches)
            .where(and(eq(branches.orgId, orgId), inArray(branches.id, branchId)));
    } else {
        branchRows = await db
            .select({ name: branches.name })
            .from(branches)
            .where(and(eq(branches.orgId, orgId), eq(branches.id, branchId)))
            .limit(1);
    }

    const branchNames = branchRows
        .map((row) => String(row?.name || '').trim())
        .filter(Boolean);

    if (branchNames.length === 0) return organizationName;

    return `${organizationName} - ${branchNames.join(', ')}`;
};

export const generateReport = async ({ body, set, headers, user, orgId, branchId: contextBranchId }: ElysiaContext & { body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const rawBranchId = body.branchId ?? contextBranchId;
        const branchId: number | number[] | 'all' = rawBranchId === 'all'
            ? 'all'
            : (Array.isArray(rawBranchId) ? rawBranchId.map(Number).filter(Boolean) : Number(rawBranchId));
        const reportType = body.type; // 'Summary', 'Detailed', 'Category-wise', 'Account-wise', 'Debit/Credit', 'Profit/Loss'
        const startDate = body.startDate;
        const endDate = body.endDate;
        const targetCurrency = body.targetCurrency || headers['x-base-currency'];

        // Optional Filters
        const filters = {
            txnType: body.txnType,
            categoryId: body.categoryId ? Number(body.categoryId) : undefined,
            accountId: body.accountId ? Number(body.accountId) : undefined,
            party: body.party ? String(body.party) : undefined
        };

        if (!branchId || !startDate || !endDate || !reportType || (Array.isArray(branchId) && branchId.length === 0)) {
            set.status = 400;
            return { success: false, message: 'Missing required parameters: branchId, type, startDate, endDate' };
        }

        // Branch access check for MEMBERS
        if (user.role === 'member') {
            if (branchId === 'all') {
                if (!user.branchIds || user.branchIds.length === 0) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You have no assigned branches' };
                }
            } else if (Array.isArray(branchId)) {
                const allowed = branchId.some(bid => user.branchIds.includes(Number(bid)));
                if (!allowed) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You do not have access to selected branches' };
                }
            } else if (!user.branchIds.includes(Number(branchId))) {
                set.status = 403;
                return { success: false, message: 'Forbidden: You do not have access to this branch' };
            }
        }

        let data;

        switch (reportType) {
            case 'Summary':
                const summary = await ReportsService.getSummary(orgId, branchId, startDate, endDate, filters, targetCurrency, user);
                const list = await ReportsService.getDetailed(orgId, branchId, startDate, endDate, filters, targetCurrency, user);
                data = { summary, tableData: list.tableData, type: 'transactions', currency: list.currency };
                break;

            case 'Detailed':
                data = await ReportsService.getDetailed(orgId, branchId, startDate, endDate, filters, targetCurrency, user);
                break;

            case 'Category-wise':
                data = await ReportsService.getCategoryWise(orgId, branchId, startDate, endDate, filters, targetCurrency, user);
                break;

            case 'Account-wise':
                data = await ReportsService.getAccountWise(orgId, branchId, startDate, endDate, filters, targetCurrency, user);
                break;

            case 'Debit/Credit':
                data = await ReportsService.getLedger(orgId, branchId, startDate, endDate, targetCurrency, user, filters);
                break;

            case 'Profit/Loss':
            case 'Profit & Loss':
                data = await ReportsService.getProfitLoss(orgId, branchId, startDate, endDate, filters, targetCurrency, user);
                break;

            default:
                set.status = 400;
                return { success: false, message: 'Invalid report type' };
        }

        return { success: true, data: data };

    } catch (error: any) {
        console.error('Reports Error:', error);
        set.status = 500;
        return { success: false, message: error.message || 'Failed to generate report' };
    }
};

export const exportReport = async ({ body, set, headers, user, orgId, branchId: contextBranchId }: ElysiaContext & { body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const rawBranchId = body.branchId ?? contextBranchId;
        const branchId: number | number[] | 'all' = rawBranchId === 'all'
            ? 'all'
            : (Array.isArray(rawBranchId) ? rawBranchId.map(Number).filter(Boolean) : Number(rawBranchId));
        const reportType = body.type;
        const startDate = body.startDate;
        const endDate = body.endDate;
        const targetCurrency = body.targetCurrency || headers['x-base-currency'];
        const format = body.format === 'pdf' ? 'pdf' : 'csv';

        const filters = {
            txnType: body.txnType,
            categoryId: body.categoryId ? Number(body.categoryId) : undefined,
            accountId: body.accountId ? Number(body.accountId) : undefined,
            party: body.party ? String(body.party) : undefined
        };

        if (!branchId || !startDate || !endDate || !reportType || (Array.isArray(branchId) && branchId.length === 0)) {
            set.status = 400;
            return { success: false, message: 'Missing required parameters: branchId, type, startDate, endDate' };
        }

        if (user.role === 'member') {
            if (branchId === 'all') {
                if (!user.branchIds || user.branchIds.length === 0) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You have no assigned branches' };
                }
            } else if (Array.isArray(branchId)) {
                const allowed = branchId.some(bid => user.branchIds.includes(Number(bid)));
                if (!allowed) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You do not have access to selected branches' };
                }
            } else if (!user.branchIds.includes(Number(branchId))) {
                set.status = 403;
                return { success: false, message: 'Forbidden: You do not have access to this branch' };
            }
        }

        let data;

        switch (reportType) {
            case 'Summary': {
                const summary = await ReportsService.getSummary(orgId, branchId, startDate, endDate, filters, targetCurrency, user);
                const list = await ReportsService.getDetailed(orgId, branchId, startDate, endDate, filters, targetCurrency, user);
                data = { summary, tableData: list.tableData, type: 'transactions', currency: list.currency };
                break;
            }
            case 'Detailed':
                data = await ReportsService.getDetailed(orgId, branchId, startDate, endDate, filters, targetCurrency, user);
                break;
            case 'Category-wise':
                data = await ReportsService.getCategoryWise(orgId, branchId, startDate, endDate, filters, targetCurrency, user);
                break;
            case 'Account-wise':
                data = await ReportsService.getAccountWise(orgId, branchId, startDate, endDate, filters, targetCurrency, user);
                break;
            case 'Debit/Credit':
                data = await ReportsService.getLedger(orgId, branchId, startDate, endDate, targetCurrency, user, filters);
                break;
            case 'Profit/Loss':
            case 'Profit & Loss':
                data = await ReportsService.getProfitLoss(orgId, branchId, startDate, endDate, filters, targetCurrency, user);
                break;
            default:
                set.status = 400;
                return { success: false, message: 'Invalid report type' };
        }

        if (format === 'pdf') {
            const headerOrganizationName = await buildReportHeaderName(orgId, branchId);
            const html = ReportsService.buildPrintableHtml(data, reportType, body.searchTerm, {
                organizationName: headerOrganizationName,
                startDate,
                endDate
            });
            set.headers['content-type'] = 'text/html; charset=utf-8';
            set.headers['content-disposition'] = 'inline; filename="reports.html"';
            return new Response(html, {
                headers: {
                    'content-type': 'text/html; charset=utf-8',
                    'content-disposition': 'inline; filename="reports.html"'
                }
            });
        }

        const csvContent = ReportsService.buildExportCsv(data, reportType, body.searchTerm);
        const fileName = `reports-${new Date().toISOString().slice(0, 10)}.csv`;

        return {
            success: true,
            data: {
                fileName,
                mimeType: 'text/csv;charset=utf-8',
                fileContent: Buffer.from(csvContent, 'utf-8').toString('base64')
            }
        };
    } catch (error: any) {
        console.error('Report Export Error:', error);
        set.status = 500;
        return { success: false, message: error.message || 'Failed to export report' };
    }
};

export const getProfitLossReport = async ({ query, set, headers, user, orgId, branchId: contextBranchId }: ElysiaContext & { query: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const source = query || {};
        const branchFromQuery = parseBranchValue(source.branchId);
        const branchId = branchFromQuery ?? (contextBranchId === null ? null : contextBranchId);
        const startDate = source.startDate;
        const endDate = source.endDate;

        if (!branchId || !startDate || !endDate || (Array.isArray(branchId) && branchId.length === 0)) {
            set.status = 400;
            return { success: false, message: 'Missing required parameters: branchId, startDate, endDate' };
        }

        if (user.role === 'member') {
            if (branchId === 'all') {
                if (!user.branchIds || user.branchIds.length === 0) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You have no assigned branches' };
                }
            } else if (Array.isArray(branchId)) {
                const allowed = branchId.some(bid => user.branchIds.includes(Number(bid)));
                if (!allowed) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You do not have access to selected branches' };
                }
            } else if (!user.branchIds.includes(Number(branchId))) {
                set.status = 403;
                return { success: false, message: 'Forbidden: You do not have access to this branch' };
            }
        }

        const filters = {
            categoryId: parseNumeric(source.categoryId),
            accountId: parseNumeric(source.accountId),
            txnTypeId: parseNumeric(source.txnTypeId),
            party: source.party ? String(source.party) : undefined
        };

        const targetCurrency = source.targetCurrency || headers['x-base-currency'];

        const result = await ReportsService.getProfitLoss(
            orgId,
            branchId as any,
            startDate,
            endDate,
            filters as any,
            targetCurrency,
            user
        );

        return {
            success: true,
            data: {
                summary: result.summary,
                income: result.data.incomes,
                expenses: result.data.expenses,
                currency: result.currency
            }
        };
    } catch (error: any) {
        console.error('Profit/Loss Error:', error);
        set.status = 500;
        return { success: false, message: error.message || 'Failed to generate profit/loss report' };
    }
};

export const postProfitLossReport = async ({ body, set, headers, user, orgId, branchId: contextBranchId }: ElysiaContext & { body: any }) => {
    return getProfitLossReport({
        query: body,
        set,
        headers,
        user,
        orgId,
        branchId: contextBranchId
    } as any);
};
