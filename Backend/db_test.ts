import { db } from './src/db/index';
import { sql } from 'drizzle-orm';

async function run() {
    try {
        const result = await db.execute(sql`SELECT id, name, opening_balance FROM accounts ORDER BY id DESC LIMIT 5`);
        console.log("Accounts:", result[0]);

        const lastId = (result[0] as any[])[0].id;

        const txs = await db.execute(sql`SELECT * FROM transaction_entries WHERE account_id = ${lastId}`);
        console.log("Transactions:", txs[0]);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
