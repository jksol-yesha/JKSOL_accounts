import * as PartyService from './parties.service';
import { successResponse } from '../../shared/response';
import type { ElysiaContext } from '../../shared/auth.middleware';
import { db } from '../../db';
import { parties } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { WebSocketService } from '../../shared/websocket.service';

export const getParties = async ({ user, orgId, body }: ElysiaContext & { body: { status?: 1 | 2 | number } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");

    const resParties = await PartyService.getAllParties(orgId, body.status as 1 | 2 | undefined);
    return successResponse('Parties retrieved successfully', resParties);
};

export const createParty = async ({ body, user, orgId }: ElysiaContext & { body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");

    const newParty = await PartyService.createParty({
        ...body,
        orgId,
        userId: user.id,
        isActive: body.isActive !== undefined ? body.isActive : true,
    });

    WebSocketService.broadcastToOrg(orgId, {
        event: 'party:created',
        data: newParty
    });

    return successResponse('Party created successfully', newParty);
};

export const updateParty = async ({ params, body, user, orgId, set }: ElysiaContext & { params: { id: string }, body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    const id = parseInt(params.id);

    const updated = await PartyService.updateParty(id, body, orgId, user.id);

    WebSocketService.broadcastToOrg(orgId, {
        event: 'party:updated',
        data: updated
    });

    return successResponse('Party updated successfully', updated);
};

export const deleteParty = async ({ body, user, orgId, set }: ElysiaContext & { body: { id: number } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const id = body.id;

        if (user.role === 'member') {
            set.status = 403;
            return { success: false, message: "Action Prohibited: Only Owners and Admins can delete parties." };
        }

        await PartyService.deleteParty(id, orgId, user.id);

        WebSocketService.broadcastToOrg(orgId, {
            event: 'party:deleted',
            data: { id }
        });

        return successResponse('Party archived successfully');
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
            errMessage.includes('used in associated records') ||
            errMessage.includes('constraint')
        ) {
            set.status = 400;
            return {
                success: false,
                message: errMessage.includes('used in associated records')
                    ? e.message
                    : "Cannot delete this party because it is used in associated records. Please modify Status to 'Inactive' instead."
            };
        }
        throw e;
    }
};
