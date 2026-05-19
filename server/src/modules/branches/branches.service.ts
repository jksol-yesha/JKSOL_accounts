import { db } from '../../db';
import { branches, organizations, transactions, monthlyBranchSummary, yearlyBranchSummary, users, roles } from '../../db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { DELETED_STATUS, isActiveStatus, isNotDeleted } from '../../shared/soft-delete';

// REMOVED DEFAULT_ORG_ID to prevent data leaks
// const DEFAULT_ORG_ID = 1;

export const getAllBranches = async (orgId: number, excludeBranchId?: number, userId?: number) => {
    if (!orgId) throw new Error("Org ID is required for fetching branches");

    let whereClause = and(eq(branches.orgId, orgId), isNotDeleted(branches))!;
    if (excludeBranchId) {
        whereClause = and(
            eq(branches.orgId, orgId),
            isNotDeleted(branches),
            sql`${branches.id} != ${excludeBranchId}`
        )!;
    }

    if (userId) {
        const [user] = await db.select({
            id: users.id,
            role: roles.name,
            branchIds: users.branchIds
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(eq(users.id, userId));

        if (!user) return [];

        const userRole = user.role?.toLowerCase();

        const finalBranchIds = typeof user.branchIds === 'string'
            ? user.branchIds.split(',').filter(Boolean).map(Number)
            : (Array.isArray(user.branchIds) ? user.branchIds as number[] : []);

        if (userRole === 'owner' || userRole === 'admin') {
            // Implicit access to all branches in org
            return await db.select().from(branches).where(whereClause);
        } else if (userRole === 'member') {
            // Explicit access to assigned branches
            if (finalBranchIds.length === 0) return [];

            return await db.select()
                .from(branches)
                .where(and(whereClause, inArray(branches.id, finalBranchIds)));
        }
        return [];
    }

    return await db.select().from(branches).where(whereClause);
};

export const createBranch = async (data: {
    name: string;
    currencyCode: string;
    country?: string;
    orgId?: number;
    status?: 1 | 2;
}, userId: number) => {
    const orgId = data.orgId;
    if (!orgId) throw new Error("Organization ID is required to create a branch.");

    // Check Org Status
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org) throw new Error('Organization not found');
    if (!isActiveStatus(org.status)) throw new Error('Cannot create branch for an inactive organization');

    // Check if branch name exists for this org
    const existing = await db.select()
        .from(branches)
        .where(
            and(
                eq(branches.orgId, orgId),
                eq(branches.name, data.name),
                isNotDeleted(branches)
            )
        );

    if (existing[0]) {
        throw new Error(`Branch with name '${data.name}' already exists in this organization.`);
    }

    const result = await db.insert(branches).values({
        orgId,
        name: data.name,
        currencyCode: data.currencyCode,
        country: data.country,
        status: data.status || 1
    });

    const [newBranch] = await db.select().from(branches).where(eq(branches.id, result[0].insertId));

    // Audit Log
    if (newBranch && userId) {
        await AuditService.log(
            orgId,
            'branch',
            newBranch.id,
            'create',
            userId,
            null,
            newBranch
        );
    }

    return newBranch;
};

export const updateBranch = async (id: number, data: {
    name?: string;
    currencyCode?: string;
    country?: string;
    status?: 1 | 2;
}, userId: number) => {
    const [branch] = await db.select().from(branches).where(and(eq(branches.id, id), isNotDeleted(branches)));
    if (!branch) throw new Error('Branch not found');

    // Check Org Status
    const [org] = await db.select().from(organizations).where(eq(organizations.id, branch.orgId));
    if (org && !isActiveStatus(org.status)) throw new Error('Cannot update branch for an inactive organization');

    const updateData = { ...data };

    await db.update(branches).set(updateData).where(eq(branches.id, id));

    const [updated] = await db.select().from(branches).where(eq(branches.id, id));

    // Audit Log
    if (updated && userId) {
        await AuditService.log(
            updated.orgId,
            'branch',
            id,
            'update',
            userId,
            branch,
            updated
        );
    }

    return updated;
};

export const deleteBranch = async (id: number, userId: number) => {
    // 1. Check if branch exists
    const [branch] = await db.select().from(branches).where(and(eq(branches.id, id), isNotDeleted(branches)));
    if (!branch) throw new Error('Branch not found');

    // 2. Check Org Status
    const [org] = await db.select().from(organizations).where(eq(organizations.id, branch.orgId));
    if (org && !isActiveStatus(org.status)) throw new Error('Cannot delete branch for an inactive organization');

    // 3. Cascade Delete (Transactional)
    return await db.transaction(async (tx) => {
        // A. Soft delete transactions linked to this branch.
        await tx.update(transactions)
            .set({ status: DELETED_STATUS, updatedAt: new Date() })
            .where(and(eq(transactions.branchId, id), isNotDeleted(transactions)));

        // B. Delete Branch Summaries (Wrapped in try-catch as these tables might not be created in MariaDB 10.4 yet)
        try {
            await tx.delete(monthlyBranchSummary).where(eq(monthlyBranchSummary.branchId, id));
            await tx.delete(yearlyBranchSummary).where(eq(yearlyBranchSummary.branchId, id));
        } catch (e: any) {
            const errorCode = e.code || e.cause?.code;
            if (errorCode !== 'ER_NO_SUCH_TABLE') throw e;
            console.warn(`[Cascade Delete] Skipped missing summary tables for branch ${id}`);
        }

        // C. Accounts and categories are organization-wide masters now,
        // so branch deletion must not try to remove them.

        // D. Soft delete the branch itself.
        await tx.update(branches)
            .set({
                status: DELETED_STATUS,
                updatedAt: new Date()
            })
            .where(eq(branches.id, id));

        // Audit Log
        if (userId) {
            await AuditService.log(
                branch.orgId,
                'branch',
                id,
                'delete',
                userId,
                branch,
                null
            );
        }

        return { success: true, message: "Branch archived successfully." };
    });
};
