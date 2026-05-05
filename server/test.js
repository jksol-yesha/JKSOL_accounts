import mysql from 'mysql2/promise';

async function run() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'NewPassword@1234',
    database: 'jksol_accounts',
    port: 3307
  });
  
  // Find accounts named somewhat like cash or check
  const [accounts] = await connection.execute('SELECT id, name, account_type, subtype, currency_id, opening_balance FROM accounts WHERE name LIKE "%check%" OR name LIKE "%cheq%" OR name LIKE "%cash%" OR name LIKE "%hnd%";');
  console.log("Accounts:");
  console.table(accounts);

  // See their transactions
  for (const acc of accounts) {
      const [txns] = await connection.execute('SELECT t.id, t.txn_name, t.status, e.debit, e.credit FROM transaction_entries e JOIN transactions t ON e.transaction_id = t.id WHERE e.account_id = ?;', [acc.id]);
      console.log("Transations for Account", acc.id, ":");
      console.table(txns);
  }
  
  process.exit();
}
run();
