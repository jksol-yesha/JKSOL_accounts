import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
    console.log("Dropping direction column from transactions table...");
    await db.execute(sql`ALTER TABLE transactions DROP COLUMN direction`);
    console.log("direction column dropped successfully.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
