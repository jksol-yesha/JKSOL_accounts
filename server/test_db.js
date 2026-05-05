import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

async function run() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'NewPassword@1234',
    database: 'jksol_accounts',
    port: 3307
  });
  const [rows] = await connection.execute('SELECT id, name, final_balance FROM accounts;');
  console.log(rows);
  process.exit(0);
}
run();
