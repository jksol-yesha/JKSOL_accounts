import { db } from './db';
import { monthlyBranchSummary } from './db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    try {
        console.log("Trying to delete from monthly_branch_summary...");
        await db.delete(monthlyBranchSummary).where(eq(monthlyBranchSummary.branchId, 99999));
        console.log("Delete succeeded (0 rows).");
        process.exit(0);
    } catch (e: any) {
        console.error("Delete failed:");
        console.error(e);
        console.dir(e, { depth: null });
        process.exit(1);
    }
}

main();
