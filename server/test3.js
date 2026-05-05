import mysql from 'mysql2/promise';

async function run() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'NewPassword@1234',
    database: 'jksol_accounts',
    port: 3307
  });

  const [accounts] = await connection.execute('SELECT id, name, subtype FROM accounts');
  console.table(accounts.filter(a => a.name.toLowerCase().includes('check') || a.name.toLowerCase().includes('cash') || a.subtype === 11 || a.subtype === 13 || a.name.toLowerCase().includes('hand')));
  
  process.exit();
}
run();
