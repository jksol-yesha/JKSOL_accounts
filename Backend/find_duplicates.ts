import { db } from './src/db';
import { transactions, categories, accounts } from './src/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

async function auditLargeGroups() {
    const ids = [390, 393, 396, 399, 402, 405]; // Software Sub set
    const txns = await db.select({
        id: transactions.id,
        bid: transactions.branchId,
        cat: categories.name,
        acc: accounts.name
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(inArray(transactions.id, ids));

    console.log("Software Sub (Set 1) Audit:");
    console.log(JSON.stringify(txns, null, 2));

    const ids2 = [391, 394, 397, 400, 403, 406]; // Freelance set
    const txns2 = await db.select({
        id: transactions.id,
        bid: transactions.branchId,
        cat: categories.name,
        acc: accounts.name
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(inArray(transactions.id, ids2));

    console.log("\nFreelance Project Income (Set 2) Audit:");
    console.log(JSON.stringify(txns2, null, 2));

    process.exit(0);
}

auditLargeGroups();
