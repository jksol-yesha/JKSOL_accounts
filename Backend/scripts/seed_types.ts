
import { db } from '../src/db';
import { transactionTypes } from '../src/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('Seeding transaction types...');
    const types = ['Income', 'Expense', 'Transfer'];

    for (const name of types) {
        try {
            await db.insert(transactionTypes).values({ name }).onDuplicateKeyUpdate({ set: { name } });
            console.log(`Ensured type: ${name}`);
        } catch (e: any) {
            console.error(`Error seeding ${name}:`, e.message);
        }
    }
    console.log('Done seeding types.');
    process.exit(0);
}

main();
