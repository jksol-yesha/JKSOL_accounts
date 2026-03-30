import { db } from '../../db';
import { users } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export const generateOtp = async (email: string): Promise<string> => {
    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    console.log(`[OTP DEBUG] Generated OTP for ${email}: ${otp}`);

    // Insert or Update the user record with the OTP
    await db.insert(users)
        .values({
            email,
            otp,
            otpExpiresAt: expiresAt,
            otpIsUsed: false,
            // Minimal required fields in case this is a brand new user row
            status: 0,
        })
        .onDuplicateKeyUpdate({
            set: {
                otp,
                otpExpiresAt: expiresAt,
                otpIsUsed: false
            }
        });

    return otp;
};

export const checkOtp = async (email: string, otp: string): Promise<boolean> => {
    // 1. Find record by email and otp in users table
    const [record] = await db.select({
        id: users.id,
        otp: users.otp,
        otpExpiresAt: users.otpExpiresAt,
        otpIsUsed: users.otpIsUsed
    })
        .from(users)
        .where(and(
            eq(users.email, email),
            eq(users.otp, otp)
        ))
        .limit(1);

    if (!record) {
        console.log(`[OTP FAIL] No record found for ${email} with provided OTP.`);
        return false;
    }

    if (record.otpIsUsed) {
        console.log(`[OTP FAIL] OTP ${otp} for ${email} is already used.`);
        return false;
    }

    if (record.otpExpiresAt && new Date() > record.otpExpiresAt) {
        console.log(`[OTP FAIL] OTP ${otp} for ${email} expired at ${record.otpExpiresAt} (Now: ${new Date()}).`);
        return false;
    }

    return true;
};

export const markOtpAsUsed = async (email: string, otp: string): Promise<void> => {
    // Find the record first to get ID (safe update)
    const [record] = await db.select({ id: users.id })
        .from(users)
        .where(and(
            eq(users.email, email),
            eq(users.otp, otp),
            eq(users.otpIsUsed, false)
        ))
        .limit(1);

    if (record) {
        await db.update(users)
            .set({ otpIsUsed: true })
            .where(eq(users.id, record.id));
    }
};

export const verifyOtp = async (email: string, otp: string): Promise<boolean> => {
    const isValid = await checkOtp(email, otp);
    if (!isValid) return false;
    await markOtpAsUsed(email, otp);
    return true;
};
