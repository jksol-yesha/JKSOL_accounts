-- Migration: Add deduplication columns for bank statement import
-- Date: 2026-05-21
-- Safe: All new columns are NULLABLE to preserve backward compatibility

-- 1. Add bankTransactionKey to transactions table
ALTER TABLE `transactions` ADD COLUMN `bank_transaction_key` VARCHAR(64) DEFAULT NULL;

-- 2. Add deduplication fields to imported_statements table
ALTER TABLE `imported_statements` ADD COLUMN `file_hash` VARCHAR(64) DEFAULT NULL;
ALTER TABLE `imported_statements` ADD COLUMN `statement_fingerprint` VARCHAR(64) DEFAULT NULL;
ALTER TABLE `imported_statements` ADD COLUMN `parser_type` VARCHAR(50) DEFAULT NULL;
ALTER TABLE `imported_statements` ADD COLUMN `validation_status` VARCHAR(20) DEFAULT NULL;
ALTER TABLE `imported_statements` ADD COLUMN `duplicate_count` INT DEFAULT 0;
ALTER TABLE `imported_statements` ADD COLUMN `invalid_count` INT DEFAULT 0;

-- 3. Add indexes
CREATE INDEX `idx_tx_bank_txn_key` ON `transactions` (`org_id`, `bank_transaction_key`);
CREATE INDEX `idx_imp_stmt_file_hash` ON `imported_statements` (`org_id`, `file_hash`);
CREATE INDEX `idx_imp_stmt_fingerprint` ON `imported_statements` (`org_id`, `statement_fingerprint`);
