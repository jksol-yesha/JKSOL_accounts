import { db } from './index';
import { sql } from 'drizzle-orm';

async function run() {
    try {
        console.log("Starting category migration...");
        try { await db.execute(sql`ALTER TABLE categories DROP FOREIGN KEY categories_branch_id_branches_id_fk`); } catch (e) { console.log("FK drop error:", e.message); }
        try { await db.execute(sql`ALTER TABLE categories DROP INDEX uk_cat_org_type_name`); } catch (e) { console.log(e.message); }
        try { await db.execute(sql`ALTER TABLE categories DROP INDEX idx_cat_branch`); } catch (e) { console.log(e.message); }
        try { await db.execute(sql`ALTER TABLE categories DROP COLUMN branch_id`); } catch (e) { console.log(e.message); }
        try { await db.execute(sql`CREATE UNIQUE INDEX uk_cat_org_type_name ON categories (org_id, txn_type_id, name)`); } catch (e) { console.log(e.message); }
        console.log("Migration completed.");
    } catch (e) {
        console.error("Critical error:", e);
    }
    process.exit(0);
}
run();
