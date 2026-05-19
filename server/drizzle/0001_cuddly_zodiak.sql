CREATE TABLE `financial_years` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_id` bigint unsigned NOT NULL DEFAULT 1,
	`name` varchar(30) NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`is_current` enum('yes','no') NOT NULL DEFAULT 'no',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`is_active` boolean DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financial_years_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_fy_org_name` UNIQUE(`org_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `monthly_branch_summary` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_id` bigint unsigned NOT NULL DEFAULT 1,
	`branch_id` bigint unsigned NOT NULL,
	`financial_year_id` bigint unsigned NOT NULL,
	`year_month` varchar(7) NOT NULL,
	`currency_code` char(3) NOT NULL,
	`income` decimal(18,2) NOT NULL DEFAULT '0',
	`expense` decimal(18,2) NOT NULL DEFAULT '0',
	`investment` decimal(18,2) NOT NULL DEFAULT '0',
	`investment_return` decimal(18,2) NOT NULL DEFAULT '0',
	`opening_balance` decimal(18,2) NOT NULL DEFAULT '0',
	`closing_balance` decimal(18,2) NOT NULL DEFAULT '0',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthly_branch_summary_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_mbs_org_branch_date` UNIQUE(`org_id`,`branch_id`,`year_month`,`currency_code`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_id` bigint unsigned NOT NULL DEFAULT 1,
	`branch_id` bigint unsigned NOT NULL,
	`financial_year_id` bigint unsigned NOT NULL,
	`txn_date` date NOT NULL,
	`txn_type` enum('income','expense','investment') NOT NULL,
	`direction` enum('in','out') NOT NULL,
	`category_id` bigint unsigned NOT NULL,
	`subcategory_id` bigint unsigned,
	`account_id` bigint unsigned NOT NULL,
	`reference_no` varchar(80),
	`counterparty_name` varchar(150),
	`currency_code` char(3) NOT NULL,
	`amount_local` decimal(18,2) NOT NULL,
	`fx_rate` decimal(18,8) NOT NULL DEFAULT '1',
	`amount_base` decimal(18,2) NOT NULL,
	`description` varchar(500),
	`status` enum('draft','submitted','approved','rejected','posted','void') NOT NULL DEFAULT 'draft',
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `yearly_branch_summary` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_id` bigint unsigned NOT NULL DEFAULT 1,
	`branch_id` bigint unsigned NOT NULL,
	`financial_year_id` bigint unsigned NOT NULL,
	`currency_code` char(3) NOT NULL,
	`income` decimal(18,2) NOT NULL DEFAULT '0',
	`expense` decimal(18,2) NOT NULL DEFAULT '0',
	`investment` decimal(18,2) NOT NULL DEFAULT '0',
	`investment_return` decimal(18,2) NOT NULL DEFAULT '0',
	`opening_balance` decimal(18,2) NOT NULL DEFAULT '0',
	`closing_balance` decimal(18,2) NOT NULL DEFAULT '0',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `yearly_branch_summary_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_ybs_org_branch_fy` UNIQUE(`org_id`,`branch_id`,`financial_year_id`,`currency_code`)
);
--> statement-breakpoint
ALTER TABLE `branches` MODIFY COLUMN `org_id` bigint unsigned NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` ADD `org_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `financial_years` ADD CONSTRAINT `financial_years_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monthly_branch_summary` ADD CONSTRAINT `monthly_branch_summary_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monthly_branch_summary` ADD CONSTRAINT `monthly_branch_summary_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monthly_branch_summary` ADD CONSTRAINT `monthly_branch_summary_financial_year_id_financial_years_id_fk` FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_financial_year_id_financial_years_id_fk` FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_subcategory_id_sub_categories_id_fk` FOREIGN KEY (`subcategory_id`) REFERENCES `sub_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `yearly_branch_summary` ADD CONSTRAINT `yearly_branch_summary_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `yearly_branch_summary` ADD CONSTRAINT `yearly_branch_summary_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `yearly_branch_summary` ADD CONSTRAINT `yearly_branch_summary_financial_year_id_financial_years_id_fk` FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_mbs_fy` ON `monthly_branch_summary` (`financial_year_id`);--> statement-breakpoint
CREATE INDEX `idx_tx_org_branch_date` ON `transactions` (`org_id`,`branch_id`,`txn_date`);--> statement-breakpoint
CREATE INDEX `idx_tx_org_fy_branch` ON `transactions` (`org_id`,`financial_year_id`,`branch_id`);--> statement-breakpoint
CREATE INDEX `idx_tx_org_cat_date` ON `transactions` (`org_id`,`category_id`,`txn_date`);--> statement-breakpoint
CREATE INDEX `idx_tx_org_type_date` ON `transactions` (`org_id`,`txn_type`,`txn_date`);--> statement-breakpoint
CREATE INDEX `idx_tx_org_status_date` ON `transactions` (`org_id`,`status`,`txn_date`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_user_org` ON `users` (`org_id`);