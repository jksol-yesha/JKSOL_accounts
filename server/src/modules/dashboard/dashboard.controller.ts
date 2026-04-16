import { DashboardService } from './dashboard.service';
import type { ElysiaContext } from '../../shared/auth.middleware';

export const getSummary = async ({ body, set, user, orgId, branchId: contextBranchId, headers }: ElysiaContext & { body: any & { branchId?: number | number[] | 'all' } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const financialYearId = Number(body.financialYearId);
        const rawBranchId = body.branchId ?? contextBranchId;

        // Robust check: allow 'all' or specific number string/value
        if ((!rawBranchId && rawBranchId !== 0) || (Array.isArray(rawBranchId) && rawBranchId.length === 0)) {
            set.status = 400;
            return { success: false, message: 'Branch ID (header/body) is required' };
        }
        if (!financialYearId) {
            set.status = 400;
            return { success: false, message: 'Financial Year ID is required' };
        }

        const finalBranchId = rawBranchId === 'all'
            ? null
            : (Array.isArray(rawBranchId) ? rawBranchId.map(Number).filter(Boolean) : Number(rawBranchId));
        const targetCurrency = headers['x-base-currency'] || body.targetCurrency;

        // Branch access check for MEMBERS
        if (user.role === 'member') {
            const userBranchIds = user.branchIds || [];
            if (rawBranchId === 'all') {
                if (userBranchIds.length === 0) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You have no assigned branches' };
                }
            } else if (Array.isArray(rawBranchId)) {
                const allowed = rawBranchId.some(bid => userBranchIds.includes(Number(bid)));
                if (!allowed) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You do not have access to selected branches' };
                }
            } else if (!userBranchIds.includes(Number(rawBranchId))) {
                set.status = 403;
                return { success: false, message: 'Forbidden: You do not have access to this branch' };
            }
        }

        const startDate = body.startDate || undefined;
        const endDate = body.endDate || undefined;

        const summary = await DashboardService.getSummary(orgId, finalBranchId, financialYearId, targetCurrency, user, startDate, endDate);
        return { success: true, data: summary };
    } catch (error: any) {
        console.error('Dashboard Summary Error:', error);
        set.status = 500;
        return { success: false, message: error.message || 'Failed to fetch dashboard summary' };
    }
};

export const getTrends = async ({ body, set, user, orgId, branchId: contextBranchId, headers }: ElysiaContext & { body: any & { branchId?: number | number[] | 'all', compareFinancialYearId?: number } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const financialYearId = Number(body.financialYearId);
        const compareFinancialYearId = body.compareFinancialYearId ? Number(body.compareFinancialYearId) : undefined;
        const rawBranchId = body.branchId ?? contextBranchId;

        if ((!rawBranchId && rawBranchId !== 0) || (Array.isArray(rawBranchId) && rawBranchId.length === 0)) {
            set.status = 400;
            return { success: false, message: 'Branch ID (header/body) is required' };
        }
        if (!financialYearId) {
            set.status = 400;
            return { success: false, message: 'Financial Year ID is required' };
        }

        const finalBranchId = rawBranchId === 'all'
            ? null
            : (Array.isArray(rawBranchId) ? rawBranchId.map(Number).filter(Boolean) : Number(rawBranchId));
        const targetCurrency = headers['x-base-currency'] || body.targetCurrency;

        if (user.role === 'member') {
            const userBranchIds = user.branchIds || [];
            if (rawBranchId === 'all') {
                if (userBranchIds.length === 0) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You have no assigned branches' };
                }
            } else if (Array.isArray(rawBranchId)) {
                const allowed = rawBranchId.some(bid => userBranchIds.includes(Number(bid)));
                if (!allowed) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You do not have access to selected branches' };
                }
            } else if (!userBranchIds.includes(Number(rawBranchId))) {
                set.status = 403;
                return { success: false, message: 'Forbidden: You do not have access to this branch' };
            }
        }

        const startDate = body.startDate || undefined;
        const endDate = body.endDate || undefined;
        const compareStartDate = body.compareStartDate || undefined;
        const compareEndDate = body.compareEndDate || undefined;

        const trends = await DashboardService.getTrends(
            orgId,
            finalBranchId,
            financialYearId,
            compareFinancialYearId,
            targetCurrency,
            user,
            startDate,
            endDate,
            compareStartDate,
            compareEndDate
        );

        return { success: true, data: trends };
    } catch (error: any) {
        console.error('Dashboard Trends Error:', error);
        set.status = 500;
        return { success: false, message: error.message || 'Failed to fetch dashboard trends' };
    }
};

export const getRankings = async ({ body, set, user, orgId, branchId: contextBranchId, headers }: ElysiaContext & { body: any & { branchId?: number | number[] | 'all' } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const financialYearId = Number(body.financialYearId);
        const rawBranchId = body.branchId ?? contextBranchId;

        if ((!rawBranchId && rawBranchId !== 0) || (Array.isArray(rawBranchId) && rawBranchId.length === 0)) {
            set.status = 400;
            return { success: false, message: 'Branch ID (header/body) is required' };
        }
        if (!financialYearId) {
            set.status = 400;
            return { success: false, message: 'Financial Year ID is required' };
        }

        const finalBranchId = rawBranchId === 'all'
            ? null
            : (Array.isArray(rawBranchId) ? rawBranchId.map(Number).filter(Boolean) : Number(rawBranchId));
        const targetCurrency = headers['x-base-currency'] || body.targetCurrency;

        // Branch access check for MEMBERS
        if (user.role === 'member') {
            const userBranchIds = user.branchIds || [];
            if (rawBranchId === 'all') {
                if (userBranchIds.length === 0) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You have no assigned branches' };
                }
            } else if (Array.isArray(rawBranchId)) {
                const allowed = rawBranchId.some(bid => userBranchIds.includes(Number(bid)));
                if (!allowed) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You do not have access to selected branches' };
                }
            } else if (!userBranchIds.includes(Number(rawBranchId))) {
                set.status = 403;
                return { success: false, message: 'Forbidden: You do not have access to this branch' };
            }
        }

        const startDate = body.startDate || undefined;
        const endDate = body.endDate || undefined;

        const rankings = await DashboardService.getCategoryRankings(orgId, finalBranchId, financialYearId, targetCurrency, user, startDate, endDate);
        return { success: true, data: rankings };
    } catch (error: any) {
        console.error('Dashboard Rankings Error:', error);
        set.status = 500;
        return { success: false, message: error.message || 'Failed to fetch category rankings' };
    }
};

export const getAccountBalanceTrend = async ({ body, set, user, orgId, branchId: contextBranchId, headers }: ElysiaContext & { body: any & { branchId?: number | number[] | 'all', timeframe: '30D' | '12M' } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const financialYearId = Number(body.financialYearId);
        const timeframe = body.timeframe || '30D';
        const rawBranchId = body.branchId ?? contextBranchId;

        if ((!rawBranchId && rawBranchId !== 0) || (Array.isArray(rawBranchId) && rawBranchId.length === 0)) {
            set.status = 400;
            return { success: false, message: 'Branch ID (header/body) is required' };
        }
        if (!financialYearId) {
            set.status = 400;
            return { success: false, message: 'Financial Year ID is required' };
        }

        const finalBranchId = rawBranchId === 'all'
            ? null
            : (Array.isArray(rawBranchId) ? rawBranchId.map(Number).filter(Boolean) : Number(rawBranchId));
        const targetCurrency = headers['x-base-currency'] || body.targetCurrency;

        // Branch access check for MEMBERS
        if (user.role === 'member') {
            const userBranchIds = user.branchIds || [];
            if (rawBranchId === 'all') {
                if (userBranchIds.length === 0) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You have no assigned branches' };
                }
            } else if (Array.isArray(rawBranchId)) {
                const allowed = rawBranchId.some(bid => userBranchIds.includes(Number(bid)));
                if (!allowed) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You do not have access to selected branches' };
                }
            } else if (!userBranchIds.includes(Number(rawBranchId))) {
                set.status = 403;
                return { success: false, message: 'Forbidden: You do not have access to this branch' };
            }
        }

        const trend = await DashboardService.getAccountBalanceTrend(
            orgId,
            finalBranchId,
            financialYearId,
            timeframe as '30D' | '12M',
            targetCurrency,
            user
        );

        return { success: true, data: trend };
    } catch (error: any) {
        console.error('Account Balance Trend Error:', error);
        if (error?.cause) {
            console.error('Account Balance Trend Cause:', error.cause);
        }
        set.status = 500;
        return {
            success: false,
            message: error?.cause?.sqlMessage || error?.cause?.message || error?.message || 'Failed to fetch account balance trend'
        };
    }
};
