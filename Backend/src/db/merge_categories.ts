import { db } from './index';
import { sql } from 'drizzle-orm';

async function run() {
    try {
        console.log("Starting category deduplication...");

        // Find duplicate categories
        const dupCats = await db.execute(sql`
            SELECT org_id, txn_type_id, name, MIN(id) as primary_id
            FROM categories
            GROUP BY org_id, txn_type_id, name
            HAVING COUNT(id) > 1
        `);

        const catRows = dupCats[0] as any[];
        console.log(`Found ${catRows.length} duplicate category groups.`);

        for (const row of catRows) {
            const { org_id, txn_type_id, name, primary_id } = row;
            // Get all other IDs
            const othersRes = await db.execute(sql`
                SELECT id FROM categories 
                WHERE org_id = ${org_id} AND txn_type_id = ${txn_type_id} AND name = ${name} AND id != ${primary_id}
            `);
            const otherIds = (othersRes[0] as any[]).map(r => r.id);

            if (otherIds.length > 0) {
                console.log(`Merging ${otherIds.length} duplicates into category ${primary_id} (${name})`);

                // Get primary subcategories
                const primarySubsRes = await db.execute(sql`SELECT id, name FROM sub_categories WHERE category_id = ${primary_id}`);
                const primarySubs = primarySubsRes[0] as any[];
                const primarySubMap = new Map<string, number>();
                for (const ps of primarySubs) {
                    primarySubMap.set(ps.name.toLowerCase(), ps.id);
                }

                // Process subcategories of other duplicate categories
                for (const oId of otherIds) {
                    const otherSubsRes = await db.execute(sql`SELECT id, name FROM sub_categories WHERE category_id = ${oId}`);
                    const otherSubs = otherSubsRes[0] as any[];

                    for (const os of otherSubs) {
                        const matchId = primarySubMap.get(os.name.toLowerCase());
                        if (matchId) {
                            // Subcategory name already exists under primary_id. Merge transactions.
                            await db.execute(sql`UPDATE transactions SET sub_category_id = ${matchId} WHERE sub_category_id = ${os.id}`);
                            await db.execute(sql`DELETE FROM sub_categories WHERE id = ${os.id}`);
                        } else {
                            // Subcategory doesn't exist under primary_id. Move it!
                            await db.execute(sql`UPDATE sub_categories SET category_id = ${primary_id} WHERE id = ${os.id}`);
                            // Add it to map so subsequent duplicates match it
                            primarySubMap.set(os.name.toLowerCase(), os.id);
                        }
                    }
                }

                const placeholders = otherIds.join(',');

                // Route transactions to primary_id
                await db.execute(sql`UPDATE transactions SET category_id = ${primary_id} WHERE category_id IN (${sql.raw(placeholders)})`);

                // Delete duplicate categories
                await db.execute(sql`DELETE FROM categories WHERE id IN (${sql.raw(placeholders)})`);
            }
        }

        console.log("Applying unique constraint...");
        await db.execute(sql`CREATE UNIQUE INDEX uk_cat_org_type_name ON categories (org_id, txn_type_id, name)`);

        console.log("Deduplication and migration completed successfully.");
    } catch (e) {
        console.error("Critical error during deduplication:", e);
    }
    process.exit(0);
}
run();
