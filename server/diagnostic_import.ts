import { db } from "./src/db/index";
import { transactions, importedStatements } from "./src/db/schema";
import { desc, eq } from "drizzle-orm";

async function run() {
  const stmts = await db.select().from(importedStatements).orderBy(desc(importedStatements.id)).limit(1);
  if (stmts.length > 0) {
    const stmt = stmts[0];
    console.log("Latest Imported Statement:", stmt);
    const txns = await db.select().from(transactions).where(eq(transactions.importedStatementId, stmt.id));
    console.log(`Found ${txns.length} transactions linked to this statement ID (${stmt.id})`);
  } else {
    console.log("No imported statements found.");
  }
  process.exit(0);
}
run();
