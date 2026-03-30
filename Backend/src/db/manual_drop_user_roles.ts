import { sql } from "drizzle-orm";
import { db } from "./index";

async function main() {
    console.log("Dropping user_roles table...");
    await db.execute(sql`DROP TABLE IF EXISTS user_roles`);
    console.log("user_roles table dropped successfully.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
