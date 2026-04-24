import { db, connection } from "./src/db/index";
import { sql } from "drizzle-orm";

async function addRcmColumn() {
  try {
    console.log("Adding is_rcm column...");
    await db.execute(sql`ALTER TABLE transactions ADD COLUMN is_rcm BOOLEAN NOT NULL DEFAULT 0;`);
    console.log("Column added successfully.");
  } catch (err: any) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("Column already exists!");
    } else {
      console.error(err);
    }
  } finally {
    await connection.end();
  }
}

addRcmColumn();
