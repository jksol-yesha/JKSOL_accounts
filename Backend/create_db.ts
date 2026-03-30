
import mysql from "mysql2/promise";
// Bun automatically loads .env files

async function createDb() {
    console.log(`Connecting to ${process.env.DB_HOST} as ${process.env.DB_USER}`);
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
        console.log(`Database '${process.env.DB_NAME}' created or already exists.`);

        await connection.end();
        process.exit(0);
    } catch (error: any) {
        console.error("Failed to create DB:", error.message);
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error("Access Denied! Incorrect password.");
        }
        process.exit(1);
    }
}

createDb();
