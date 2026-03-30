import { Elysia, t } from 'elysia';
import * as AuditController from './audit.controller';
import { authMiddleware } from '../../shared/auth.middleware';

export const auditRoutes = new Elysia({ prefix: '/audit-logs' })
    .use(authMiddleware)
    .post('/audit-log-list', AuditController.getAuditLogs, {
        validateAccess: 'org',
        body: t.Object({
            limit: t.Optional(t.Union([t.String(), t.Number()])),
            offset: t.Optional(t.Union([t.String(), t.Number()])),
            entity: t.Optional(t.String()),
            action: t.Optional(t.String()),
            userId: t.Optional(t.Union([t.String(), t.Number()]))
        })
    });
