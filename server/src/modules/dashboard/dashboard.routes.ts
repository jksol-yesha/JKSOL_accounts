import { Elysia, t } from 'elysia';
import * as DashboardController from './dashboard.controller';
import { authMiddleware } from '../../shared/auth.middleware';

export const dashboardRoutes = new Elysia({ prefix: '/dashboard' })
    .use(authMiddleware)
    .post('/summary', DashboardController.getSummary, {
        validateAccess: 'branch',
        body: t.Object({
            financialYearId: t.Numeric(),
            branchId: t.Optional(t.Union([t.Numeric(), t.Literal('all'), t.Array(t.Numeric())])),
            targetCurrency: t.Optional(t.String()),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String())
        })
    })
    .post('/trends', DashboardController.getTrends, {
        validateAccess: 'branch',
        body: t.Object({
            financialYearId: t.Numeric(),
            compareFinancialYearId: t.Optional(t.Numeric()),
            branchId: t.Optional(t.Union([t.Numeric(), t.Literal('all'), t.Array(t.Numeric())])),
            targetCurrency: t.Optional(t.String()),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String()),
            compareStartDate: t.Optional(t.String()),
            compareEndDate: t.Optional(t.String())
        })
    })
    .post('/rankings', DashboardController.getRankings, {
        validateAccess: 'branch',
        body: t.Object({
            financialYearId: t.Numeric(),
            branchId: t.Optional(t.Union([t.Numeric(), t.Literal('all'), t.Array(t.Numeric())])),
            targetCurrency: t.Optional(t.String()),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String())
        })
    })
    .post('/account-balance-trend', DashboardController.getAccountBalanceTrend, {
        validateAccess: 'branch',
        body: t.Object({
            financialYearId: t.Numeric(),
            branchId: t.Optional(t.Union([t.Numeric(), t.Literal('all'), t.Array(t.Numeric())])),
            timeframe: t.Union([t.Literal('30D'), t.Literal('12M')]),
            targetCurrency: t.Optional(t.String())
        })
    });
