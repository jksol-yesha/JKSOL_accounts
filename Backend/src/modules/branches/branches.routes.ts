import { Elysia, t } from 'elysia';
import * as BranchController from './branches.controller';
import { authMiddleware } from '../../shared/auth.middleware';

export const branchesRoutes = new Elysia({ prefix: '/branches' })
    .use(authMiddleware)
    .get('/', BranchController.getBranches, {
        validateAccess: 'org',
        query: t.Object({
            orgId: t.Optional(t.String()),
            skipBranch: t.Optional(t.String())
        })
    })
    .post('/branch-list', BranchController.getBranchesQuery, {
        validateAccess: 'org',
        body: t.Object({
            orgId: t.Optional(t.Union([t.String(), t.Number()])),
            skipBranch: t.Optional(t.Boolean())
        })
    })
    .post('/', BranchController.createBranch, {
        validateAccess: 'org',
        body: t.Object({
            name: t.String(),
            code: t.Optional(t.String()),
            currencyCode: t.String({ minLength: 3, maxLength: 3 }),
            country: t.Optional(t.String()),
            state: t.Optional(t.String()),
            defaultGstRate: t.Optional(t.Union([t.String(), t.Number()])),
            orgId: t.Optional(t.Numeric()),
            status: t.Optional(t.Union([t.Literal(1), t.Literal(2)]))
        })
    })
    .put('/:id', BranchController.updateBranch, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        }),
        body: t.Object({
            name: t.Optional(t.String()),
            code: t.Optional(t.String()),
            currencyCode: t.Optional(t.String()),
            country: t.Optional(t.String()),
            state: t.Optional(t.String()),
            defaultGstRate: t.Optional(t.Union([t.String(), t.Number()])),
            status: t.Optional(t.Union([t.Literal(1), t.Literal(2)]))
        })
    })
    .delete('/:id', BranchController.deleteBranch, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        })
    });
