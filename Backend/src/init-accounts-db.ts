
import { db } from './db';
import { sql } from 'drizzle-orm';

const initDb = async () => {
    console.log('🔄 Initializing Accounts Table...');

    const createAccountsTable = sql`
        CREATE TABLE IF NOT EXISTS accounts (
          id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
          org_id BIGINT UNSIGNED NOT NULL,
          branch_id BIGINT UNSIGNED NOT NULL,
          name VARCHAR(120) NOT NULL,
          account_type ENUM('cash','bank','wallet','other') NOT NULL,
          opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
          opening_balance_date DATE NOT NULL,
          status ENUM('active','inactive') NOT NULL DEFAULT 'active',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_acc_branch_name (branch_id, name),
          KEY idx_acc_org_branch (org_id, branch_id),
          CONSTRAINT fk_acc_org FOREIGN KEY (org_id) REFERENCES organizations(id),
          CONSTRAINT fk_acc_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    try {
        await db.execute(createAccountsTable);
        console.log('✅ Accounts table checked/created.');
    } catch (e) {
        console.error('❌ Error creating accounts table:', e);
    }

    process.exit(0);
};

initDb();
