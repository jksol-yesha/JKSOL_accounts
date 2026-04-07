import * as BranchService from './branches.service';
import type { ElysiaContext } from '../../shared/auth.middleware';

export const getBranches = async ({ headers, user, orgId, set }: ElysiaContext) => {
    try {
        if (!user) {
            set.status = 401;
            return { success: false, message: "Unauthorized" };
        }
        if (!orgId) {
            set.status = 400;
            return { success: false, message: "Organization ID is required" };
        }

        const branches = await BranchService.getAllBranches(orgId, undefined, user?.id);
        return { success: true, data: branches };
    } catch (err: any) {
        console.error("❌ [BranchesController] getBranches Error:", err);
        set.status = 500;
        return { success: false, message: err.message || "Internal Server Error" };
    }
};

export const getBranchesQuery = async ({ body, headers, branchId, user, orgId, set }: ElysiaContext & { body: { orgId?: string, skipBranch?: boolean } }) => {
    try {
        if (!user) {
            set.status = 401;
            return { success: false, message: "Unauthorized" };
        }

        const finalOrgId = orgId || (body.orgId ? parseInt(body.orgId) : undefined);
        if (!finalOrgId) {
            set.status = 400;
            return { success: false, message: "Organization ID is required" };
        }

        // Resolve context branch for exclusion (only if it's a specific number)
        const excludeId = (body.skipBranch && typeof branchId === 'number') ? branchId : undefined;

        const branches = await BranchService.getAllBranches(finalOrgId, excludeId, user?.id);
        return { success: true, data: branches };
    } catch (err: any) {
        console.error("❌ [BranchesController] getBranchesQuery Error:", err);
        set.status = 500;
        return { success: false, message: err.message || "Internal Server Error" };
    }
};

export const createBranch = async ({ body, headers, user, orgId }: ElysiaContext & { body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");

    // Use Context Org ID
    body.orgId = orgId;

    const newBranch = await BranchService.createBranch(body, user.id);
    return {
        success: true,
        data: newBranch
    };
};

export const updateBranch = async ({ params, body, user }: ElysiaContext & { params: { id: string }, body: any }) => {
    if (!user) throw new Error("Unauthorized");
    const id = parseInt(params.id);

    const updatedBranch = await BranchService.updateBranch(id, body, user.id);
    return {
        success: true,
        data: updatedBranch
    };
};

export const deleteBranch = async ({ params, user }: ElysiaContext & { params: { id: string } }) => {
    if (!user) throw new Error("Unauthorized");
    const id = parseInt(params.id);

    const result = await BranchService.deleteBranch(id, user.id);
    return result;
};
