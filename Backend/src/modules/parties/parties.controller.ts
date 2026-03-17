import * as PartyService from './parties.service';
import { successResponse } from '../../shared/response';
import type { ElysiaContext } from '../../shared/auth.middleware';
import { db } from '../../db';
import { parties } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { WebSocketService } from '../../shared/websocket.service';

export const getParties = async ({ user, orgId, branchId, body, headers }: ElysiaContext & { body: { branchId?: number | number[] | 'all' | string, status?: 1 | 2 | number } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");

    const rawBranchId = body.branchId ?? branchId;
    let effectiveBranchId: number | 'all' | null = null;

    if (rawBranchId === 'all') {
        effectiveBranchId = 'all';
    } else if (Array.isArray(rawBranchId)) {
        // If it's an array of length 1, take that one. Otherwise default to 'all' or ignore based on app logic.
        // The service only takes a single number or 'all'
        const validIds = rawBranchId.map(Number).filter(n => !isNaN(n) && n > 0);
        if (validIds.length > 1) {
            effectiveBranchId = 'all';
        } else if (validIds.length === 1) {
            effectiveBranchId = validIds[0];
        }
    } else if (rawBranchId) {
        effectiveBranchId = Number(rawBranchId);
    }

    const resParties = await PartyService.getAllParties(effectiveBranchId, orgId, body.status as 1 | 2 | undefined);
    return successResponse('Parties retrieved successfully', resParties);
};

export const createParty = async ({ body, user, orgId, branchId, set }: ElysiaContext & { body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");

    const reqBranchId = body.branchId;
    const effectiveBranchId = (branchId === 'all')
        ? (reqBranchId ? Number(reqBranchId) : null)
        : (branchId ?? (reqBranchId ? Number(reqBranchId) : null));

    if (!effectiveBranchId || isNaN(Number(effectiveBranchId))) {
        set.status = 400;
        return { success: false, message: "A specific Branch ID is required to create a party." };
    }

    const bid = Number(effectiveBranchId);

    if (user.role === 'member' && !user.branchIds.includes(bid)) {
        set.status = 403;
        return { success: false, message: "Forbidden: You do not have access to this branch." };
    }

    const newParty = await PartyService.createParty({
        ...body,
        orgId,
        branchId: bid,
        userId: user.id,
        isActive: body.isActive !== undefined ? body.isActive : true,
    });

    WebSocketService.broadcastToBranch(bid, {
        event: 'party:created',
        data: newParty
    });

    return successResponse('Party created successfully', newParty);
};

export const updateParty = async ({ params, body, user, orgId, set }: ElysiaContext & { params: { id: string }, body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    const id = parseInt(params.id);

    const [party] = await db.select({ branchId: parties.branchId }).from(parties).where(eq(parties.id, id));
    if (!party) {
        set.status = 404;
        return { success: false, message: "Party not found" };
    }

    if (user.role === 'member' && !user.branchIds.includes(party.branchId || 0)) {
        set.status = 403;
        return { success: false, message: 'Forbidden: You do not have access to this branch.' };
    }

    const updated = await PartyService.updateParty(id, body, orgId, user.id);

    WebSocketService.broadcastToBranch(party.branchId, {
        event: 'party:updated',
        data: updated
    });

    return successResponse('Party updated successfully', updated);
};

export const deleteParty = async ({ body, user, orgId, branchId, set }: ElysiaContext & { body: { id: number, skipBranch?: boolean | string } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const id = body.id;

        const [party] = await db.select({ branchId: parties.branchId }).from(parties).where(eq(parties.id, id));

        if (!party) {
            set.status = 404;
            return { success: false, message: "Party not found" };
        }

        if (user.role === 'member') {
            set.status = 403;
            return { success: false, message: "Action Prohibited: Only Owners and Admins can delete parties." };
        }

        const skipBranch = body.skipBranch === true || body.skipBranch === 'true';
        const bidForDelete = (branchId === 'all') ? undefined : (branchId || undefined);

        await PartyService.deleteParty(id, orgId, skipBranch, bidForDelete, user.id);

        WebSocketService.broadcastToBranch(party.branchId, {
            event: 'party:deleted',
            data: { id }
        });

        return successResponse('Party deleted successfully');
    } catch (e: any) {
        console.error("Delete party error:", e);
        const errMessage = e.message || "";
        const causeMessage = e.cause?.message || "";
        const errCode = e.code || e.cause?.code;

        if (
            errCode === 'ER_ROW_IS_REFERENCED' ||
            errCode === 'ER_ROW_IS_REFERENCED_2' ||
            errMessage.includes('foreign key constraint fails') ||
            causeMessage.includes('foreign key constraint fails') ||
            errMessage.includes('constraint')
        ) {
            set.status = 400;
            return {
                success: false,
                message: "Cannot delete this party because it is used in associated records. Please modify Status to 'Inactive' instead."
            };
        }
        throw e;
    }
};
