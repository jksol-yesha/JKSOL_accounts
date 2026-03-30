import mysql from 'mysql2/promise';

async function main() {
    console.log("DB NAME is:", process.env.DB_NAME);
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "jksol_accounts",
        port: Number(process.env.DB_PORT) || 3307,
    });

    try {
        console.log('Adding preferences column to users...');
        await connection.query('ALTER TABLE users ADD COLUMN preferences JSON');
        console.log('Added preferences column.');
    } catch (e) {
        console.log('Column might already exist or error:', e.message);
    } finally {
        await connection.end();
    }
}

main();
