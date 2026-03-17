import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    database: process.env.DB_NAME || "test_db",
    password: process.env.DB_PASSWORD || "",
    port: Number(process.env.DB_PORT) || 3306,
});

async function migrateRoles() {
    console.log("🚀 Starting role migration...");

    try {
        // 0. Create roles table if it doesn't exist
        console.log("🛠️ Creating roles table...");
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE
            )
        `);

        // 1. Ensure roles are seeded
        console.log("🌱 Seeding roles table...");
        await connection.execute(`
            INSERT IGNORE INTO roles (id, name) VALUES 
            (1, 'owner'),
            (2, 'admin'),
            (3, 'member')
        `);

        // 2. Add role_id columns if they don't exist (Drizzle might not have applied them yet if not using drizzle-kit push)
        // For reliability in this environment, we'll try to add them if they are missing
        const [userCols] = await connection.execute("SHOW COLUMNS FROM users LIKE 'role_id'");
        if ((userCols as any[]).length === 0) {
            console.log("🛠️ Adding role_id to users...");
            await connection.execute("ALTER TABLE users ADD COLUMN role_id BIGINT UNSIGNED NULL, ADD INDEX idx_user_role_id (role_id), ADD CONSTRAINT fk_user_role_id FOREIGN KEY (role_id) REFERENCES roles(id)");
        }

        const [inviteCols] = await connection.execute("SHOW COLUMNS FROM organization_invitations LIKE 'role_id'");
        if ((inviteCols as any[]).length === 0) {
            console.log("🛠️ Adding role_id to organization_invitations...");
            await connection.execute("ALTER TABLE organization_invitations ADD COLUMN role_id BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_invite_role_id FOREIGN KEY (role_id) REFERENCES roles(id)");
        }

        // 3. Update users.role_id based on users.role enum
        console.log("📦 Migrating users.role_id...");
        await connection.execute(`
            UPDATE users u
            JOIN roles r ON u.role = r.name
            SET u.role_id = r.id
            WHERE u.role_id IS NULL
        `);

        // 4. Update organization_invitations.role_id based on role enum
        console.log("📦 Migrating organization_invitations.role_id...");
        await connection.execute(`
            UPDATE organization_invitations oi
            JOIN roles r ON oi.role = r.name
            SET oi.role_id = r.id
            WHERE oi.role_id IS NULL
        `);

        console.log("🎉 Role migration completed successfully!");
    } catch (error) {
        console.error("❌ Role migration failed:", error);
    } finally {
        await connection.end();
    }
}

migrateRoles();
