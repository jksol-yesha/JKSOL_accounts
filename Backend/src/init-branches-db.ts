
import { db } from './db';
import { sql } from 'drizzle-orm';

const initDb = async () => {
    console.log('🔄 Initializing Database Tables...');

    // 1. Create Organizations Table
    const createOrgTable = sql`
        CREATE TABLE IF NOT EXISTS organizations (
            id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(150) NOT NULL,
            base_currency CHAR(3) NOT NULL DEFAULT 'USD',
            timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
            status ENUM('active','inactive') NOT NULL DEFAULT 'active',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_org_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    try {
        await db.execute(createOrgTable);
        console.log('✅ Organizations table checked/created.');
    } catch (e) {
        console.error('❌ Error creating organizations table:', e);
    }

    // 2. Insert Default Organization (ID: 1)
    const insertDefaultOrg = sql`
        INSERT IGNORE INTO organizations (id, name, base_currency, timezone) 
        VALUES (1, 'Default Organization', 'INR', 'Asia/Kolkata');
    `;

    try {
        await db.execute(insertDefaultOrg);
        console.log('✅ Default organization checked/created.');
    } catch (e) {
        console.error('❌ Error creating default organization:', e);
    }

    // 3. Create Branches Table
    const createBranchesTable = sql`
        CREATE TABLE IF NOT EXISTS branches (
            id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
            org_id BIGINT UNSIGNED NOT NULL,
            name VARCHAR(150) NOT NULL,
            code VARCHAR(30) NOT NULL,
            currency_code CHAR(3) NOT NULL,
            country VARCHAR(80) NULL,
            status ENUM('active','inactive') NOT NULL DEFAULT 'active',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_branch_org_code (org_id, code),
            KEY idx_branch_org (org_id),
            CONSTRAINT fk_branch_org FOREIGN KEY (org_id) REFERENCES organizations(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    try {
        await db.execute(createBranchesTable);
        console.log('✅ Branches table checked/created.');
    } catch (e) {
        console.error('❌ Error creating branches table:', e);
    }

    process.exit(0);
};

initDb();
