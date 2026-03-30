import { db } from './index';
import { sql } from 'drizzle-orm';

async function main() {
    console.log("Adding missing columns to accounts table...");
    try {
        await db.execute(sql`ALTER TABLE accounts ADD COLUMN account_number VARCHAR(50)`);
        console.log("Added account_number");
    } catch (e) {
        console.log("account_number might already exist or error:", e.message);
    }

    try {
        await db.execute(sql`ALTER TABLE accounts ADD COLUMN ifsc VARCHAR(20)`);
        console.log("Added ifsc");
    } catch (e) {
        console.log("ifsc might already exist or error:", e.message);
    }

    console.log("Done.");
    process.exit(0);
}

main();
