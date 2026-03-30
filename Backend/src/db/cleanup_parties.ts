import { db } from './index';
import { parties } from './schema';
import { sql, eq } from 'drizzle-orm';

async function cleanupData() {
    console.log('Cleaning up duplicate name/companyName data...');
    try {
        // Set name to empty string if it exactly matches companyName
        await db.execute(sql`UPDATE parties SET name = '' WHERE name = company_name`);
        console.log('Cleanup completed.');
    } catch (error) {
        console.error('Cleanup failed:', error);
    } finally {
        process.exit();
    }
}

cleanupData();
