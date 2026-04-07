import type { User } from '../../types/user';
import * as EmailService from '../../shared/email.service';
import * as OtpService from './otp.service';
import { db } from '../../db';
import { users, organizations, financialYears, branches, roles } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from "drizzle-orm";

const ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

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
    role
}: {
    email: string;
    password: string;
    name: string;
    role?: string;
}) => {
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
                    endDate: `${startYear + 1}-03-31`
                },
                {
                    orgId: orgId,
                    name: nextFyName,
                    startDate: `${startYear + 1}-04-01`,
                    endDate: `${startYear + 2}-03-31`
                }
            ]);

            // 5. Send verification email
            await EmailService.sendVerificationEmail(email, verificationCode);

            return { id: userId, email, name, organizationId: orgId };
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
        // Find user by this refresh token
        const [user] = await db.select({ id: users.id, refreshTokens: users.refreshTokens })
            .from(users)
            .where(sql`JSON_CONTAINS(${users.refreshTokens}, JSON_OBJECT('token', ${refreshToken}))`);

        if (user) {
            const currentTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
            const updatedTokens = currentTokens.filter((t: any) => t.token !== refreshToken);
            await db.update(users).set({ refreshTokens: updatedTokens }).where(eq(users.id, user.id));
        }
    }
    return { message: 'Logged out successfully' };
};

export const refreshToken = async (incomingRefreshToken: string, jwt: any) => {
    // Find user who has this token
    const [user] = await db.select({
        id: users.id,
        email: users.email,
        role: roles.name,
        orgIds: users.orgIds,
        branchIds: users.branchIds,
        status: users.status,
        refreshTokens: users.refreshTokens
    })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(sql`JSON_CONTAINS(${users.refreshTokens}, JSON_OBJECT('token', ${incomingRefreshToken}))`);

    if (!user) throw new Error('Invalid refresh token');

    const currentTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
    const storedToken = currentTokens.find((t: any) => t.token === incomingRefreshToken);

    if (!storedToken) throw new Error('Invalid refresh token');

    const now = new Date();
    if (now > new Date(storedToken.expiresAt)) {
        const updatedTokens = currentTokens.filter((t: any) => t.token !== incomingRefreshToken);
        await db.update(users).set({ refreshTokens: updatedTokens }).where(eq(users.id, user.id));
        throw new Error('Refresh token expired');
    }

    if (user.status !== 1) throw new Error('User inactive or invalid');

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
        exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS // 7 days
    });

    return {
        accessToken: newAccessToken
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
        console.warn(`[AuthService] sendLoginOtp: User not found for email "${email}"`);
        throw new Error('Invalid email details');
    }

    // Block if user is inactive
    if (user.status !== 1) {
        console.warn(`[AuthService] sendLoginOtp: User "${email}" is inactive (status=${user.status})`);
        throw new Error('User is assigned but inactive');
    }

    const otp = await OtpService.generateOtp(email);
    sendOtpEmailInBackground(email, otp);

    return { message: 'OTP sent to email', email };
};

export const verifyLoginOtp = async (email: string, otp: string, jwt: any) => {
    // 1. Check if OTP is valid (without consuming it)
    const isValid = await OtpService.checkOtp(email, otp);
    if (!isValid) throw new Error('Invalid or expired OTP');

    try {
        // 2. Reuse Login Logic (fetch user, roles, etc.)
        let [user] = await db.select({
            id: users.id,
            email: users.email,
            fullName: users.fullName,
            status: users.status,
            role: roles.name,
            roleId: users.roleId,
            orgIds: users.orgIds,
            branchIds: users.branchIds,
            createdAt: users.createdAt,
            profilePhoto: users.profilePhoto,
            preferences: users.preferences,
            refreshTokens: users.refreshTokens
        })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(eq(users.email, email));

        // [MODIFIED] Auto-Signup: Create user if not found
        if (!user) {

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
                    endDate: '2026-03-31'
                },
                {
                    orgId: newOrgId,
                    name: '2026-2027',
                    startDate: '2026-04-01',
                    endDate: '2027-03-31'
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
                status: users.status,
                role: roles.name,
                roleId: users.roleId,
                orgIds: users.orgIds,
                branchIds: users.branchIds,
                createdAt: users.createdAt,
                profilePhoto: users.profilePhoto,
                preferences: users.preferences,
                refreshTokens: users.refreshTokens
            })
                .from(users)
                .leftJoin(roles, eq(users.roleId, roles.id))
                .where(eq(users.id, insertResult.insertId));
        }

        // 3. Mark OTP as used NOW that user is found/created
        await OtpService.markOtpAsUsed(email, otp);

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
            exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS // 7 days
        });

        const refreshTokenStr = crypto.randomUUID();
        const refreshTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        // Manage refresh tokens in JSON array
        const currentTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
        const now = new Date();
        
        // Cleanup expired tokens and limit to max 10 sessions
        const updatedTokens = currentTokens
            .filter((t: any) => new Date(t.expiresAt) > now)
            .slice(-9); // Keep last 9, then we add 1 = total 10

        updatedTokens.push({
            token: refreshTokenStr,
            expiresAt: refreshTokenExpires.toISOString(),
            createdAt: now.toISOString()
        });

        await db.update(users).set({ refreshTokens: updatedTokens }).where(eq(users.id, user.id));

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
