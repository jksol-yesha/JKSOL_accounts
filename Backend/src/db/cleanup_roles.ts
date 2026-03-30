import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    database: process.env.DB_NAME || "test_db",
    password: process.env.DB_PASSWORD || "",
    port: Number(process.env.DB_PORT) || 3306,
});

async function cleanupRoles() {
    console.log("🚀 Starting role column cleanup...");

    try {
        // 1. Drop index if it exists (MySQL syntax)
        console.log("🛠️ Dropping legacy index idx_user_role...");
        try {
            await connection.execute("ALTER TABLE users DROP INDEX idx_user_role");
        } catch (e) {
            console.log("⚠️ Index idx_user_role likely already dropped or doesn't exist.");
        }

        // 2. Drop role column from users
        console.log("🛠️ Dropping role column from users...");
        try {
            await connection.execute("ALTER TABLE users DROP COLUMN role");
        } catch (e) {
            console.log("⚠️ Column 'role' in 'users' likely already dropped.");
        }

        // 3. Drop role column from organization_invitations
        console.log("🛠️ Dropping role column from organization_invitations...");
        try {
            await connection.execute("ALTER TABLE organization_invitations DROP COLUMN role");
        } catch (e) {
            console.log("⚠️ Column 'role' in 'organization_invitations' likely already dropped.");
        }

        console.log("🎉 Role cleanup completed successfully!");
    } catch (error) {
        console.error("❌ Role cleanup failed:", error);
    } finally {
        await connection.end();
    }
}

cleanupRoles();
