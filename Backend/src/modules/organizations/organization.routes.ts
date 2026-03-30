import { Elysia, t } from 'elysia';
import * as OrganizationController from './organization.controller';
import { authMiddleware } from '../../shared/auth.middleware';

export const organizationRoutes = new Elysia({ prefix: '/organizations' })
    .use(authMiddleware)
    .post('/organization-list', OrganizationController.getOrganizationList)
    .get('/my-invitations', OrganizationController.getMyInvitations)
    .get('/', OrganizationController.getOrganizationList)
    .post('/', OrganizationController.createOrganization, {
        body: t.Object({
            name: t.String(),
            baseCurrency: t.Optional(t.String()),
            timezone: t.Optional(t.String()),
            logo: t.Optional(t.Nullable(t.String()))
        })
    })
    .put('/:id', OrganizationController.updateOrganization, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        }),
        body: t.Object({
            name: t.Optional(t.String()),
            baseCurrency: t.Optional(t.String()),
            timezone: t.Optional(t.String()),
            status: t.Optional(t.Union([t.Literal(1), t.Literal(2)])),
            logo: t.Optional(t.Nullable(t.String()))
        })
    })
    .get('/:id/members', OrganizationController.getMembers, {
        params: t.Object({
            id: t.String()
        })
    })
    .post('/:id/invite', OrganizationController.inviteMember, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        }),
        body: t.Object({
            email: t.String(),
            name: t.Optional(t.String()),
            branchIds: t.Optional(t.Nullable(t.Array(t.Number()))),
            role: t.Union([t.Literal('admin'), t.Literal('member'), t.Literal('owner')])
        })
    })
    .post('/invite-owner', OrganizationController.inviteOwner, {
        body: t.Object({
            email: t.String(),
            name: t.Optional(t.String())
        })
    })
    .post('/delete', OrganizationController.deleteOrganization, {
        validateAccess: 'org',
        body: t.Object({
            id: t.Number()
        })
    })
    .delete('/:id/members/:memberId', OrganizationController.removeMember, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String(),
            memberId: t.String()
        })
    })
    .put('/:id/members/:memberId', OrganizationController.updateMemberAccess, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String(),
            memberId: t.String()
        }),
        body: t.Object({
            role: t.Optional(t.Union([t.Literal('owner'), t.Literal('admin'), t.Literal('member')])),
            branchIds: t.Optional(t.Nullable(t.Array(t.Number())))
        })
    });
