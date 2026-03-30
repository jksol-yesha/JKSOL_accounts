import { db } from './index';
import { sql } from 'drizzle-orm';

async function runMigration() {
    console.log('Starting company_name migration...');
    try {
        // 1. Add company_name column
        await db.execute(sql`ALTER TABLE parties ADD COLUMN company_name VARCHAR(255) AFTER id`);
        console.log('Column company_name added.');

        // 2. Initialize company_name with current name
        await db.execute(sql`UPDATE parties SET company_name = name WHERE company_name IS NULL OR company_name = ''`);
        console.log('Initialized company_name for existing records.');

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

runMigration();
