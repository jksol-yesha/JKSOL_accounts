import { db } from '../../db';
import { auditLogs, users } from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';

type NewAuditLog = InferInsertModel<typeof auditLogs>;
type AuditFilters = { entity?: string, action?: string, userId?: number, limit?: number, offset?: number };
type AuditRow = {
    id: number;
    orgId: number;
    entity: string;
    entityId: number | null;
    action: string;
    oldValue: any;
    newValue: any;
    actionBy: number;
    actionAt: string | Date;
    user: {
        fullName: string | null;
        email: string | null;
    } | null;
    groupedCount?: number;
    groupedEntityIds?: number[];
    groupedBranchIds?: number[];
    groupedBranchCount?: number;
};

const FANOUT_GROUP_WINDOW_MS = 15 * 1000;

export class AuditService {
    private static normalizeText(value: unknown) {
        return typeof value === 'string' ? value.trim().toLowerCase() : '';
    }

    private static createInitialGroup(row: AuditRow): AuditRow {
        const branchIds = this.extractBranchIds(row);

        return {
            ...row,
            groupedCount: 1,
            groupedEntityIds: row.entityId ? [row.entityId] : [],
            groupedBranchIds: branchIds,
            groupedBranchCount: branchIds.length || 1
        };
    }

    private static isFanoutLog(log: AuditRow) {
        return log.entity === 'category' || log.entity === 'subcategory' || log.entity === 'party';
    }

    private static extractLogicalEntityName(log: AuditRow) {
        const itemName = log.newValue?.name || log.oldValue?.name;
        const normalizedItemName = this.normalizeText(itemName);

        if (log.entity === 'party') {
            const email = this.normalizeText(log.newValue?.email || log.oldValue?.email);
            const phone = this.normalizeText(log.newValue?.phone || log.oldValue?.phone);
            const gstNo = this.normalizeText(log.newValue?.gstNo || log.oldValue?.gstNo);
            return [normalizedItemName, email, phone, gstNo].join('|');
        }

        if (log.entity !== 'subcategory') {
            return normalizedItemName;
        }

        const parentName = log.newValue?.categoryName || log.oldValue?.categoryName;
        const normalizedParentName = this.normalizeText(parentName);

        return normalizedParentName ? `${normalizedParentName}::${normalizedItemName}` : normalizedItemName;
    }

    private static extractBranchIds(log: AuditRow) {
        const branchIds = new Set<number>();
        const addBranchId = (payload: any) => {
            const value = payload?.branchId;
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric > 0) {
                branchIds.add(numeric);
            }
        };

        addBranchId(log.oldValue);
        addBranchId(log.newValue);

        return Array.from(branchIds);
    }

    private static withGroupedPayload(payload: any) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
        const groupedPayload = { ...payload };

        delete groupedPayload.branchId;
        delete groupedPayload.branchIds;
        delete groupedPayload.branchCount;
        delete groupedPayload.mergedRecords;

        return groupedPayload;
    }

    private static groupFanoutLogs(rows: AuditRow[]) {
        const grouped: AuditRow[] = [];
        const recentGroupByKey = new Map<string, number>();

        for (const row of rows) {
            if (!this.isFanoutLog(row)) {
                grouped.push(row);
                continue;
            }

            const logicalEntityName = this.extractLogicalEntityName(row);
            const timestamp = new Date(row.actionAt).getTime();
            const groupKey = `${row.entity}|${row.action}|${row.actionBy}|${logicalEntityName}`;
            const existingIndex = recentGroupByKey.get(groupKey);
            const existing = existingIndex !== undefined ? grouped[existingIndex] : undefined;

            if (!existing || !Number.isFinite(timestamp)) {
                grouped.push(this.createInitialGroup(row));
                recentGroupByKey.set(groupKey, grouped.length - 1);
                continue;
            }

            const existingTimestamp = new Date(existing.actionAt).getTime();
            const withinWindow = Number.isFinite(existingTimestamp) && Math.abs(existingTimestamp - timestamp) <= FANOUT_GROUP_WINDOW_MS;

            if (!withinWindow) {
                grouped.push(this.createInitialGroup(row));
                recentGroupByKey.set(groupKey, grouped.length - 1);
                continue;
            }

            const mergedEntityIds = Array.from(new Set([
                ...(existing.groupedEntityIds || (existing.entityId ? [existing.entityId] : [])),
                ...(row.entityId ? [row.entityId] : [])
            ]));
            const mergedBranchIds = Array.from(new Set([
                ...(existing.groupedBranchIds || []),
                ...this.extractBranchIds(row)
            ]));
            const groupedCount = (existing.groupedCount || 1) + 1;
            const targetIndex = existingIndex as number;

            grouped[targetIndex] = {
                ...existing,
                groupedCount,
                groupedEntityIds: mergedEntityIds,
                groupedBranchIds: mergedBranchIds,
                groupedBranchCount: mergedBranchIds.length || groupedCount,
                oldValue: this.withGroupedPayload(existing.oldValue),
                newValue: this.withGroupedPayload(existing.newValue)
            };
        }

        return grouped.map((row) => {
            if ((row.groupedCount || 1) <= 1) return row;

            return {
                ...row,
                oldValue: this.withGroupedPayload(row.oldValue),
                newValue: this.withGroupedPayload(row.newValue)
            };
        });
    }

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

    static async getAll(orgId: number, filters: AuditFilters) {
        const buildWhere = (table: any) => {
            const conditions = [eq(table.orgId, orgId)];
            if (filters.entity) conditions.push(eq(table.entity, filters.entity));
            if (filters.action) conditions.push(eq(table.action, filters.action));
            if (filters.userId) conditions.push(eq(table.actionBy, filters.userId));
            return and(...conditions);
        };

        const dataRows = await db.select({
            auditLog: auditLogs,
            actionAtText: sql<string>`DATE_FORMAT(CONVERT_TZ(${auditLogs.actionAt}, @@session.time_zone, '+00:00'), '%Y-%m-%dT%H:%i:%sZ')`,
            user: {
                fullName: users.fullName,
                email: users.email
            }
        })
            .from(auditLogs)
            .leftJoin(users, eq(auditLogs.actionBy, users.id))
            .where(buildWhere(auditLogs))
            .orderBy(desc(auditLogs.id));

        const rawData = dataRows.map(row => ({
            ...row.auditLog,
            actionAt: row.actionAtText || row.auditLog.actionAt,
            user: row.user
        })) as AuditRow[];

        const groupedData = this.groupFanoutLogs(rawData);
        const offset = filters.offset || 0;
        const limit = filters.limit || 50;
        const data = groupedData.slice(offset, offset + limit);

        return {
            data,
            total: groupedData.length
        };
    }
}
