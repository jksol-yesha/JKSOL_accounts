import { Elysia, t } from 'elysia';
import * as AccountsController from './accounts.controller';
import { authMiddleware } from '../../shared/auth.middleware';

export const accountsRoutes = new Elysia({ prefix: '/accounts' })
    .use(authMiddleware)
    .post('/account-list', AccountsController.getAccounts, {
        validateAccess: 'org',
        body: t.Object({
            status: t.Optional(t.Union([t.Literal(1), t.Literal(2)])),
            financialYearId: t.Optional(t.Numeric())
        })
    })
    .post('/', AccountsController.createAccount, {
        validateAccess: 'org',
        body: t.Object({
            name: t.String(),
            accountType: t.Numeric(),
            subtype: t.Optional(t.Union([t.Numeric(), t.Null()])),
            parentAccountId: t.Optional(t.Union([t.Numeric(), t.Null()])),
            currencyCode: t.String(),
            fxRate: t.Optional(t.Union([t.String(), t.Number()])),
            openingBalance: t.String(),
            openingBalanceDate: t.String(),
            accountNumber: t.Optional(t.Union([t.String(), t.Null()])),
            ifsc: t.Optional(t.Union([t.String(), t.Null()])),
            zipCode: t.Optional(t.Union([t.String(), t.Null()])),
            bankBranchName: t.Optional(t.Union([t.String(), t.Null()])),
            description: t.Optional(t.String()),
            isActive: t.Optional(t.Boolean()),
            orgId: t.Optional(t.Numeric())
        })
    })
    .put('/:id', AccountsController.updateAccount, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        }),
        body: t.Object({
            name: t.Optional(t.String()),
            accountType: t.Optional(t.Numeric()),
            subtype: t.Optional(t.Union([t.Numeric(), t.Null()])),
            parentAccountId: t.Optional(t.Union([t.Numeric(), t.Null()])),
            currencyCode: t.Optional(t.String()),
            status: t.Optional(t.Union([t.Literal(1), t.Literal(2)])), // Keep for backward compat if needed, but isActive is preferred
            isActive: t.Optional(t.Boolean()),
            accountNumber: t.Optional(t.Union([t.String(), t.Null()])),
            ifsc: t.Optional(t.Union([t.String(), t.Null()])),
            zipCode: t.Optional(t.Union([t.String(), t.Null()])),
            bankBranchName: t.Optional(t.Union([t.String(), t.Null()])),
            description: t.Optional(t.String()),
            openingBalance: t.Optional(t.String()),
            openingBalanceDate: t.Optional(t.String()),
            orgId: t.Optional(t.Numeric())
        })
    })
    .put('/:id/opening-balance', AccountsController.updateOpeningBalance, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        }),
        body: t.Object({
            openingBalance: t.String(),
            openingBalanceDate: t.String()
        })
    })
    .post('/:id/net-settlement', AccountsController.getAccountNetSettlement, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        })
    })
    .post('/delete', AccountsController.deleteAccount, {
        validateAccess: 'org',
        body: t.Object({
            id: t.Numeric()
        })
    });
