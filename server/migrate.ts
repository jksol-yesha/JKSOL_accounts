import mysql from 'mysql2/promise';
import fs from 'fs';

async function run() {
    console.log("Connecting to", process.env.DB_HOST, process.env.DB_PORT);
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT),
        multipleStatements: true
    });

    const sql = fs.readFileSync('./drizzle/0001_add_dedup_columns.sql', 'utf-8');
    
    console.log("Running migration...");
    try {
        await connection.query(sql);
        console.log("Migration successful!");
    } catch (e) {
        console.error("Migration failed:", e.message);
    }
    
    await connection.end();
}
run();
