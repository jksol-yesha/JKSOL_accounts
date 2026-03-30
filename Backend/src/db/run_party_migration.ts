import { db } from './index';
import { sql } from 'drizzle-orm';

async function run() {
    try {
        console.log("Starting party migration...");
        try { await db.execute(sql`ALTER TABLE parties DROP FOREIGN KEY parties_branch_id_branches_id_fk`); } catch (e) { console.log("FK drop error:", e.message); }
        try { await db.execute(sql`ALTER TABLE parties DROP INDEX idx_party_org_branch`); } catch (e) { console.log(e.message); }
        try { await db.execute(sql`ALTER TABLE parties DROP COLUMN branch_id`); } catch (e) { console.log(e.message); }
        try { await db.execute(sql`CREATE INDEX idx_party_org ON parties (org_id)`); } catch (e) { console.log(e.message); }
        console.log("Migration completed.");
    } catch (e) {
        console.error("Critical error:", e);
    }
    process.exit(0);
}
run();
