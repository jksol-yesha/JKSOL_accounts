import { db } from './src/db';
import { users } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function test() {
    const testPrefs = { currency: 'USD', dateFormat: 'MM/DD/YYYY', numberFormat: 'en-US', timeZone: 'Asia/Kolkata' };
    
    console.log("Saving preferences for user 1...");
    await db.update(users).set({ preferences: testPrefs }).where(eq(users.id, 1));
    
    const [user] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, 1));
    console.log("Read back type:", typeof user.preferences);
    console.log("Read back value:", user.preferences);
    
    // Now clear it back to null
    await db.update(users).set({ preferences: null }).where(eq(users.id, 1));
    console.log("Cleared back to null. Done.");
    process.exit(0);
}

test();
