import mysql from 'mysql2/promise';

async function run() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'NewPassword@1234',
    database: 'jksol_accounts',
    port: 3307
  });

  const [txns] = await connection.execute('SELECT t.id, t.final_amount, t.amount_local, t.status, e.debit, e.credit, c.code as currency FROM transaction_entries e JOIN transactions t ON e.transaction_id = t.id LEFT JOIN currencies c ON t.currency_id = c.id WHERE e.account_id = 137;');

  console.log("Transations for Account 137:");
  console.table(txns);
  
  process.exit();
}
run();
