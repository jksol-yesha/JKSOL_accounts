import type { User } from '../../types/user';
import * as EmailService from '../../shared/email.service';
import * as OtpService from './otp.service';
import { db } from '../../db';
import { users, refreshTokens, organizations, organizationInvitations, financialYears, branches, roles } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from "drizzle-orm";

const sendOtpEmailInBackground = (email: string, otp: string) => {
    EmailService.sendOtpEmail(email, otp).catch((error) => {
        console.error(`[OTP EMAIL ERROR] Failed to send OTP email to ${email}:`, error);
    });
};

export const isBlacklisted = (token: string) => {
    // No blacklist check
    return false;
};

// MySQL JSON columns may return as strings - always parse safely
const parsePrefs = (raw: any): Record<string, any> => {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return {}; }
};

export const updatePreferences = async (userId: number, preferences: any) => {
    const [user] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId));
    const currentPrefs = parsePrefs(user?.preferences);
    const newPrefs = { ...currentPrefs, ...preferences };
    
    await db.update(users).set({ preferences: newPrefs }).where(eq(users.id, userId));
    return { preferences: newPrefs };
};


export const updateUser = async (
    userId: number,
    data: {
        email?: string;
        password?: string;
        name?: string;
        profilePhoto?: string;
    }
) => {
    const [existingUser] = await db.select().from(users).where(eq(users.id, userId));

    if (!existingUser) throw new Error('User not found');

    if (data.email && data.email !== existingUser.email) {
        const [emailExists] = await db.select().from(users).where(and(eq(users.email, data.email), sql`${users.id} != ${userId}`));
        if (emailExists) throw new Error('Email already in use');
    }

    const updateData: any = {};
    if (data.email) updateData.email = data.email;
    if (data.name) updateData.fullName = data.name; // Mapping name -> fullName

    // ADDED: Logic to update profile photo
    if (data.profilePhoto) {
        updateData.profilePhoto = data.profilePhoto;
    }

    if (data.email) updateData.email = data.email;
    if (data.name) updateData.fullName = data.name; // Mapping name -> fullName

    // ADDED: Logic to update profile photo
    if (data.profilePhoto) {
        updateData.profilePhoto = data.profilePhoto;
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));

    return {
        id: existingUser.id,
        email: updateData.email || existingUser.email,
        name: updateData.fullName || existingUser.fullName,
        // ADDED: Return the new profile photo if updated, or the existing one
        profilePhoto: updateData.profilePhoto || existingUser.profilePhoto,
        isVerified: true // Assuming active for now
    };
};

export const signup = async ({
    email,
    password,
    name,
    phoneNumber,
    role
}: {
    email: string;
    password: string;
    name: string;
    phoneNumber?: string;
    role?: string;
}) => {
    console.log(`🔍 Checking if user exists with email: "${email}"`);
    const [exists] = await db.select().from(users).where(eq(users.email, email));

    if (exists) {
        throw new Error('User already exists');
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Use a transaction to ensure atomicity
    return await db.transaction(async (tx) => {
        try {
            // 1. Get Owner Role ID
            const [ownerRole] = await tx.select().from(roles).where(eq(roles.name, 'Owner'));
            if (!ownerRole) throw new Error('Owner role not found in database');

            // 1b. Create User (initially without org)
            const [userResult] = await tx.insert(users).values({
                email,
                fullName: name,
                phone: phoneNumber,
                roleId: ownerRole.id, // Set roleId instead of role enum
                orgIds: "", // Empty string
                branchIds: "", // Empty string
                status: 1,
                verificationToken: verificationCode,
            });
            const userId = userResult.insertId;

            // 2. Create default organization for the user
            const defaultOrgName = `${name}'s Organization`;
            const [orgResult] = await tx.insert(organizations).values({
                name: defaultOrgName,
                status: 1,
            });
            const orgId = orgResult.insertId;

            // 3. Update user with the new organization ID
            await tx.update(users)
                .set({ orgIds: String(orgId) })
                .where(eq(users.id, userId));

            // 4. Auto-Create Financial Years (Current & Next) - Same logic as organization.service.ts
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth(); // 0-11

            // Determine Current FY (April-March cycle)
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
                    orgId: orgId,
                    name: currentFyName,
                    startDate: `${startYear}-04-01`,
                    endDate: `${startYear + 1}-03-31`,
                    isCurrent: 'yes',
                    status: 1
                },
                {
                    orgId: orgId,
                    name: nextFyName,
                    startDate: `${startYear + 1}-04-01`,
                    endDate: `${startYear + 2}-03-31`,
                    isCurrent: 'no',
                    status: 1
                }
            ]);

            // 5. Send verification email
            await EmailService.sendVerificationEmail(email, verificationCode);

            return { id: userId, email, name, phoneNumber, organizationId: orgId };
        } catch (error) {
            console.error('Error during signup transaction:', error);
            throw error;
        }
    });
};



export const verifyEmail = async (token: string) => {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token));

    if (!user) throw new Error('Invalid verification token');

    await db.update(users)
        .set({
            status: 1,
            verificationToken: null
        })
        .where(eq(users.id, user.id));

    return {
        message: 'Email verified successfully'
    };
};

export const logout = async (token: string, refreshToken?: string) => {
    if (refreshToken) {
        await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
    }
    return { message: 'Logged out successfully' };
};

export const refreshToken = async (incomingRefreshToken: string, jwt: any) => {
    const [storedToken] = await db.select().from(refreshTokens).where(eq(refreshTokens.token, incomingRefreshToken));

    if (!storedToken) throw new Error('Invalid refresh token');

    const now = new Date();
    if (now > storedToken.expiresAt) {
        await db.delete(refreshTokens).where(eq(refreshTokens.token, incomingRefreshToken));
        throw new Error('Refresh token expired');
    }

    // Get user to verify they still exist/active
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
        .where(eq(users.id, storedToken.userId));

    if (!user || user.status !== 1) throw new Error('User inactive or invalid');

    // Safe access after guard
    const orgIdsParsed = typeof user.orgIds === 'string'
        ? user.orgIds.split(',').filter(Boolean).map(Number)
        : (Array.isArray(user.orgIds) ? user.orgIds : []);
    const branchIdsParsed = typeof user.branchIds === 'string'
        ? user.branchIds.split(',').filter(Boolean).map(Number)
        : (Array.isArray(user.branchIds) ? user.branchIds : []);

    const newAccessToken = await jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role ? user.role.toLowerCase() : null,
        orgIds: orgIdsParsed,
        branchIds: branchIdsParsed,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    });

    return {
        accessToken: newAccessToken
    };
};


export const acceptInvite = async ({ token, password, name }: { token: string, password?: string, name?: string }) => {
    // 1. Find Invitation and join with roles to get role name
    // 1. Find Invitation
    const [invite] = await db.select({
        id: organizationInvitations.id,
        email: organizationInvitations.email,
        orgId: organizationInvitations.orgId,
        roleId: organizationInvitations.roleId,
        roleName: roles.name, // Rename temporarily to avoid collision
        branchIds: organizationInvitations.branchIds,
        status: organizationInvitations.status,
        expiresAt: organizationInvitations.expiresAt,
        token: organizationInvitations.token,
        inviterId: organizationInvitations.inviterId,
    })
        .from(organizationInvitations)
        .leftJoin(roles, eq(organizationInvitations.roleId, roles.id))
        .where(eq(organizationInvitations.token, token));

    if (!invite) throw new Error('Invalid invitation token');

    // Normalize role name
    const inviteRole = invite.roleName;

    if (invite.status !== 'pending') throw new Error('Invitation already processed or invalid');
    if (invite.expiresAt && new Date() > invite.expiresAt) throw new Error('Invitation expired');

    // 2. Check if user exists
    const [existingUser] = await db.select({
        id: users.id,
        email: users.email,
        role: roles.name,
        orgIds: users.orgIds,
        branchIds: users.branchIds,
        roleId: users.roleId, // Also fetch roleId for existing user
        createdBy: users.createdBy
    })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.email, invite.email));

    let userId = existingUser ? existingUser.id : 0;

    // 1c. Strict Single-Organization Constraint
    // 1. Owners can join multiple orgs, but only as Owners.
    // 2. Admins and Members are strictly restricted to a single organization and cannot join any others.
    const currentOrgIdsCheck = typeof existingUser?.orgIds === 'string'
        ? existingUser.orgIds.split(',').filter(Boolean).map(Number)
        : (Array.isArray(existingUser?.orgIds) ? existingUser.orgIds : []);

    if (existingUser && currentOrgIdsCheck.length > 0 && !currentOrgIdsCheck.includes(invite.orgId)) {
        const currentRole = existingUser.role;

        if (currentRole === 'admin' || currentRole === 'member') {
            throw new Error(`Conflict: As a ${currentRole.toUpperCase()}, you are restricted to a single organization and cannot join another.`);
        }

        if (currentRole === 'owner' && inviteRole !== 'owner') {
            throw new Error("Conflict: As an OWNER, you can only join other organizations as an OWNER.");
        }
    }

    // Parse branchIds safely from string
    let inviteBranchIds: number[] = [];
    if (inviteRole === 'member' && invite.branchIds) {
        if (typeof invite.branchIds === 'string') {
            inviteBranchIds = invite.branchIds.split(',').filter(Boolean).map(Number);
        } else if (Array.isArray(invite.branchIds)) {
            inviteBranchIds = invite.branchIds;
        }
    }

    console.log(`[AcceptInvite] Role: ${inviteRole}, Raw BranchIds: ${invite.branchIds}, Parsed: ${JSON.stringify(inviteBranchIds)}`);

    return await db.transaction(async (tx) => {
        let currentUser = existingUser;

        if (!existingUser) {
            // Create New User
            if (!name) throw new Error('Name required for new user registration');

            try {
                console.log('[AcceptInvite] Inserting user:', { email: invite.email, roleId: invite.roleId, orgId: invite.orgId });
                const [res] = await tx.insert(users).values({
                    email: invite.email,
                    fullName: name,
                    phone: "",
                    roleId: invite.roleId,
                    orgIds: "",
                    branchIds: "",
                    status: 1,
                });
                userId = Number(res.insertId);
            } catch (err: any) {
                console.error('[AcceptInvite] Error creating user during invite acceptance:', err);
                throw new Error('Failed to create user during invite acceptance');
            }
        } else {
            // Update Existing User
            // Parse orgIds from string if needed
            let currentOrgIds: number[] = [];
            if (existingUser.orgIds) {
                currentOrgIds = typeof existingUser.orgIds === 'string'
                    ? existingUser.orgIds.split(',').filter(Boolean).map(Number)
                    : (Array.isArray(existingUser.orgIds) ? existingUser.orgIds as number[] : []);
            }
            const newOrgIds = Array.from(new Set([...currentOrgIds, invite.orgId])).join(',');

            // Calculate new branch IDs
            // Parse branchIds from string if needed
            let currentBranchIds: number[] = [];
            if (existingUser.branchIds) {
                currentBranchIds = typeof existingUser.branchIds === 'string'
                    ? existingUser.branchIds.split(',').filter(Boolean).map(Number)
                    : (Array.isArray(existingUser.branchIds) ? existingUser.branchIds : []);
            }

            let newBranchIdsArr = currentBranchIds;
            if (inviteRole === 'member') {
                newBranchIdsArr = Array.from(new Set([...currentBranchIds, ...inviteBranchIds]));
            }
            const newBranchIds = newBranchIdsArr.join(',');

            await tx.update(users)
                .set({
                    roleId: existingUser.roleId || invite.roleId as any, // Update if null
                    orgIds: newOrgIds,
                    branchIds: newBranchIds,
                    status: 1, // Reactivate user
                    updatedAt: new Date()
                })
                .where(eq(users.id, userId));
        }

        // 5. Update Status (Bulk Accept Duplicates)
        await tx.update(organizationInvitations)
            .set({ status: 'accepted', token: null, updatedAt: new Date() })
            .where(and(
                eq(organizationInvitations.email, invite.email),
                eq(organizationInvitations.orgId, invite.orgId),
                eq(organizationInvitations.status, 'pending')
            ));

        return { message: 'Invitation accepted successfully', userId };
    });
};

export const declineInvite = async ({ token }: { token: string }) => {
    // 1. Find Invitation
    const [invite] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.token, token));

    if (!invite) throw new Error('Invalid invitation token');
    if (invite.status !== 'pending') throw new Error('Invitation already processed or invalid');

    // 2. Update Status to Rejected
    await db.update(organizationInvitations)
        .set({ status: 'rejected', token: null, updatedAt: new Date() })
        .where(eq(organizationInvitations.id, invite.id));

    return { message: 'Invitation declined successfully' };
};

export const getInviteDetails = async (token: string) => {
    const [invite] = await db.select({
        email: organizationInvitations.email,
        orgId: organizationInvitations.orgId,
        roleId: organizationInvitations.roleId,
        role: roles.name,
        status: organizationInvitations.status,
        expiresAt: organizationInvitations.expiresAt
    })
        .from(organizationInvitations)
        .leftJoin(roles, eq(organizationInvitations.roleId, roles.id))
        .where(eq(organizationInvitations.token, token));

    if (!invite) throw new Error('Invalid invitation token');
    if (invite.status !== 'pending') throw new Error('Invitation already processed or invalid');
    if (invite.expiresAt && new Date() > invite.expiresAt) throw new Error('Invitation expired');

    // Get Organization Name
    const [org] = await db.select().from(organizations).where(eq(organizations.id, invite.orgId));
    const [invitedUser] = await db.select({
        fullName: users.fullName
    }).from(users).where(eq(users.email, invite.email));

    return {
        email: invite.email,
        name: invitedUser?.fullName || '',
        role: invite.role, // role name from join
        roleId: invite.roleId as any,
        orgName: org ? org.name : 'Unknown Organization',
        orgLogo: org ? org.logo : null
    };
};

export const getAllUsers = async () => {
    // ... existing ...

    const allUsers = await db.select().from(users);
    return allUsers.map(user => ({
        id: user.id,
        email: user.email,
        name: user.fullName,
        isVerified: user.status === 1,
        profilePhoto: user.profilePhoto
    }));
};

// --- OTP AUTHENTICATION ---

export const sendLoginOtp = async (email: string) => {
    const [user] = await db.select().from(users).where(eq(users.email, email));

    // Check if user exists
    if (!user) {
        throw new Error('Invalid email details');
    }

    // Block if user is inactive
    if (user.status !== 1) throw new Error('User is assigned but inactive');

    const otp = await OtpService.generateOtp(email);
    sendOtpEmailInBackground(email, otp);

    return { message: 'OTP sent to email', email };
};

export const verifyLoginOtp = async (email: string, otp: string, jwt: any) => {
    // 1. Check if OTP is valid (without consuming it)
    const isValid = await OtpService.checkOtp(email, otp);
    if (!isValid) throw new Error('Invalid or expired OTP');

    console.log(`[AUTH DEBUG] OTP valid for ${email}. Proceeding to login...`);

    try {
        // 2. Reuse Login Logic (fetch user, roles, etc.)
        let [user] = await db.select({
            id: users.id,
            email: users.email,
            fullName: users.fullName,
            phone: users.phone,
            status: users.status,
            role: roles.name,
            roleId: users.roleId,
            orgIds: users.orgIds,
            branchIds: users.branchIds,
            createdAt: users.createdAt,
            profilePhoto: users.profilePhoto,
            preferences: users.preferences
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(eq(users.email, email));

        // [MODIFIED] Auto-Signup: Create user if not found
        if (!user) {
            console.log(`[AUTH INFO] New user detected: ${email}. Creating 'owner' account...`);

            // Get Owner Role
            const [ownerRole] = await db.select().from(roles).where(eq(roles.name, 'Owner'));
            if (!ownerRole) throw new Error('System Error: Default role not found');

            // 1. Create Default Organization
            const defaultName = email.split('@')[0];
            const [orgResult] = await db.insert(organizations).values({
                name: `${defaultName}'s Organization`,
                status: 1,
                baseCurrency: 'USD' // Default
            });
            const newOrgId = orgResult.insertId;

            // 2. Create Default Branch
            const [branchResult] = await db.insert(branches).values({
                orgId: newOrgId,
                name: 'Main Branch',
                code: 'MAIN',
                currencyCode: 'USD',
                status: 1
            });
            const newBranchId = branchResult.insertId;

            // 3. Create Financial Years (2025-2026, 2026-2027)
            // Current Date is 2026-02-16, which falls in 2025-2026 FY (Apr 2025 - Mar 2026)
            await db.insert(financialYears).values([
                {
                    orgId: newOrgId,
                    name: '2025-2026',
                    startDate: '2025-04-01',
                    endDate: '2026-03-31',
                    isCurrent: 'yes',
                    status: 1
                },
                {
                    orgId: newOrgId,
                    name: '2026-2027',
                    startDate: '2026-04-01',
                    endDate: '2027-03-31',
                    isCurrent: 'no',
                    status: 1
                }
            ]);

            // 4. Insert New User linked to Org & Branch
            const [insertResult] = await db.insert(users).values({
                email: email,
                roleId: ownerRole.id,
                status: 1, // Active
                fullName: defaultName,
                orgIds: String(newOrgId),
                branchIds: String(newBranchId),
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Re-fetch the new user with joined role data
            [user] = await db.select({
                id: users.id,
                email: users.email,
                fullName: users.fullName,
                phone: users.phone,
                status: users.status,
                role: roles.name,
                roleId: users.roleId,
                orgIds: users.orgIds,
                branchIds: users.branchIds,
                createdAt: users.createdAt,
                profilePhoto: users.profilePhoto,
                preferences: users.preferences
            })
                .from(users)
                .leftJoin(roles, eq(users.roleId, roles.id))
                .where(eq(users.id, insertResult.insertId));
        }

        // 3. Mark OTP as used NOW that user is found/created
        await OtpService.markOtpAsUsed(email, otp);
        console.log(`[AUTH DEBUG] OTP marked as used for ${email}.`);

        if (!user) throw new Error('User could not be found or created');

        // Log the user in
        const orgIdsParsed = typeof user.orgIds === 'string'
            ? user.orgIds.split(',').filter(Boolean).map(Number)
            : (Array.isArray(user.orgIds) ? user.orgIds : []);
        const branchIdsParsed = typeof user.branchIds === 'string'
            ? user.branchIds.split(',').filter(Boolean).map(Number)
            : (Array.isArray(user.branchIds) ? user.branchIds : []);

        const accessToken = await jwt.sign({
            sub: String(user.id),
            userId: user.id,
            email: user.email,
            role: user.role || 'member',
            orgIds: orgIdsParsed,
            branchIds: branchIdsParsed,
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        });

        const refreshTokenStr = crypto.randomUUID();
        const refreshTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await db.insert(refreshTokens).values({
            userId: user.id,
            token: refreshTokenStr,
            expiresAt: refreshTokenExpires
        });

        return {
            accessToken,
            refreshToken: refreshTokenStr,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role || 'member',
                roleId: user.roleId,
                orgIds: user.orgIds,
                branchIds: user.branchIds,
                lastLoginAt: new Date(),
                isVerified: true,
                createdAt: user.createdAt,
                profilePhoto: user.profilePhoto,
                preferences: parsePrefs(user.preferences)
            }
        };
    } catch (error) {
        console.error('[AUTH ERROR] verifyLoginOtp failed:', error);
        throw error;
    }
};

export const sendInviteOtp = async (token: string, email?: string) => {
    // Validate token and get email
    const [invite] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.token, token));

    if (!invite) throw new Error('Invalid invitation token');
    if (invite.status !== 'pending') throw new Error('Invitation already processed or invalid');
    if (invite.expiresAt && new Date() > invite.expiresAt) throw new Error('Invitation expired');

    let targetEmail = invite.email;

    // IF user provided a new email, update the invitation
    if (email && email !== invite.email) {
        // [MODIFIED] Check if new email is already taken by a USER
        // Requirement: User must ALREADY exist to associate invite.

        const [existingUser] = await db.select().from(users).where(eq(users.email, email));
        if (!existingUser) {
            throw new Error('Invalid email id'); // As requested
        }

        console.log(`[AcceptInvite] Updating Email from ${invite.email} to ${email}`);
        await db.update(organizationInvitations)
            .set({ email: email })
            .where(eq(organizationInvitations.id, invite.id));

        targetEmail = email;
    }

    const otp = await OtpService.generateOtp(targetEmail);
    sendOtpEmailInBackground(targetEmail, otp);

    return { message: 'OTP sent to email', email: targetEmail };
};

export const verifyInviteOtp = async (token: string, otp: string, name: string | undefined, jwt: any) => {
    console.log("SERVER VERSION: OTP_DEBUG_V3 - verifyInviteOtp called", { token, otp, name });
    // 1. Get invite
    const [invite] = await db.select().from(organizationInvitations).where(eq(organizationInvitations.token, token));
    if (!invite) throw new Error('Invalid invitation token');
    if (invite.status !== 'pending') throw new Error('Invitation already processed or invalid');
    if (invite.expiresAt && new Date() > invite.expiresAt) throw new Error('Invitation expired');

    // 2. Verify OTP (Check only)
    console.log(`[AUTH DEBUG] Verifying OTP for ${invite.email}. Input: ${otp}`);
    const isValid = await OtpService.checkOtp(invite.email, otp);
    console.log(`[AUTH DEBUG] OTP Verification Result: ${isValid}`);

    if (!isValid) throw new Error('Invalid or expired OTP');

    console.log(`[AUTH DEBUG] OTP valid for invite ${invite.email}.`);

    try {
        // 3. Check if user exists
        let [user] = await db.select().from(users).where(eq(users.email, invite.email));

        const normalizedInviteName = typeof name === 'string' ? name.trim() : '';

        // 4. Create User if not exists
        if (!user) {
            // Default name if not provided (e.g. "john" from "john@doe.com")
            const finalName = normalizedInviteName || invite.email.split('@')[0];

            // Fetch Role ID based on invite.role (if available) - assuming default role if not found or handled differently
            // Note: invite.roleId should ideally be used if available, else invite.role string mapping
            let roleId = invite.roleId;

            const insertValues = {
                email: invite.email,
                fullName: finalName,
                roleId: roleId,
                status: 1, // Explicitly set active status
                createdBy: invite.inviterId,
            };
            console.log('[AUTH DEBUG] Inserting user:', insertValues);

            try {
                const [result] = await db.insert(users).values(insertValues);
                [user] = await db.select().from(users).where(eq(users.id, result.insertId));
            } catch (error) {
                console.error('[AUTH DEBUG] DB Insert User Failed:', error);
                if (error instanceof Error) {
                    console.error('Error Stack:', error.stack);
                }
                throw error;
            }
        }

        // 5. Add to Organization (Update orgIds)
        // [MODIFIED] Logic for Owner vs Member

        let newOrgIds: number[] = [];
        let newBranchIds: number[] = [];

        // Fetch user's current IDs
        if (!user) throw new Error('User identification failed');
        let currentOrgIds: number[] = [];
        if (user.orgIds) {
            currentOrgIds = String(user.orgIds).split(',').filter(Boolean).map(Number);
        }
        let currentBranchIds: number[] = [];
        if (user.branchIds) {
            currentBranchIds = String(user.branchIds).split(',').filter(Boolean).map(Number);
        }

        // Resolve Invite Role Name
        const [roleRecord] = await db.select().from(roles).where(eq(roles.id, invite.roleId));
        const inviteRoleName = roleRecord?.name?.toLowerCase();

        if (inviteRoleName === 'owner') {
            console.log('[AcceptInvite] Role is OWNER. Copying all access from Inviter.');

            const [inviter] = await db.select().from(users).where(eq(users.id, invite.inviterId));
            if (inviter && inviter.id) {
                // Parse Inviter's IDs
                const inviterOrgIds = inviter.orgIds ? String(inviter.orgIds).split(',').filter(Boolean).map(Number) : [];
                const inviterBranchIds = inviter.branchIds ? String(inviter.branchIds).split(',').filter(Boolean).map(Number) : [];

                // Merge with User's existing IDs (if any)
                newOrgIds = Array.from(new Set([...currentOrgIds, ...inviterOrgIds]));
                newBranchIds = Array.from(new Set([...currentBranchIds, ...inviterBranchIds]));
            } else {
                console.warn('[AcceptInvite] Inviter not found for Owner Invite. Falling back to single org.');
                newOrgIds = Array.from(new Set([...currentOrgIds, invite.orgId]));
                newBranchIds = currentBranchIds; // No branch IDs in invite for owner usually
            }
        } else {
            // Standard Member Logic: Add specific Org and specific Branches
            newOrgIds = Array.from(new Set([...currentOrgIds, invite.orgId]));

            const inviteBranchIds = invite.branchIds ? String(invite.branchIds).split(',').filter(Boolean).map(Number) : [];
            newBranchIds = Array.from(new Set([...currentBranchIds, ...inviteBranchIds]));
        }

        // Update User
        if (!user || !user.id) throw new Error('User not identified for update');
        const updateValues: any = {
            orgIds: newOrgIds.join(','),
            branchIds: newBranchIds.join(','),
            status: 1, // Ensure active
            roleId: invite.roleId // Update role to match invite (e.g. promote to Owner if not already)
        };

        // Keep profile full name aligned with the invited name when provided.
        if (normalizedInviteName) {
            updateValues.fullName = normalizedInviteName;
        } else if (!user.fullName) {
            updateValues.fullName = invite.email.split('@')[0];
        }

        await db.update(users)
            .set(updateValues)
            .where(eq(users.id, user.id));

        // 6. Update Invite Status
        await db.update(organizationInvitations)
            .set({ status: 'accepted' })
            .where(eq(organizationInvitations.id, invite.id));

        // 7. Mark OTP used
        await OtpService.markOtpAsUsed(invite.email, otp);
        console.log(`[AUTH DEBUG] OTP marked as used for invite ${invite.email}.`);

        const [updatedUser] = await db.select({
            id: users.id,
            email: users.email,
            fullName: users.fullName,
            roleId: users.roleId,
            role: roles.name,
            orgIds: users.orgIds,
            branchIds: users.branchIds,
            status: users.status,
            preferences: users.preferences
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(eq(users.id, user.id));

        if (!updatedUser) throw new Error('Failed to retrieve updated user');

        // 8. Generate Tokens
        const accessTokenArrOrgIds = updatedUser.orgIds ? String(updatedUser.orgIds).split(',').filter(Boolean).map(Number) : [];
        const accessTokenArrBranchIds = updatedUser.branchIds ? String(updatedUser.branchIds).split(',').filter(Boolean).map(Number) : [];

        console.log(`✅ [VerifyInviteOtp] Success: ${updatedUser.email}. Generating tokens.`);

        const accessToken = await jwt.sign({
            sub: String(updatedUser.id),
            userId: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role || 'member',
            orgIds: accessTokenArrOrgIds,
            branchIds: accessTokenArrBranchIds,
            exp: Math.floor(Date.now() / 1000) + (1 * 60 * 60 * 24) // 24 hours for now to avoid expiration issues during dev
        });

        const refreshToken = await jwt.sign({
            sub: String(updatedUser.id),
            userId: updatedUser.id,
            exp: Math.floor(Date.now() / 1000) + (1 * 60 * 60 * 24 * 30) // 30 days
        });

        return {
            accessToken,
            refreshToken,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                fullName: updatedUser.fullName,
                role: updatedUser.role,
                roleId: updatedUser.roleId,
                orgIds: updatedUser.orgIds,
                branchIds: updatedUser.branchIds,
                isVerified: updatedUser.status === 1,
                preferences: parsePrefs(updatedUser.preferences)
            },
            joinedOrgId: invite.orgId,
            joinedBranchIds: invite.branchIds
        };
    } catch (error) {
        console.error('[AUTH ERROR] verifyInviteOtp failed:', error);
        throw error;
    }
};
