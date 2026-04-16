const mysql = require('./node_modules/mysql2/promise');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});

async function debug() {
    console.log("--- TRACING TRANSACTION ENTRIES ---");
    let connection;
    try {
        connection = await mysql.createConnection({
            host: env.DB_HOST || 'localhost',
            user: env.DB_USER || 'root',
            password: env.DB_PASSWORD,
            database: env.DB_NAME,
            port: Number(env.DB_PORT) || 3307
        });

        // Find the transaction IDs that hit Cash wallet (ID 137) for 590
        const [cashEntries] = await connection.execute(
            'SELECT transaction_id FROM transaction_entries WHERE account_id = 137 AND (debit = 590 OR credit = 590)'
        );
        
        const txnIds = cashEntries.map(e => e.transaction_id);
        console.log("Transaction IDs involving 590 for Cash wallet:", txnIds);

        if (txnIds.length === 0) {
            console.log("No transactions found for Cash wallet with 590.");
            return;
        }

        for (const tid of txnIds) {
            console.log(`\n--- Transaction ID: ${tid} ---`);
            const [allEntries] = await connection.execute(
                `SELECT te.account_id, a.name as accountName, te.debit, te.credit, te.description 
                 FROM transaction_entries te 
                 JOIN accounts a ON te.account_id = a.id 
                 WHERE te.transaction_id = ?`,
                 [tid]
            );
            allEntries.forEach(e => {
                console.log(`  Acc: ${e.accountName} (ID: ${e.account_id}) | Dr: ${e.debit} | Cr: ${e.credit} | Desc: ${e.description}`);
            });
        }

    } catch (err) {
        console.error("DIAGNOSTIC FAILED:", err.message);
    } finally {
        if (connection) await connection.end();
        console.log("\n--- END TRACE ---");
    }
}

debug();
