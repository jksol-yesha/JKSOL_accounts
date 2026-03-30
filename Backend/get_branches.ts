import { db } from './src/db/index';
import { sql } from 'drizzle-orm';

async function run() {
    try {
        const result = await db.execute(sql`SELECT id, name, status FROM branches`);
        console.log("Branches:", result[0]);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
