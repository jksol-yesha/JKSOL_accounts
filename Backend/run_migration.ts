import { db } from './src/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';

async function main() {
    try {
        const sqlString = fs.readFileSync('drizzle/create_parties_table.sql', 'utf8');

        const commands = sqlString.split(';').filter((cmd) => cmd.trim() !== '');

        for (const cmd of commands) {
            console.log(`Executing: ${cmd.substring(0, 50)}...`);
            await db.execute(sql.raw(cmd));
        }

        console.log("Migration completed successfully.");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        process.exit();
    }
}

main();
