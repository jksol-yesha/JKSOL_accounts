CREATE TABLE `currencies` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`code` varchar(3) NOT NULL,
	`name` varchar(50) NOT NULL,
	`symbol` varchar(5),
	`status` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `currencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_currency_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `otps` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(190) NOT NULL,
	`otp` varchar(6) NOT NULL,
	`expires_at` datetime NOT NULL,
	`is_used` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parties` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_id` bigint unsigned NOT NULL,
	`branch_id` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(190) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`address` text NOT NULL,
	`gst_no` varchar(50) NOT NULL,
	`gst_name` varchar(255) NOT NULL,
	`status` int NOT NULL DEFAULT 1,
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `parties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transaction_entries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`transaction_id` bigint unsigned NOT NULL,
	`account_id` bigint unsigned NOT NULL,
	`debit` decimal(18,2) NOT NULL DEFAULT '0',
	`credit` decimal(18,2) NOT NULL DEFAULT '0',
	`description` varchar(255),
	CONSTRAINT `transaction_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` DROP FOREIGN KEY `audit_logs_action_by_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `organization_invitations` DROP FOREIGN KEY `organization_invitations_inviter_id_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_category_id_categories_id_fk`;
--> statement-breakpoint
ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_subcategory_id_sub_categories_id_fk`;
--> statement-breakpoint
ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_account_id_accounts_id_fk`;
--> statement-breakpoint
DROP INDEX `idx_tx_org_cat_date` ON `transactions`;--> statement-breakpoint
DROP INDEX `idx_tx_org_type_date` ON `transactions`;--> statement-breakpoint
ALTER TABLE `accounts` MODIFY COLUMN `subtype` int;--> statement-breakpoint
ALTER TABLE `audit_logs` MODIFY COLUMN `entity_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `txn_type_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `amount_local` decimal(18,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `amount_base` decimal(18,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `status` int NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `status` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `full_name` varchar(150);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `org_ids` text;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `branch_ids` text;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `accounts` ADD `currency_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `accounts` ADD `zip_code` varchar(20);--> statement-breakpoint
ALTER TABLE `accounts` ADD `bank_branch_name` varchar(120);--> statement-breakpoint
ALTER TABLE `accounts` ADD `created_by` bigint unsigned;--> statement-breakpoint
ALTER TABLE `transactions` ADD `name` varchar(255) DEFAULT 'Transaction' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `contact` varchar(150);--> statement-breakpoint
ALTER TABLE `transactions` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `currency_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `transactions` ADD `attachment_path` varchar(255);--> statement-breakpoint
ALTER TABLE `parties` ADD CONSTRAINT `parties_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `parties` ADD CONSTRAINT `parties_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `parties` ADD CONSTRAINT `parties_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_entries` ADD CONSTRAINT `transaction_entries_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_entries` ADD CONSTRAINT `transaction_entries_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_otp_email` ON `otps` (`email`);--> statement-breakpoint
CREATE INDEX `idx_party_org_branch` ON `parties` (`org_id`,`branch_id`);--> statement-breakpoint
CREATE INDEX `idx_tx_ent_tx_id` ON `transaction_entries` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_tx_ent_acc_id` ON `transaction_entries` (`account_id`);--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_currency_id_currencies_id_fk` FOREIGN KEY (`currency_id`) REFERENCES `currencies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_currency_id_currencies_id_fk` FOREIGN KEY (`currency_id`) REFERENCES `currencies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `currency_code`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `is_active`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `category_id`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `subcategory_id`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `account_id`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `counterparty_name`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `currency_code`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `description`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `payment_method`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `attachments`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `password_hash`;