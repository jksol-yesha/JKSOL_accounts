import { db } from './src/db';
import { transactions, branches, financialYears } from './src/db/schema';
import { eq, sql } from 'drizzle-orm';

async function checkCounts() {
    const stats = await db.select({
        branchId: transactions.branchId,
        branchName: branches.name,
        fyId: transactions.financialYearId,
        fyName: financialYears.name,
        count: sql<number>`count(*)`
    }).from(transactions)
    .leftJoin(branches, eq(transactions.branchId, branches.id))
    .leftJoin(financialYears, eq(transactions.financialYearId, financialYears.id))
    .where(eq(transactions.orgId, 2))
    .groupBy(transactions.branchId, branches.name, transactions.financialYearId, financialYears.name);

    console.log("Transaction Breakdown for Org 2:");
    console.log(JSON.stringify(stats, null, 2));

    process.exit(0);
}

checkCounts();
