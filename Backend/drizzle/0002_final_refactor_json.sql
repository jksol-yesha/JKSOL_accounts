CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_id` bigint unsigned NOT NULL,
	`entity` varchar(50) NOT NULL,
	`entity_id` bigint unsigned NOT NULL,
	`action` varchar(50) NOT NULL,
	`old_value_json` json,
	`new_value_json` json,
	`action_by` bigint unsigned NOT NULL,
	`action_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exchange_rates` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_id` bigint unsigned NOT NULL,
	`rate_date` date NOT NULL,
	`from_currency` char(3) NOT NULL,
	`to_currency` char(3) NOT NULL,
	`rate` decimal(18,8) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchange_rates_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_fx_org_date_pair` UNIQUE(`org_id`,`rate_date`,`from_currency`,`to_currency`)
);
--> statement-breakpoint
CREATE TABLE `organization_invitations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_id` bigint unsigned NOT NULL,
	`inviter_id` bigint unsigned NOT NULL,
	`email` varchar(190) NOT NULL,
	`role` enum('owner','admin','member') NOT NULL DEFAULT 'member',
	`branch_ids` json,
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`token` varchar(100),
	`expires_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_inv_email_org_status` UNIQUE(`email`,`org_id`,`status`)
);
--> statement-breakpoint
CREATE TABLE `transaction_types` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	CONSTRAINT `transaction_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_txn_type_name` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `categories` DROP INDEX `uk_cat_org_type_name`;--> statement-breakpoint
ALTER TABLE `organizations` DROP INDEX `uk_org_name`;--> statement-breakpoint
ALTER TABLE `users` DROP FOREIGN KEY `users_org_id_organizations_id_fk`;
--> statement-breakpoint
DROP INDEX `idx_user_org` ON `users`;--> statement-breakpoint
DROP INDEX `idx_cat_org_type` ON `categories`;--> statement-breakpoint
DROP INDEX `idx_tx_org_type_date` ON `transactions`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `profile_photo` longtext;--> statement-breakpoint
ALTER TABLE `accounts` ADD `currency_code` char(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `txn_type_id` bigint unsigned NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `logo` longtext;--> statement-breakpoint
ALTER TABLE `transactions` ADD `txn_type_id` bigint unsigned NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `role` enum('owner','admin','member');--> statement-breakpoint
ALTER TABLE `users` ADD `org_ids` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `branch_ids` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `uk_cat_org_type_name` UNIQUE(`org_id`,`branch_id`,`txn_type_id`,`name`);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_action_by_users_id_fk` FOREIGN KEY (`action_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exchange_rates` ADD CONSTRAINT `exchange_rates_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_invitations` ADD CONSTRAINT `organization_invitations_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_invitations` ADD CONSTRAINT `organization_invitations_inviter_id_users_id_fk` FOREIGN KEY (`inviter_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_audit_org_entity` ON `audit_logs` (`org_id`,`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_org_time` ON `audit_logs` (`org_id`,`action_at`);--> statement-breakpoint
CREATE INDEX `idx_fx_org_date` ON `exchange_rates` (`org_id`,`rate_date`);--> statement-breakpoint
CREATE INDEX `idx_inv_email_str` ON `organization_invitations` (`email`);--> statement-breakpoint
CREATE INDEX `idx_inv_org` ON `organization_invitations` (`org_id`);--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_txn_type_id_transaction_types_id_fk` FOREIGN KEY (`txn_type_id`) REFERENCES `transaction_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_txn_type_id_transaction_types_id_fk` FOREIGN KEY (`txn_type_id`) REFERENCES `transaction_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_org_name` ON `organizations` (`name`);--> statement-breakpoint
CREATE INDEX `idx_user_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_cat_org_type` ON `categories` (`org_id`,`txn_type_id`);--> statement-breakpoint
CREATE INDEX `idx_tx_org_type_date` ON `transactions` (`org_id`,`txn_type_id`,`txn_date`);--> statement-breakpoint
ALTER TABLE `categories` DROP COLUMN `txn_type`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `txn_type`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `direction`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `org_id`;