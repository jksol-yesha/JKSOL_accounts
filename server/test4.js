import mysql from 'mysql2/promise';

async function run() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'NewPassword@1234',
    database: 'jksol_accounts',
    port: 3307
  });

  const [res] = await connection.execute('SELECT * FROM transactions WHERE amount_local = 25317.92 OR final_amount = 25317.92;');
  console.table(res);
  const [res2] = await connection.execute('SELECT * FROM transaction_entries WHERE debit = 25317.92 OR credit = 25317.92;');
  console.table(res2);
  const [res3] = await connection.execute('SELECT * FROM accounts WHERE opening_balance = 25317.92 OR opening_balance = -25317.92;');
  console.table(res3);
  
  process.exit();
}
run();
