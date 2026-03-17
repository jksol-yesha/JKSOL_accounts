import { db } from '../../db';
import { auditLogs, users } from '../../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';

type NewAuditLog = InferInsertModel<typeof auditLogs>;

export class AuditService {
    /**
     * Log an action to the audit_logs table.
     * @param orgId - Organization ID
     * @param entity - Entity name (e.g., 'transaction', 'account')
     * @param entityId - ID of the entity
     * @param action - Action performed (e.g., 'create', 'update', 'delete')
     * @param userId - ID of the user performing the action
     * @param oldValue - JSON object of the state before change (optional)
     * @param newValue - JSON object of the state after change (optional)
     */
    static async log(
        orgId: number,
        entity: string,
        entityId: number,
        action: string,
        userId: number,
        oldValue?: any,
        newValue?: any,
        tx?: any
    ) {
        try {
            const runner = tx || db;
            await runner.insert(auditLogs).values({
                orgId,
                entity,
                entityId,
                action,
                actionBy: userId,
                oldValue: oldValue ? oldValue : null,
                newValue: newValue ? newValue : null,
            });
        } catch (error) {
            console.error(`[AuditService] Failed to log action: ${action} on ${entity} ${entityId}`, error);
            // We consciously do NOT throw here to prevent blocking the main business logic if logging fails.
        }
    }

    static async getAll(orgId: number, filters: { entity?: string, action?: string, userId?: number, limit?: number, offset?: number }) {
        const buildWhere = (table: any) => {
            const conditions = [eq(table.orgId, orgId)];
            if (filters.entity) conditions.push(eq(table.entity, filters.entity));
            if (filters.action) conditions.push(eq(table.action, filters.action));
            if (filters.userId) conditions.push(eq(table.actionBy, filters.userId));
            return and(...conditions);
        };

        const [dataRows, totalResult] = await Promise.all([
            db.select({
                auditLog: auditLogs,
                user: {
                    fullName: users.fullName,
                    email: users.email
                }
            })
                .from(auditLogs)
                .leftJoin(users, eq(auditLogs.actionBy, users.id))
                .where(buildWhere(auditLogs))
                .orderBy(desc(auditLogs.id))
                .limit(filters.limit || 50)
                .offset(filters.offset || 0),
            db.select({ count: sql<number>`count(*)` })
                .from(auditLogs)
                .where(buildWhere(auditLogs))
        ]);

        const data = dataRows.map(row => ({
            ...row.auditLog,
            user: row.user
        }));


        return {
            data,
            total: Number(totalResult[0]?.count || 0)
        };
    }
}
