
import { OrganizationService } from './organization.service';
import { successResponse } from '../../shared/response';
import type { ElysiaContext } from '../../shared/auth.middleware';

export const getOrganizationList = async ({ user, set }: ElysiaContext) => {
    console.log('📋 getOrganizationList - User:', user ? { id: user.id, email: user.email, orgIds: user.orgIds } : 'NULL');

    if (!user) {
        console.error('❌ getOrganizationList - No user in context, returning 401');
        set.status = 401;
        return { message: "Unauthorized" };
    }
    try {
        console.log('📋 getOrganizationList - Fetching orgs for user:', user.id);
        const orgs = await OrganizationService.getAllForUser(user.id);
        console.log('✅ getOrganizationList - Found orgs:', orgs.length);
        return successResponse('Organizations fetched successfully', orgs);
    } catch (err: any) {
        console.error("❌ [OrganizationController] getOrganizationList Error:", err);
        set.status = 400;
        return { message: err.message || "Failed to fetch organizations", error: err.toString() };
    }
};

export const getMyInvitations = async ({ user, set }: ElysiaContext) => {
    if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
    }
    try {
        const invites = await OrganizationService.getPendingInvitations(user.email);
        return successResponse('Pending invitations fetched', invites);
    } catch (err: any) {
        set.status = 400;
        return { message: err.message };
    }
};

export const createOrganization = async ({ user, body, set }: ElysiaContext & { body: any }) => {
    if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
    }
    const newOrg = await OrganizationService.create(user.id, {
        ...body,
        logo: body.logo || undefined
    });
    return successResponse('Organization created successfully', newOrg);
};

export const updateOrganization = async ({ user, params, body, set }: ElysiaContext & { params: { id: string }, body: any }) => {
    if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
    }
    const updatedOrg = await OrganizationService.update(user.id, parseInt(params.id), {
        ...body,
        status: body.status as 1 | 2 | undefined,
        logo: body.logo || undefined
    });
    return successResponse('Organization updated successfully', updatedOrg);
};

export const getMembers = async ({ user, params, set }: ElysiaContext & { params: { id: string } }) => {
    if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
    }
    try {
        const orgId = parseInt(params.id);
        if (!user.orgIds.includes(orgId)) {
            console.error(`❌ [OrganizationController] getMembers - User ${user.id} does not have access to Org ${orgId}`);
            set.status = 403;
            return { message: "Forbidden: You do not belong to this organization" };
        }

        console.log(`[OrganizationController] getMembers called for Org ID: ${orgId}`);
        const members = await OrganizationService.getMembers(orgId);
        console.log(`[OrganizationController] getMembers result count: ${members.length}`);
        return successResponse('Members fetched successfully', members);
    } catch (err: any) {
        console.error(`[OrganizationController] getMembers ERROR:`, err);
        set.status = 400;
        return { message: err.message };
    }
};

export const inviteMember = async ({ user, params, body, set, request }: ElysiaContext & { params: { id: string }, body: any }) => {
    if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
    }
    console.log(`[OrganizationController] inviteMember called for Org ${params.id}, Body:`, body);
    try {
        const origin = request.headers.get('origin');
        const result = await OrganizationService.inviteMember(
            user.id,
            parseInt(params.id),
            body.email,
            body.branchIds || null,
            body.role,
            origin,
            body.name || undefined  // NEW: invitee display name
        );
        return successResponse('Member invited successfully', result);
    } catch (err: any) {
        set.status = 400;
        return { message: err.message };
    }
};

export const inviteOwner = async ({ user, body, set, request }: ElysiaContext & { body: { email: string, name?: string } }) => {
    if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
    }
    try {
        const origin = request.headers.get('origin');
        const result = await OrganizationService.inviteOwner(user.id, body.email, origin, body.name);
        return successResponse('Owner invitation sent successfully', result);
    } catch (err: any) {
        console.error('Error inviting owner:', err);
        set.status = 400;
        return { message: err.message };
    }
};

export const deleteOrganization = async ({ user, body, set }: ElysiaContext & { body: { id: number } }) => {
    if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
    }
    try {
        const result = await OrganizationService.delete(user.id, body.id);
        return successResponse('Organization deleted successfully', result);
    } catch (err: any) {
        set.status = 400;
        return { message: err.message };
    }
};

export const removeMember = async ({ user, params, set }: ElysiaContext & { params: { id: string, memberId: string } }) => {
    if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
    }
    try {
        const result = await OrganizationService.removeMember(
            user.id,
            parseInt(params.id),
            parseInt(params.memberId)
        );
        return successResponse('Member removed successfully', result);
    } catch (err: any) {
        set.status = 400;
        return { message: err.message };
    }
};

export const updateMemberAccess = async ({ user, params, body, set }: ElysiaContext & { params: { id: string, memberId: string }, body: any }) => {
    if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
    }
    try {
        const result = await OrganizationService.updateMemberAccess(
            user.id,
            parseInt(params.id),
            parseInt(params.memberId),
            body.role,
            body.branchIds || null
        );
        return successResponse('Member access updated successfully', result);
    } catch (err: any) {
        set.status = 400;
        return { message: err.message };
    }
};
