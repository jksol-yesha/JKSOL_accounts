
import { AuditService } from './audit.service';
import type { ElysiaContext } from '../../shared/auth.middleware';

export const getAuditLogs = async ({ body, set, user, orgId }: ElysiaContext & { body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        // Restrict to Owner or Admin
        if (user.role !== 'owner' && user.role !== 'admin') {
            set.status = 403;
            return { success: false, message: 'Forbidden: Only Owners and Admins can view audit logs.' };
        }

        const limit = body.limit ? Number(body.limit) : 50;
        const offset = body.offset ? Number(body.offset) : 0;
        const entity = body.entity;
        const action = body.action;
        const userId = body.userId ? Number(body.userId) : undefined;

        const result = await AuditService.getAll(orgId, {
            entity,
            action,
            userId,
            limit,
            offset
        });

        return {
            success: true,
            data: result.data,
            total: result.total
        };
    } catch (error) {
        console.error('Fetch Audit Logs Error:', error);
        set.status = 500;
        return { success: false, message: 'Failed to fetch audit logs' };
    }
};
