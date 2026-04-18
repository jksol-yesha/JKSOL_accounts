const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});

async function main() {
    const connection = await mysql.createConnection({
        host: env.DB_HOST || 'localhost',
        user: env.DB_USER || 'root',
        password: env.DB_PASSWORD || '',
        database: env.DB_NAME || 'test_db',
        port: Number(env.DB_PORT) || 3307
    });

    try {
        console.log("Adding branch_id column to accounts table...");
        
        // Add column
        await connection.execute('ALTER TABLE accounts ADD COLUMN branch_id BIGINT UNSIGNED AFTER currency_id');
        console.log("Column branch_id added.");

        // Add foreign key
        await connection.execute('ALTER TABLE accounts ADD CONSTRAINT fk_accounts_branch FOREIGN KEY (branch_id) REFERENCES branches(id)');
        console.log("Foreign key constraint fk_accounts_branch added.");

        console.log("Database updated successfully.");
    } catch (err) {
        console.error("Failed to update database:", err.message);
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log("Note: Column branch_id already exists.");
        }
    } finally {
        await connection.end();
    }
}

main();
