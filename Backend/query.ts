import { createConnection } from 'mysql2/promise';

async function main() {
    const connection = await createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: 'NewPassword@1234',
        database: 'jksol_accounts',
        port: 3307
    });
    try {
        const [rows] = await connection.query('SELECT COUNT(*) as cnt FROM currencies');
        console.log("Currencies count:", rows);
        
        const [rows2] = await connection.query('SELECT COUNT(*) as cnt FROM countries');
        console.log("Countries count:", rows2);
    } catch(e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}
main();
