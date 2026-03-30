import { Elysia, t } from 'elysia';
import * as ReportsController from './reports.controller';
import { authMiddleware } from '../../shared/auth.middleware';

export const reportsRoutes = new Elysia({ prefix: '/reports' })
    .use(authMiddleware)
    .get('/profit-loss', ReportsController.getProfitLossReport, {
        validateAccess: 'branch',
        query: t.Object({
            startDate: t.String(),
            endDate: t.String(),
            branchId: t.Optional(t.String()),
            categoryId: t.Optional(t.String()),
            accountId: t.Optional(t.String()),
            txnTypeId: t.Optional(t.String()),
            party: t.Optional(t.String()),
            targetCurrency: t.Optional(t.String())
        })
    })
    .post('/profit-loss', ReportsController.postProfitLossReport, {
        validateAccess: 'branch',
        body: t.Any()
    })
    .post('/generate-report', ReportsController.generateReport, {
        validateAccess: 'branch',
        body: t.Object({
            branchId: t.Union([t.Numeric(), t.Literal('all'), t.Array(t.Numeric())]),
            type: t.String(),
            startDate: t.String(),
            endDate: t.String(),
            txnType: t.Optional(t.String()),
            categoryId: t.Optional(t.Numeric()),
            accountId: t.Optional(t.Numeric()),
            party: t.Optional(t.String()),
            targetCurrency: t.Optional(t.String())
        })
    })
    .post('/export', ReportsController.exportReport, {
        validateAccess: 'branch',
        body: t.Object({
            branchId: t.Union([t.Numeric(), t.Literal('all'), t.Array(t.Numeric())]),
            type: t.String(),
            startDate: t.String(),
            endDate: t.String(),
            txnType: t.Optional(t.String()),
            categoryId: t.Optional(t.Numeric()),
            accountId: t.Optional(t.Numeric()),
            party: t.Optional(t.String()),
            targetCurrency: t.Optional(t.String()),
            searchTerm: t.Optional(t.String()),
            format: t.Optional(t.Union([t.Literal('csv'), t.Literal('pdf')]))
        })
    });
