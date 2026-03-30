
import { db } from "./index";
import { users } from "./schema";
import { eq } from "drizzle-orm";

async function fixUsers() {
    console.log("🛠️ Starting user status fix...");

    try {
        const result = await db.update(users)
            .set({ status: 1 })
            .where(eq(users.status, 0));

        console.log(`✅ Successfully activated users. Rows affected: ${result[0].affectedRows}`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Error fixing user status:", error);
        process.exit(1);
    }
}

fixUsers();
