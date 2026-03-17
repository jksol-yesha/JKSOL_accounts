
import { db } from '../src/db';
import { financialYears } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function setCurrentFY() {
    const orgId = 1;
    // Set 2025-26 (ID 1) as current
    await db.update(financialYears)
        .set({ isCurrent: 'yes' })
        .where(eq(financialYears.id, 1));

    console.log("Updated FY 2025-26 to Current.");
}

setCurrentFY().then(() => process.exit(0)).catch(console.error);
