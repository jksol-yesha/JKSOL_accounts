import { db } from './index';
import { sql } from 'drizzle-orm';

async function run() {
    try {
        console.log("Starting party deduplication...");

        // Find duplicate parties (grouped by org, name, email, phone)
        const dupParties = await db.execute(sql`
            SELECT org_id, name, email, phone, MIN(id) as primary_id
            FROM parties
            GROUP BY org_id, name, email, phone
            HAVING COUNT(id) > 1
        `);

        const partyRows = dupParties[0] as any[];
        console.log(`Found ${partyRows.length} duplicate party groups.`);

        for (const row of partyRows) {
            const { org_id, name, email, phone, primary_id } = row;
            // Get all other IDs in this group
            const othersRes = await db.execute(sql`
                SELECT id FROM parties 
                WHERE org_id = ${org_id} 
                  AND name = ${name} 
                  AND email = ${email} 
                  AND phone = ${phone} 
                  AND id != ${primary_id}
            `);
            const otherIds = (othersRes[0] as any[]).map(r => r.id);

            if (otherIds.length > 0) {
                console.log(`Merging ${otherIds.length} duplicates into party ${primary_id} (${name})`);

                const placeholders = otherIds.join(',');

                // Update transactions to point to the primary party ID
                await db.execute(sql`UPDATE transactions SET contact_id = ${primary_id} WHERE contact_id IN (${sql.raw(placeholders)})`);

                // Delete the duplicate party records
                await db.execute(sql`DELETE FROM parties WHERE id IN (${sql.raw(placeholders)})`);
            }
        }

        console.log("Deduplication completed successfully.");
    } catch (e) {
        console.error("Critical error during deduplication:", e);
    }
    process.exit(0);
}
run();
