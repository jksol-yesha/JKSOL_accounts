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
        const [columns] = await connection.execute('DESCRIBE accounts');
        console.log(JSON.stringify(columns, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

main();
