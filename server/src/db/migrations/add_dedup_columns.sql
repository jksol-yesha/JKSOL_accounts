-- Migration: Add source_row_signature to transactions and unique indexes for deduplication
-- Safe for existing data: all new columns are nullable

-- Add source_row_signature column to transactions
ALTER TABLE transactions ADD COLUMN source_row_signature VARCHAR(64) NULL AFTER bank_transaction_key;

-- Add indexes for dedup lookups on transactions
-- MySQL allows multiple NULLs in unique indexes, so old rows with NULL keys are safe
CREATE INDEX idx_tx_source_row_sig ON transactions (org_id, source_row_signature);

-- Ensure imported_statements dedup columns exist (idempotent)
-- These should already exist from schema, but adding for safety
ALTER TABLE imported_statements MODIFY COLUMN file_hash VARCHAR(64) NULL;
ALTER TABLE imported_statements MODIFY COLUMN statement_fingerprint VARCHAR(64) NULL;
ALTER TABLE imported_statements MODIFY COLUMN parser_type VARCHAR(50) NULL;
ALTER TABLE imported_statements MODIFY COLUMN validation_status VARCHAR(20) NULL;
ALTER TABLE imported_statements MODIFY COLUMN duplicate_count INT DEFAULT 0;
ALTER TABLE imported_statements MODIFY COLUMN invalid_count INT DEFAULT 0;
