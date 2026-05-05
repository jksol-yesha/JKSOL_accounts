import { db } from '../../db';
import { organizations, users, financialYears, branches, categories, exchangeRates, accounts, transactions, auditLogs, monthlyBranchSummary, yearlyBranchSummary, roles, parties } from '../../db/schema';
import { alias } from 'drizzle-orm/mysql-core';
import { eq, and, sql, inArray } from 'drizzle-orm';
import * as EmailService from '../../shared/email.service';
import { AuditService } from '../audit/audit.service';
import { DELETED_STATUS, isNotDeleted } from '../../shared/soft-delete';

export const OrganizationService = {
    // Create new organization and owner link
    async create(userId: number, data: { name: string; baseCurrency?: string; timezone?: string; logo?: string }) {
        const [user] = await db.select({
            id: users.id,
            role: roles.name,
            roleId: users.roleId,
            orgIds: users.orgIds
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(eq(users.id, userId));

        if (!user) throw new Error("User not found");

        if (user.role?.toLowerCase() === 'member') {
            throw new Error("Action Prohibited: Members cannot create organizations.");
        }

        return await db.transaction(async (tx) => {
            const baseCurrency = data.baseCurrency || 'USD';
            const timezone = data.timezone || 'Asia/Kolkata';
            const logo = data.logo || null;

            // 1. Create Org
            const [org] = await tx.insert(organizations).values({
                name: data.name,
                baseCurrency,
                timezone,
                logo,
                status: 1
            });
            const orgId = org.insertId;

            // 2. Update User (Add Org ID and set role to Owner if not set)
            let currentOrgIds: number[] = [];
            if (user.orgIds) {
                currentOrgIds = typeof user.orgIds === 'string'
                    ? user.orgIds.split(',').filter(Boolean).map(Number)
                    : (Array.isArray(user.orgIds) ? user.orgIds : []);
            }
            const newOrgIds = Array.from(new Set([...currentOrgIds, orgId])).join(',');

            const [ownerRole] = await tx.select().from(roles).where(eq(roles.name, 'owner'));

            await tx.update(users)
                .set({
                    roleId: user.roleId || ownerRole?.id,
                    orgIds: newOrgIds,
                    updatedAt: new Date()
                })
                .where(eq(users.id, userId));

            // 3. Auto-Create Financial Years (Current & Next)
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth(); // 0-11

            // Determine Current FY (assuming April-March cycle common in India/UK, or just Jan-Dec?)
            // Let's stick to standard Jan-Dec for defaults unless locale specified, OR implementation standard April-March?
            // User seems to be Indian (Surat branches, HDFC bank). Let's use April-March.

            let startYear = year;
            if (month < 3) { // Jan, Feb, Mar belong to previous FY start
                startYear = year - 1;
            }

            // Format: YYYY-YY (e.g., 2025-26)
            const formatFyName = (start: number) => {
                const end = start + 1;
                return `${start}-${end.toString().slice(-2)}`;
            };

            const currentFyName = formatFyName(startYear);
            const nextFyName = formatFyName(startYear + 1);

            await tx.insert(financialYears).values([
                {
                    orgId: org.insertId,
                    name: currentFyName,
                    startDate: `${startYear}-04-01`,
                    endDate: `${startYear + 1}-03-31`
                },
                {
                    orgId: org.insertId,
                    name: nextFyName,
                    startDate: `${startYear + 1}-04-01`,
                    endDate: `${startYear + 2}-03-31`
                }
            ]);

            const newOrg = {
                id: org.insertId,
                name: data.name,
                baseCurrency,
                timezone,
                logo,
                status: 1
            };

            // Audit Log: CREATE ORG
            // Note: We use 0 if user has no org yet? No, we have org.insertId now.
            await AuditService.log(newOrg.id, 'organization', newOrg.id, 'CREATE', userId, null, newOrg, tx);

            return newOrg;
        });
    },

    // Get all organizations for a user
    async getAllForUser(userId: number) {
        const [user] = await db.select({
            id: users.id,
            orgIds: users.orgIds,
            role: roles.name
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(eq(users.id, userId));

        let orgIds: number[] = [];
        if (user?.orgIds) {
            orgIds = typeof user.orgIds === 'string'
                ? user.orgIds.split(',').filter(Boolean).map(Number)
                : (Array.isArray(user.orgIds) ? user.orgIds : []);
        }

        if (orgIds.length === 0) return [];

        const result = await db.select()
            .from(organizations)
            .where(and(
                inArray(organizations.id, orgIds),
                sql`${organizations.status} != ${DELETED_STATUS}`
            ));

        return result.map(org => ({
            ...org,
            role: user?.role ? user.role.toLowerCase() : null
        }));
    },

    async update(userId: number, orgId: number, data: Partial<typeof organizations.$inferInsert>) {
        // 1. Verify Owner Permission
        const [user] = await db.select({
            id: users.id,
            role: roles.name
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(and(
                eq(users.id, userId),
                // eq(roles.name, 'owner'), // Removed strict SQL check which might be case sensitive depending on collation
                sql`LOWER(${roles.name}) = 'owner'`,
                sql`FIND_IN_SET(${orgId}, org_ids)`
            ));

        if (!user) {
            throw new Error('Only the Organization Owner can update organization details');
        }

        const [oldOrg] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        await db.update(organizations).set(data).where(eq(organizations.id, orgId));
        const [updatedOrg] = await db.select().from(organizations).where(eq(organizations.id, orgId));

        // Audit Log: UPDATE ORG
        if (updatedOrg) {
            await AuditService.log(updatedOrg.id, 'organization', updatedOrg.id, 'UPDATE', userId, oldOrg, updatedOrg);
        }

        return updatedOrg;
    },

    // Get all members of an organization
    async getMembers(orgId: number) {
        const creators = alias(users, 'creators');
        const members = await db.select({
            id: users.id,
            name: users.fullName,
            email: users.email,
            role: roles.name, // Fetched from joined roles table
            orgIds: users.orgIds,
            branchIds: users.branchIds,
            profilePhoto: users.profilePhoto,
            createdBy: users.createdBy,
            creatorName: creators.fullName
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .leftJoin(creators, eq(users.createdBy, creators.id))
            .where(sql`FIND_IN_SET(${orgId}, ${users.orgIds})`);

        if (members.length === 0) return [];

        // Fetch all branch names for this org to resolve member branch names
        const orgBranches = await db.select()
            .from(branches)
            .where(and(eq(branches.orgId, orgId), isNotDeleted(branches)));

        return members.map(member => {
            const memberRole = member.role;
            let memberBranchIds: number[] = [];
            if (member.branchIds) {
                memberBranchIds = typeof member.branchIds === 'string'
                    ? member.branchIds.split(',').filter(Boolean).map(Number)
                    : (Array.isArray(member.branchIds) ? member.branchIds : []);
            }

            if (memberRole?.toLowerCase() === 'owner' || memberRole?.toLowerCase() === 'admin') {
                return {
                    ...member,
                    branchRoles: [{
                        branchName: 'All Branches',
                        roleName: ''
                    }]
                };
            }

            // Member: Resolve specific branch names from their branchIds that belong to THIS org
            const filteredBranches = orgBranches.filter(b => memberBranchIds.includes(b.id));

            return {
                ...member,
                branchRoles: filteredBranches.map(b => ({
                    branchId: b.id,
                    branchName: b.name,
                    roleName: 'Member'
                }))
            };
        });
    },

    // Invite a member (Create Invitation)
    async inviteMember(requesterId: number, orgId: number, email: string, branchIds: number[] | null, role: 'owner' | 'admin' | 'member', origin?: string | null, name?: string) {
        // 1. Validate Requester Permissions (Owner or Admin)
        const [requester] = await db.select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            role: roles.name
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(and(
                eq(users.id, requesterId),
                sql`LOWER(${roles.name}) IN ('owner', 'admin')`,
                sql`FIND_IN_SET(${orgId}, org_ids)`
            ));

        if (!requester) {
            throw new Error('Insufficient permissions: Only Organization Owner or Admin can invite members');
        }

        // 2. Role Restriction for Admins
        if (requester.role?.toLowerCase() === 'admin' && role?.toLowerCase() === 'owner') {
            throw new Error('Insufficient permissions: Admins cannot invite Owners.');
        }

        // 3. Validate Branch IDs based on Role
        let finalBranchIds: number[] | null = null;

        if (role?.toLowerCase() === 'member') {
            // Member MUST have selected branches
            if (!branchIds || branchIds.length === 0) {
                throw new Error("Members must be assigned to at least one branch.");
            }
            // Validate all branches belong to Org
            const validBranches = await db.select({ id: branches.id })
                .from(branches)
                .where(and(
                    eq(branches.orgId, orgId),
                    isNotDeleted(branches),
                    inArray(branches.id, branchIds)
                ));

            if (validBranches.length !== branchIds.length) {
                throw new Error("One or more selected branches are invalid or do not belong to this organization.");
            }
            finalBranchIds = branchIds;

        } else {
            // Owner / Admin -> Implicit Access to All Branches
            finalBranchIds = null;
        }

        // 4. Check if User is already a member
        const [existingUser] = await db.select().from(users).where(eq(users.email, email));
        const existingOrgIds = typeof existingUser?.orgIds === 'string'
            ? existingUser.orgIds.split(',').filter(Boolean).map(Number)
            : (Array.isArray(existingUser?.orgIds) ? existingUser.orgIds : []);

        if (existingUser && existingOrgIds.includes(orgId)) {
            throw new Error('User is already a member of this organization');
        }

        // 5. Pre-register or update user
        const roleMap: Record<string, string> = { 'owner': 'Owner', 'admin': 'Admin', 'member': 'Member', 'viewer': 'Viewer' };
        const dbRoleName = roleMap[role.toLowerCase()] || role;
        const [roleRecord] = await db.select().from(roles).where(eq(roles.name, dbRoleName));
        if (!roleRecord) throw new Error(`Role ${role} not found`);

        // ── Pre-register invited user (so they can log in directly via OTP) ──
        // Assign orgId and branchIds straight away so the user can see their org
        // and branches immediately after logging in, even without accepting the invite.
        const [alreadyExistsUser] = await db.select().from(users).where(eq(users.email, email));
        if (!alreadyExistsUser) {
            try {
                const displayName = name || email.split('@')[0]; // Use provided name or derive from email
                const preRegBranchIds = finalBranchIds ? finalBranchIds.join(',') : '';
                await db.insert(users).values({
                    email,
                    fullName: displayName,       // Use admin-provided name
                    roleId: roleRecord.id,
                    orgIds: String(orgId),        // Assign org immediately
                    branchIds: preRegBranchIds,   // Assign branches immediately
                    status: 1,                    // Active — allows direct OTP login
                    createdBy: requesterId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            } catch (preRegErr: any) {
                // Ignore duplicate key errors (race condition), log others
                if (!preRegErr?.message?.includes('Duplicate')) {
                    console.error(`[InviteMember] Failed to pre-register user ${email}:`, preRegErr);
                }
            }
        } else {
            // User already exists — ensure the org and branches are added
            const currentOrgIds = alreadyExistsUser.orgIds
                ? String(alreadyExistsUser.orgIds).split(',').filter(Boolean).map(Number)
                : [];
            if (!currentOrgIds.includes(orgId)) {
                const newOrgIds = [...currentOrgIds, orgId].join(',');
                const currentBranchIds = alreadyExistsUser.branchIds
                    ? String(alreadyExistsUser.branchIds).split(',').filter(Boolean).map(Number)
                    : [];
                const newBranchIds = finalBranchIds
                    ? Array.from(new Set([...currentBranchIds, ...finalBranchIds])).join(',')
                    : alreadyExistsUser.branchIds || '';
                await db.update(users)
                    .set({ orgIds: newOrgIds, branchIds: newBranchIds, roleId: roleRecord.id, fullName: name || alreadyExistsUser.fullName, updatedAt: new Date() })
                    .where(eq(users.email, email));
            }
        }
        // ── End pre-registration ──

        // Fetch complete Org details for the email
        const [orgDetails] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        const orgName = orgDetails?.name || 'Organization';
        const orgLogo = orgDetails?.logo;
        EmailService.sendInvitation(email, "LOGIN_ONLY", role, orgId, orgName, orgLogo, 'N/A', origin, name)
            .catch(err => console.error(`❌ [Background Email] Failed to notify user ${email}:`, err));

        const result = { message: `User access granted and notified successfully`, email };

        await AuditService.log(orgId, 'user', alreadyExistsUser?.id || 0, 'ADD_MEMBER', requesterId, null, { email, role, branches: finalBranchIds });

        return result;
    },

    // Invite an Owner (Special Flow)
    async inviteOwner(requesterId: number, email: string, origin?: string | null, name?: string) {
        // 1. Verify Requester is Owner
        const [requester] = await db.select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            role: roles.name,
            orgIds: users.orgIds
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(eq(users.id, requesterId));

        if (!requester || requester.role?.toLowerCase() !== 'owner') {
            throw new Error('Insufficient permissions: Only an Owner can invite another Owner.');
        }

        // 2. Determine Context Organization
        let orgIds: number[] = [];
        if (requester.orgIds) {
            orgIds = typeof requester.orgIds === 'string'
                ? requester.orgIds.split(',').filter(Boolean).map(Number)
                : (Array.isArray(requester.orgIds) ? requester.orgIds : []);
        }

        if (orgIds.length === 0) {
            throw new Error("You do not have any organizations to share.");
        }
        const contextOrgId = orgIds[0];

        const [ownerRole] = await db.select().from(roles).where(eq(roles.name, 'owner'));
        if (!ownerRole) throw new Error('System Error: Owner role not found');

        // ── Pre-register invited owner (so they can log in directly via OTP) ──
        // Assign the contextOrgId so the user can see their org immediately after login.
        const [alreadyExistsOwner] = await db.select().from(users).where(eq(users.email, email));
        if (!alreadyExistsOwner) {
            try {
                const displayName = name || email.split('@')[0]; // Use provided name or derive from email
                // Fetch all orgs + branches the inviter owns, so new owner gets full access
                const inviterOrgIds = requester.orgIds
                    ? String(requester.orgIds).split(',').filter(Boolean)
                    : [String(contextOrgId)];
                const inviterBranches = await db
                    .select({ id: branches.id })
                    .from(branches)
                    .where(and(inArray(branches.orgId, inviterOrgIds.map(Number)), isNotDeleted(branches)));
                const inviterBranchIds = inviterBranches.map(b => String(b.id)).join(',');

                await db.insert(users).values({
                    email,
                    fullName: displayName,
                    roleId: ownerRole.id,
                    orgIds: inviterOrgIds.join(','),   // All inviter's orgs
                    branchIds: inviterBranchIds,       // All corresponding branches
                    status: 1,                         // Active — allows direct OTP login
                    createdBy: requesterId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            } catch (preRegErr: any) {
                if (!preRegErr?.message?.includes('Duplicate')) {
                    console.error(`[InviteOwner] Failed to pre-register user ${email}:`, preRegErr);
                }
            }
        } else {
            // User already exists — ensure the org is added
            const currentOrgIds = alreadyExistsOwner.orgIds
                ? String(alreadyExistsOwner.orgIds).split(',').filter(Boolean).map(Number)
                : [];
            const shouldUpdateName = !!name?.trim();
            const shouldAddOrg = !currentOrgIds.includes(contextOrgId as number);
            if (shouldAddOrg || shouldUpdateName) {
                const newOrgIds = shouldAddOrg ? [...currentOrgIds, contextOrgId].join(',') : (alreadyExistsOwner.orgIds || '');
                const updateValues: any = { updatedAt: new Date() };
                if (shouldAddOrg) updateValues.orgIds = newOrgIds;
                if (shouldUpdateName) updateValues.fullName = name!.trim();

                await db.update(users)
                    .set(updateValues)
                    .where(eq(users.email, email));

                if (shouldAddOrg) {
                }
            }
        }
        // ── End pre-registration ──

        // 4. Send Email
        const [orgDetails] = await db.select().from(organizations).where(eq(organizations.id, contextOrgId as number));
        const orgName = orgDetails?.name || 'Organization';

        EmailService.sendInvitation(email, "LOGIN_ONLY", 'owner', contextOrgId as number, orgName, orgDetails?.logo, 'N/A', origin, name)
            .catch(err => console.error(`❌ [Background Email] Failed to send owner notification to ${email}:`, err));

        const result = { message: `Owner notification sent to ${email}`, orgId: contextOrgId };

        const [invitedOwner] = await db.select().from(users).where(eq(users.email, email));
        await AuditService.log(contextOrgId as number, 'user', invitedOwner?.id || 0, 'ADD_OWNER', requesterId, null, { email });

        return result;
    },

    async delete(userId: number, orgId: number) {
        // 1. Verify Owner Permission
        const [user] = await db.select({
            id: users.id,
            role: roles.name
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(and(
                eq(users.id, userId),
                sql`LOWER(${roles.name}) = 'owner'`,
                sql`FIND_IN_SET(${orgId}, org_ids)`
            ));

        if (!user) {
            throw new Error('Only the Organization Owner can perform this action');
        }

        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        if (!org || Number(org.status) === DELETED_STATUS) {
            throw new Error('Organization not found');
        }

        // 2. Strict Check for Branches
        const branchCount = await db.select({ count: sql`count(*)` })
            .from(branches)
            .where(and(eq(branches.orgId, orgId), isNotDeleted(branches)));

        if (branchCount && branchCount[0] && Number(branchCount[0].count) > 0) {
            throw new Error(`Cannot delete organization. It has ${branchCount[0].count} active branches.`);
        }

        const orgBranchIds = (await db.select({ id: branches.id })
            .from(branches)
            .where(eq(branches.orgId, orgId)))
            .map((branch) => Number(branch.id))
            .filter(Boolean);

        // 3. Soft-delete org access and reusable child masters
        return await db.transaction(async (tx) => {
            await tx.execute(sql`
                UPDATE users 
                SET org_ids = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', org_ids, ','), CONCAT(',', ${orgId}, ','), ','))
                WHERE FIND_IN_SET(${orgId}, org_ids)
            `);

            if (orgBranchIds.length > 0) {
                const branchCleanExpression = orgBranchIds.reduce(
                    (expr, branchId) => sql`REPLACE(CONCAT(',', ${expr}, ','), CONCAT(',', ${branchId}, ','), ',')`,
                    sql`COALESCE(branch_ids, '')`
                );

                await tx.execute(sql`
                    UPDATE users
                    SET branch_ids = TRIM(BOTH ',' FROM ${branchCleanExpression})
                    WHERE branch_ids IS NOT NULL
                `);
            }

            await tx.update(transactions)
                .set({ status: DELETED_STATUS, updatedAt: new Date() })
                .where(and(eq(transactions.orgId, orgId), isNotDeleted(transactions)));

            await tx.update(accounts)
                .set({ status: DELETED_STATUS, updatedAt: new Date() })
                .where(and(eq(accounts.orgId, orgId), isNotDeleted(accounts)));

            await tx.update(categories)
                .set({ status: DELETED_STATUS })
                .where(and(eq(categories.orgId, orgId), isNotDeleted(categories)));

            await tx.update(parties)
                .set({ status: DELETED_STATUS, updatedAt: new Date() })
                .where(and(eq(parties.orgId, orgId), isNotDeleted(parties)));

            await tx.update(organizations)
                .set({ status: DELETED_STATUS, updatedAt: new Date() })
                .where(eq(organizations.id, orgId));

            // Audit Log: DELETE ORG
            await AuditService.log(orgId, 'organization', orgId, 'DELETE', userId, undefined, undefined, tx);

            return { message: 'Organization archived successfully' };
        });
    },

    // Get Pending Invitations for User (by Email)
    async getPendingInvitations(email: string) {
        return [];
    },

    // Remove a member from the organization
    // Remove a member from the organization
    async removeMember(requesterId: number, orgId: number, memberIdToRemove: number) {
        // 1. Verify Requester is Owner
        const [requester] = await db.select({
            id: users.id,
            role: roles.name
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(and(
                eq(users.id, requesterId),
                sql`LOWER(${roles.name}) = 'owner'`,
                sql`FIND_IN_SET(${orgId}, org_ids)`
            ));

        if (!requester) {
            throw new Error('Only the Organization Owner can remove members');
        }

        // 2. Prevent removing self (Owner)
        if (requesterId === memberIdToRemove) {
            throw new Error('You cannot remove yourself.');
        }

        // 3. Update Member (Remove Org and associated Branches)
        const [member] = await db.select().from(users).where(eq(users.id, memberIdToRemove));
        if (member) {
            // Parse orgIds from JSON string if needed
            let currentOrgIds: number[] = [];
            if (member.orgIds) {
                currentOrgIds = typeof member.orgIds === 'string'
                    ? member.orgIds.split(',').filter(Boolean).map(Number)
                    : (Array.isArray(member.orgIds) ? member.orgIds : []);
            }
            const newOrgIds = currentOrgIds.filter(id => id !== orgId);
            const newOrgIdsStr = newOrgIds.join(',');

            // Remove branches of THIS org from member's branchIds
            const orgBranches = await db.select({ id: branches.id })
                .from(branches)
                .where(and(eq(branches.orgId, orgId), isNotDeleted(branches)));
            const orgBranchIds = orgBranches.map(b => b.id);

            // Parse branchIds from string if needed
            let currentBranchIds: number[] = [];
            if (member.branchIds) {
                currentBranchIds = typeof member.branchIds === 'string'
                    ? member.branchIds.split(',').filter(Boolean).map(Number)
                    : (Array.isArray(member.branchIds) ? member.branchIds : []);
            }
            const newBranchIds = currentBranchIds.filter(id => !orgBranchIds.includes(id)).join(',');

            if (newOrgIds.length === 0) {
                // User has no more organizations.
                // ALWAYS HARD DELETE (as requested)
                // Reassign all dependent records to the requester (Owner) to maintain data integrity

                await db.transaction(async (tx) => {
                    // 1. Reassign Transactions
                    await tx.update(transactions)
                        .set({ createdBy: requesterId })
                        .where(eq(transactions.createdBy, memberIdToRemove));

                    // 2. Reassign Audit Logs
                    await tx.update(auditLogs)
                        .set({ actionBy: requesterId })
                        .where(eq(auditLogs.actionBy, memberIdToRemove));

                    // 3. Reassign Created Users (Self-referencing FK)
                    // Skip if self-referencing the user being deleted (shouldn't happen but safe to filter)
                    await tx.update(users)
                        .set({ createdBy: requesterId })
                        .where(and(
                            eq(users.createdBy, memberIdToRemove),
                            sql`${users.id} != ${memberIdToRemove}`
                        ));


                    // 6. Delete User
                    await tx.delete(users).where(eq(users.id, memberIdToRemove));
                });

                return { message: 'Member deleted permanently and associated data reassigned to owner.' };

            } else {
                // Just remove from this Org
                await db.update(users)
                    .set({
                        orgIds: newOrgIdsStr,
                        branchIds: newBranchIds,
                        updatedAt: new Date()
                    })
                    .where(eq(users.id, memberIdToRemove));
            }
        }

        await AuditService.log(orgId, 'user', memberIdToRemove, 'REMOVE_MEMBER', requesterId);

        return { message: 'Member removed successfully' };
    },

    // Update a member's role and branch access
    async updateMemberAccess(requesterId: number, orgId: number, memberId: number, roleName: 'owner' | 'admin' | 'member' | undefined, branchIds: number[] | null) {
        // 1. Verify Requester is Owner or Admin
        const [requester] = await db.select({
            id: users.id,
            role: roles.name
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(and(
                eq(users.id, requesterId),
                sql`FIND_IN_SET(${orgId}, org_ids)`
            ));

        if (!requester) {
            throw new Error('User not found in this organization');
        }

        const isOwner = requester.role?.toLowerCase() === 'owner';
        const isAdmin = requester.role?.toLowerCase() === 'admin';

        if (!isOwner && !isAdmin) {
            throw new Error('Only Organization Owners and Admins can edit member access');
        }

        // 2. Prevent editing self
        if (requesterId === memberId) {
            throw new Error('You cannot edit your own access level.');
        }

        // 3. Get the member being edited
        const [member] = await db.select({
            id: users.id,
            role: roles.name,
            roleId: users.roleId,
            orgIds: users.orgIds,
            branchIds: users.branchIds
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(eq(users.id, memberId));
        if (!member) throw new Error("Member not found");

        // 4. Admin restrictions: Can only edit members, not other admins or owners
        if (isAdmin && !isOwner) {
            if (member.role?.toLowerCase() === 'admin' || member.role?.toLowerCase() === 'owner') {
                throw new Error('Admins can only edit members, not other admins or owners');
            }
            // Admins cannot promote members to admin or owner
            if (roleName?.toLowerCase() === 'admin' || roleName?.toLowerCase() === 'owner') {
                throw new Error('Admins cannot promote members to admin or owner role');
            }
        }

        // Admin single-org constraint check
        let finalRoleId = member.roleId;
        let finalRoleName = member.role;

        if (roleName) {
            const [newRoleRecord] = await db.select().from(roles).where(eq(roles.name, roleName));
            if (!newRoleRecord) throw new Error(`Role ${roleName} not found`);
            finalRoleId = newRoleRecord.id;
            finalRoleName = newRoleRecord.name as any;
        }

        // 5. Do not allow removing the last owner from the organization.
        if (
            member.role?.toLowerCase() === 'owner' &&
            finalRoleName?.toLowerCase() !== 'owner'
        ) {
            const ownerCountResult = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(users)
                .leftJoin(roles, eq(users.roleId, roles.id))
                .where(and(
                    sql`FIND_IN_SET(${orgId}, ${users.orgIds})`,
                    sql`LOWER(${roles.name}) = 'owner'`
                ));

            const ownerCount = Number(ownerCountResult[0]?.count || 0);
            if (ownerCount <= 1) {
                throw new Error('You cannot change the last remaining owner. Add or promote another owner first.');
            }
        }

        const memberOrgIdsCheck = typeof member.orgIds === 'string'
            ? member.orgIds.split(',').filter(Boolean).map(Number)
            : (Array.isArray(member.orgIds) ? member.orgIds : []);

        if (finalRoleName?.toLowerCase() === 'admin' && memberOrgIdsCheck.length > 1) {
            throw new Error("Conflict: This user belongs to multiple organizations and cannot be an ADMIN.");
        }

        // Ensure newBranchIds is always an array
        let newBranchIdsArr: number[] = [];
        if (member.branchIds) {
            let parsedIds: number[] = [];
            if (Array.isArray(member.branchIds)) {
                parsedIds = member.branchIds.map(Number);
            } else if (typeof member.branchIds === 'string') {
                if (member.branchIds.startsWith('[')) {
                    try {
                        parsedIds = JSON.parse(member.branchIds).map(Number);
                    } catch {
                        parsedIds = member.branchIds.replace(/\[|\]/g, '').split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
                    }
                } else {
                    parsedIds = member.branchIds.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
                }
            }
            newBranchIdsArr = parsedIds.filter(n => !isNaN(n));
        }

        // Remove old branches of THIS org
        const orgBranches = await db.select({ id: branches.id })
            .from(branches)
            .where(and(eq(branches.orgId, orgId), isNotDeleted(branches)));
        const orgBranchIds = orgBranches.map(b => b.id);
        newBranchIdsArr = newBranchIdsArr.filter(id => !orgBranchIds.includes(id));

        if (finalRoleName?.toLowerCase() === 'member' && branchIds && branchIds.length > 0) {
            // Deduplicate and ensure numbers
            const uniqueBranchIds = Array.from(new Set(branchIds.map(Number).filter(n => !isNaN(n))));

            if (uniqueBranchIds.length > 0) {
                // Validate branches belong to org
                const validBranches = await db.select({ id: branches.id })
                    .from(branches)
                    .where(and(
                        eq(branches.orgId, orgId),
                        isNotDeleted(branches),
                        inArray(branches.id, uniqueBranchIds)
                    ));

                if (validBranches.length !== uniqueBranchIds.length) {
                    throw new Error("One or more selected branches are invalid.");
                }

                // Add new branches
                newBranchIdsArr = [...newBranchIdsArr, ...uniqueBranchIds];
            }
        }

        // Final sanity deduplication before saving
        newBranchIdsArr = Array.from(new Set(newBranchIdsArr));
        const finalNewBranchIds = newBranchIdsArr.join(',');

        await db.update(users)
            .set({
                roleId: finalRoleId as any,
                branchIds: finalNewBranchIds,
                updatedAt: new Date()
            })
            .where(eq(users.id, memberId));

        await AuditService.log(orgId, 'user', memberId, 'UPDATE_MEMBER_ACCESS', requesterId, null, { role: roleName, branchIds });

        return { message: 'Member access updated successfully' };
    },
};
