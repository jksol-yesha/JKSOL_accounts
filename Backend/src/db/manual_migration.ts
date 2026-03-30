
import { db } from './index'; // Adjust path if needed imports index.ts which exports db
import { sql } from 'drizzle-orm';

async function main() {
    console.log("Checking user_branch_roles table...");
    try {
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS \`user_branch_roles\` (
                \`id\` bigint unsigned AUTO_INCREMENT PRIMARY KEY,
                \`user_id\` bigint unsigned NOT NULL,
                \`org_id\` bigint unsigned NOT NULL,
                \`branch_id\` bigint unsigned NOT NULL,
                \`role_id\` bigint unsigned NOT NULL,
                \`assigned_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT \`user_branch_roles_user_id_users_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE cascade,
                CONSTRAINT \`user_branch_roles_org_id_organizations_id_fk\` FOREIGN KEY (\`org_id\`) REFERENCES \`organizations\`(\`id\`) ON DELETE cascade,
                CONSTRAINT \`user_branch_roles_branch_id_branches_id_fk\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE cascade,
                CONSTRAINT \`user_branch_roles_role_id_roles_id_fk\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`),
                UNIQUE KEY \`uk_user_branch\` (\`user_id\`,\`branch_id\`),
                KEY \`idx_ubr_org\` (\`org_id\`)
            );
        `);
        console.log("Table user_branch_roles created or already exists.");
    } catch (e) {
        console.error("Error creating table:", e);
    }
    process.exit(0);
}

main();
