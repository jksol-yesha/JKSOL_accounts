import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  try {
    const res = await db.execute(sql`SHOW TABLES LIKE 'imported_statements'`);
    console.log(res);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
