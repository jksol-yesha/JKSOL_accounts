import { db } from './index';
import { parties } from './schema';
import { sql } from 'drizzle-orm';

async function checkData() {
    console.log('Checking parties data...');
    try {
        const result = await db.select().from(parties).limit(10);
        console.log('Sample Data:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        process.exit();
    }
}

checkData();
