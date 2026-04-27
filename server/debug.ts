import { db } from "./src/db/index.ts";
import { accounts, transactionEntries, transactions } from "./src/db/schema.ts";
import { eq, sql } from "drizzle-orm";

async function debug() {
  const result = await db.select({
      accountId: accounts.id,
      name: accounts.name,
      netDelta: sql<string>`
                COALESCE(SUM(
                    CASE
                        WHEN ${transactions.id} IS NULL THEN 0
                        ELSE COALESCE(${transactionEntries.debit}, 0) - COALESCE(${transactionEntries.credit}, 0)
                    END
                ), 0)
        `
  })
  .from(accounts)
  .leftJoin(transactionEntries, eq(transactionEntries.accountId, accounts.id))
  .leftJoin(transactions, eq(transactions.id, transactionEntries.transactionId))
  .groupBy(accounts.id, accounts.name)
  .where(sql`${accounts.name} LIKE '%test6%'`);
  
  console.log("Account Delta from DB:", result);

  const entries = await db.select().from(transactionEntries).leftJoin(accounts, eq(transactionEntries.accountId, accounts.id)).where(sql`${accounts.name} LIKE '%test6%'`);
  console.log("Entries:", entries);

  process.exit(0);
}
debug();
