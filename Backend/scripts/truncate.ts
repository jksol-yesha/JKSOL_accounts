
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function truncate() {
    console.log("Dropping tables...");
    try {
        await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0;`);
        await db.execute(sql`DROP TABLE IF EXISTS role_permissions;`);
        await db.execute(sql`DROP TABLE IF EXISTS user_roles;`);
        await db.execute(sql`DROP TABLE IF EXISTS roles;`);
        await db.execute(sql`DROP TABLE IF EXISTS permissions;`);
        await db.execute(sql`DROP TABLE IF EXISTS transactions;`);
        await db.execute(sql`DROP TABLE IF EXISTS sub_categories;`);
        await db.execute(sql`DROP TABLE IF EXISTS categories;`);
        await db.execute(sql`DROP TABLE IF EXISTS transaction_types;`);
        await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1;`);
        console.log("Tables dropped.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

truncate();
