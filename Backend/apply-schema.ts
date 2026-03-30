
import mysql from 'mysql2/promise';

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "test_db",
        port: Number(process.env.DB_PORT) || 3306,
    });

    try {
        console.log('Migrating status column to INT...');

        // 1. Rename existing status to status_old (if it's not already INT)
        try {
            await connection.query('ALTER TABLE transactions RENAME COLUMN status TO status_old');
        } catch (e) {
            console.log('status column already renamed or not found as enum.');
        }

        // 2. Add new status column as INT
        try {
            await connection.query('ALTER TABLE transactions ADD COLUMN status INT NOT NULL DEFAULT 0');
        } catch (e) {
            console.log('New status column already exists.');
        }

        // 3. Migrate data from status_old to status
        try {
            await connection.query(`
                UPDATE transactions 
                SET status = CASE 
                    WHEN status_old = 'posted' THEN 1 
                    WHEN status_old = 'draft' THEN 0 
                    WHEN status_old = '1' THEN 1
                    WHEN status_old = '0' THEN 0
                    ELSE 0 
                END
                WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'status_old')
            `);
            console.log('Data migrated successfully.');
        } catch (e) {
            console.log('Migration failed or status_old does not exist:', e.message);
        }

        // 4. Drop status_old
        try {
            await connection.query('ALTER TABLE transactions DROP COLUMN status_old');
            console.log('Old status column dropped.');
        } catch (e) {
            console.log('status_old column not found or already dropped.');
        }

        console.log('Schema updated successfully!');
    } catch (error) {
        console.error('Failed to update schema:', error);
    } finally {
        await connection.end();
    }
}

main();
