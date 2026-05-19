CREATE INDEX `idx_acc_org_created` ON `accounts` (`org_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_acc_org_status_created` ON `accounts` (`org_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_tx_org_fy_date_created` ON `transactions` (`org_id`,`financial_year_id`,`txn_date`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_tx_org_fy_branch_date_created` ON `transactions` (`org_id`,`financial_year_id`,`branch_id`,`txn_date`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_tx_ent_tx_acc_id` ON `transaction_entries` (`transaction_id`,`account_id`);
