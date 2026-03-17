import { db } from '../src/db';
import { financialYears, organizations } from '../src/db/schema';
import { sql } from "drizzle-orm";

async function main() {
    console.log("🌱 Seeding Financial Years...");

    // 1. Get all organizations
    const orgs = await db.select().from(organizations);

    if (orgs.length === 0) {
        console.log("❌ No organizations found. Create an organization first.");
        return;
    }

    for (const org of orgs) {
        console.log(`🔹 Checking FY for Org: ${org.name} (ID: ${org.id})`);

        // Check if FY exists
        const existing = await db.select().from(financialYears).where(sql`${financialYears.orgId} = ${org.id}`);

        if (existing.length > 0) {
            console.log(`   ✅ FYs already exist for Org ${org.id}. Skipping.`);
            continue;
        }

        const years = [

            { name: 'FY 2024-25', startDate: '2024-04-01', endDate: '2025-03-31', isCurrent: 'yes' },
            { name: 'FY 2025-26', startDate: '2025-04-01', endDate: '2026-03-31', isCurrent: 'no' }
        ];

        for (const y of years) {
            await db.insert(financialYears).values({
                ...y,
                orgId: org.id
            });
        }
        console.log(`   ✅ Seeded FYs for Org ${org.id}`);
    }

    console.log("✨ Done!");
    process.exit(0);
}

main().catch(console.error);
