import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function run() {
  try {
    await db.execute(sql`ALTER TABLE transactions ADD COLUMN imported_statement_id INT DEFAULT NULL`);
    console.log("Column added successfully!");
  } catch (e) {
    if (e.message && e.message.includes("Duplicate column name")) {
      console.log("Column already exists.");
    } else {
      console.error(e);
    }
  }
  process.exit();
}
run();
