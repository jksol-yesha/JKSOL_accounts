const mysql = require('mysql2/promise');

async function fix() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'NewPassword@1234',
    database: 'jksol_accounts',
    port: 3307
  });

  try {
    const [rows] = await connection.execute("SELECT created_by FROM parties WHERE created_by NOT IN (SELECT id FROM users) GROUP BY created_by");
    console.log("Missing user IDs in parties:", rows);
    
    // Update them to the first available user (e.g., ID 39)
    const [users] = await connection.execute("SELECT id FROM users LIMIT 1");
    if(users.length > 0) {
        const fallbackUserId = users[0].id;
        console.log("Updating orphaned records to user ID:", fallbackUserId);
        await connection.execute("UPDATE parties SET created_by = ? WHERE created_by NOT IN (SELECT id FROM users)", [fallbackUserId]);
        
        console.log("Adding new constraint to users table...");
        await connection.execute("ALTER TABLE parties ADD CONSTRAINT parties_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES users (id)");
        
        console.log("Done!");
    } else {
        console.log("No users found to map to!");
    }
  } catch (err) {
    console.log("Error:", err.message);
  }
  await connection.end();
}
fix();
