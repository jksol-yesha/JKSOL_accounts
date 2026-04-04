import { Elysia, t } from 'elysia';
import { jwtConfig } from './jwt.config';
import { db } from '../db';
import { users, roles } from '../db/schema';
import { eq, sql, and } from 'drizzle-orm';

export interface AuthenticatedUser {
    id: number;
    email: string;
    role: 'owner' | 'admin' | 'member' | null;
    orgIds: number[];
    branchIds: number[];
}

export interface ElysiaContext {
    user: AuthenticatedUser | null;
    orgId?: number | null;
    branchId?: number | 'all' | null;
    headers: Record<string, string | undefined>;
    set: any;
    request: Request;
    authError?: string | null;
}

export const authMiddleware = (app: Elysia) => app
    .use(jwtConfig)
    .derive(async ({ jwt, headers, set, request }) => {
        const { authorization } = headers;
        const orgIdHeader = headers['x-org-id'];
        const branchIdHeader = headers['x-branch-id'];

        if (!authorization) {
            set.status = 401;
            return { user: null, orgId: null, branchId: null, authError: 'No authorization token provided' };
        }

        const token = authorization.replace('Bearer ', '');

        try {
            const payload = await jwt.verify(token);
            if (!payload) {
                console.error(`❌ [AuthMiddleware] Token Verification Failed for ${request.url}. Token: ${token?.substring(0, 15)}...`);
                set.status = 401;
                return { user: null, orgId: null, branchId: null, authError: 'Invalid or Expired Token' };
            }

            const userId = Number(payload.sub);

            const [user] = await db.select({
                id: users.id,
                email: users.email,
                role: roles.name,
                orgIds: users.orgIds,
                branchIds: users.branchIds,
                status: users.status
            })
                .from(users)
                .leftJoin(roles, eq(users.roleId, roles.id))
                .where(eq(users.id, userId));

            if (!user) {
                console.error(`❌ [AuthMiddleware] User not found in DB! ID: ${userId}, Token Email: ${payload.email}`);
                set.status = 401;
                return { user: null, orgId: null, branchId: null, authError: 'User not found' };
            }

            if (user.status !== 1) {
                console.error(`❌ [AuthMiddleware] User INACTIVE in DB! ID: ${userId}`);
                set.status = 401;
                return { user: null, orgId: null, branchId: null, authError: 'User inactive' };
            }

            // Parse comma-separated strings
            const orgIds = typeof user.orgIds === 'string'
                ? user.orgIds.split(',').filter(Boolean).map(Number)
                : (Array.isArray(user.orgIds) ? user.orgIds : []);

            const branchIds = typeof user.branchIds === 'string'
                ? user.branchIds.split(',').filter(Boolean).map(Number)
                : (Array.isArray(user.branchIds) ? user.branchIds : []);

            const authUser: AuthenticatedUser = {
                id: user.id,
                email: user.email,
                role: user.role ? (user.role.toLowerCase() as any) : null,
                orgIds: orgIds as number[] || [],
                branchIds: branchIds as number[] || []
            };

            return {
                user: authUser,
                orgId: orgIdHeader ? Number(orgIdHeader) : null,
                branchId: branchIdHeader === 'all' ? 'all' : (branchIdHeader ? Number(branchIdHeader) : null),
                authError: null
            };
        } catch (error) {
            console.error('❌ Auth Middleware - Error:', error);
            set.status = 401;
            return {
                user: null,
                orgId: null,
                branchId: null,
                authError: 'Authentication failed'
            };
        }
    })
    .macro(({ onBeforeHandle }) => ({
        validateAccess: (accessType: 'org' | 'branch') => {
            onBeforeHandle(async ({ user, orgId, branchId, authError, request }: { user: AuthenticatedUser | null, orgId: number | null, branchId: number | 'all' | null, authError: string | null, request: Request }) => {
                // If authentication failed in the derive step, throw the error now
                if (authError) {
                    throw new Error(authError); // Elysia will catch this and use the status set in derive
                }

                // Ensure user is not null for subsequent checks
                if (!user) {
                    throw new Error('Unauthorized: User not available after authentication');
                }

                if (!orgId) {
                    console.error(`❌ [AuthMiddleware] validateAccess(${accessType}) - Missing x-org-id header for ${request.url}`);
                    throw new Error('Header "x-org-id" is required');
                }

                if (!user.orgIds.includes(orgId)) {
                    console.error(`❌ [AuthMiddleware] Forbidden: User ${user.email} (Orgs: [${user.orgIds}]) attempted to access Org ${orgId}`);
                    throw new Error('Forbidden: You do not belong to this organization');
                }

                // 2. Branch Access Check (If requested)
                if (accessType === 'branch') {
                    if (!branchId) throw new Error('Header "x-branch-id" is required for this operation');

                    if (branchId === 'all') {
                        // Only Owners and Admins can see "All Branches" by default in some contexts,
                        // but for aggregation dashboards, we allow members if they have branches assigned.
                        // Implementation logic will handle actual filtering in services.
                    } else if (user.role === 'owner' || user.role === 'admin') {
                        // Implicit allowed for specific branch
                    } else {
                        // MEMBER role check for specific branch
                        if (!user.branchIds.includes(branchId as number)) {
                            throw new Error('Forbidden: You do not have access to this branch');
                        }
                    }
                }
            });
        }
    }));
