
import { db } from './index';
import { sql } from 'drizzle-orm';

async function main() {
    console.log("Starting manual migration...");

    try {
        // Disable FK checks
        await db.execute(sql.raw("SET FOREIGN_KEY_CHECKS = 0;"));

        // --- ACCOUNTS ---
        console.log("Migrating accounts table...");
        // Re-run these just in case or skip if already done (they are idempotent-ish if checking schema, but ALTER ADD fails if exists)
        // Since I ran it once, I should wrap in try-catch or just focus on new things.
        // But to be safe, I'll keep them in try-catch blocks.

        // account_type -> int (already done, but good to ensure)
        try {
            await db.execute(sql.raw("ALTER TABLE `accounts` MODIFY COLUMN `account_type` int NOT NULL;"));
        } catch (e: any) { console.log("account_type mod failed:", e.message); }

        // status
        try {
            await db.execute(sql.raw("ALTER TABLE `accounts` MODIFY COLUMN `status` int NOT NULL DEFAULT 1;"));
        } catch (e: any) { console.log("status mod failed:", e.message); }

        // subtype
        try {
            await db.execute(sql.raw("ALTER TABLE `accounts` ADD `subtype` int NOT NULL DEFAULT 0;"));
        } catch (e: any) { console.log("subtype add failed:", e.message); }

        // parent_account_id
        try {
            await db.execute(sql.raw("ALTER TABLE `accounts` ADD `parent_account_id` bigint unsigned;"));
        } catch (e: any) { console.log("parent_account_id add failed:", e.message); }

        // description
        try {
            await db.execute(sql.raw("ALTER TABLE `accounts` ADD `description` varchar(255);"));
        } catch (e: any) { console.log("description add failed:", e.message); }

        // is_active
        try {
            await db.execute(sql.raw("ALTER TABLE `accounts` ADD `is_active` boolean DEFAULT true NOT NULL;"));
        } catch (e: any) { console.log("is_active add failed:", e.message); }

        // account_number
        try {
            await db.execute(sql.raw("ALTER TABLE `accounts` ADD `account_number` varchar(50);"));
        } catch (e: any) { console.log("account_number add failed (may already exist):", e.message); }

        // ifsc
        try {
            await db.execute(sql.raw("ALTER TABLE `accounts` ADD `ifsc` varchar(20);"));
        } catch (e: any) { console.log("ifsc add failed (may already exist):", e.message); }

        // zip_code
        try {
            await db.execute(sql.raw("ALTER TABLE `accounts` ADD `zip_code` varchar(20);"));
        } catch (e: any) { console.log("zip_code add failed (may already exist):", e.message); }

        // bank_branch_name
        try {
            await db.execute(sql.raw("ALTER TABLE `accounts` ADD `bank_branch_name` varchar(120);"));
        } catch (e: any) { console.log("bank_branch_name add failed (may already exist):", e.message); }

        // currency_id
        try {
            await db.execute(sql.raw("ALTER TABLE `accounts` ADD `currency_id` bigint unsigned;"));
        } catch (e: any) { console.log("currency_id add failed (may already exist):", e.message); }

        // created_by
        try {
            await db.execute(sql.raw("ALTER TABLE `accounts` ADD `created_by` bigint unsigned;"));
        } catch (e: any) { console.log("created_by add failed (may already exist):", e.message); }

        // Indexes
        try { await db.execute(sql.raw("CREATE INDEX `idx_acc_type` ON `accounts` (`account_type`);")); } catch (e) { }
        try { await db.execute(sql.raw("CREATE INDEX `idx_acc_subtype` ON `accounts` (`subtype`);")); } catch (e) { }


        // --- TRANSACTIONS ---
        console.log("Migrating transactions table...");

        try {
            // category_id potentially nullable or bigint
            await db.execute(sql.raw("ALTER TABLE transactions MODIFY COLUMN category_id bigint unsigned;"));
        } catch (e: any) { console.log("category_id mod failed:", e.message); }

        try {
            await db.execute(sql.raw("ALTER TABLE transactions ADD payment_method varchar(50);"));
        } catch (e: any) { console.log("payment_method add failed:", e.message); }

        try {
            await db.execute(sql.raw("ALTER TABLE transactions ADD attachments json DEFAULT ('[]');"));
        } catch (e: any) { console.log("attachments add failed:", e.message); }

        // Drop attachment_path
        try {
            await db.execute(sql.raw("ALTER TABLE transactions DROP COLUMN attachment_path;"));
            console.log("Dropped attachment_path column.");
        } catch (e: any) {
            console.log("attachment_path drop failed (might not exist):", e.message);
        }

        // --- USERS ---
        // Just in case `created_by` or `role_id` is needed soon
        console.log("Migrating users table (optional)...");
        try {
            await db.execute(sql.raw("ALTER TABLE users ADD role_id bigint unsigned;"));
        } catch (e: any) { console.log("users role_id add failed:", e.message); }

        try {
            await db.execute(sql.raw("ALTER TABLE users ADD created_by bigint unsigned;"));
        } catch (e: any) { console.log("users created_by add failed:", e.message); }


        console.log("Manual migration completed.");

    } catch (error) {
        console.error("Migration fatal error:", error);
    } finally {
        await db.execute(sql.raw("SET FOREIGN_KEY_CHECKS = 1;"));
        process.exit(0);
    }
}

main();
