import { db } from './src/db/connection';
import { accounts } from './src/db/schema';
import { eq, like } from 'drizzle-orm';

async function run() {
  const result = await db.select().from(accounts).where(like(accounts.name, '%cheq%'));
  console.log("CHEQUE:", result);
  const result2 = await db.select().from(accounts).where(like(accounts.name, '%cash%'));
  console.log("CASH:", result2);
  const result3 = await db.select().from(accounts).where(like(accounts.name, '%in hand%'));
  console.log("IN HAND:", result3);
  process.exit();
}
run();
