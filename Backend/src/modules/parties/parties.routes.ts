import { Elysia, t } from 'elysia';
import * as PartiesController from './parties.controller';
import { authMiddleware } from '../../shared/auth.middleware';

export const partiesRoutes = new Elysia({ prefix: '/parties' })
    .use(authMiddleware)
    .post('/party-list', PartiesController.getParties, {
        validateAccess: 'org',
        body: t.Object({
            branchId: t.Optional(t.Union([t.Numeric(), t.Literal('all'), t.Array(t.Numeric()), t.String()])),
            status: t.Optional(t.Union([t.Literal(1), t.Literal(2), t.Numeric()]))
        })
    })
    .post('/', PartiesController.createParty, {
        validateAccess: 'org',
        body: t.Object({
            name: t.String(),
            email: t.Optional(t.String()),
            phone: t.Optional(t.String()),
            address: t.String(),
            state: t.Optional(t.String()),
            gstNo: t.Optional(t.String()),
            gstName: t.Optional(t.String()),
            isActive: t.Optional(t.Boolean()),
            branchId: t.Optional(t.Numeric()),
            orgId: t.Optional(t.Numeric())
        })
    })
    .put('/update/:id', PartiesController.updateParty, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        }),
        body: t.Object({
            name: t.Optional(t.String()),
            email: t.Optional(t.String()),
            phone: t.Optional(t.String()),
            address: t.Optional(t.String()),
            state: t.Optional(t.String()),
            gstNo: t.Optional(t.String()),
            gstName: t.Optional(t.String()),
            isActive: t.Optional(t.Boolean()),
        })
    })
    .post('/delete', PartiesController.deleteParty, {
        validateAccess: 'org',
        body: t.Object({
            id: t.Numeric(),
            branchId: t.Optional(t.Numeric()),
            skipBranch: t.Optional(t.Union([t.Boolean(), t.String()]))
        })
    });
