CREATE TABLE `roles` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_role_name` UNIQUE(`name`)
);
--> statement-breakpoint
DROP INDEX `idx_user_role` ON `users`;--> statement-breakpoint
ALTER TABLE `accounts` MODIFY COLUMN `account_type` int NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` MODIFY COLUMN `status` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `branches` MODIFY COLUMN `status` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `categories` MODIFY COLUMN `status` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `financial_years` MODIFY COLUMN `status` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `monthly_branch_summary` MODIFY COLUMN `status` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `organization_invitations` MODIFY COLUMN `branch_ids` text NOT NULL DEFAULT ('');--> statement-breakpoint
ALTER TABLE `organizations` MODIFY COLUMN `status` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `sub_categories` MODIFY COLUMN `status` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `category_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `status` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `org_ids` text NOT NULL DEFAULT ('');--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `branch_ids` text NOT NULL DEFAULT ('');--> statement-breakpoint
ALTER TABLE `yearly_branch_summary` MODIFY COLUMN `status` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `accounts` ADD `subtype` int NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `parent_account_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `accounts` ADD `description` varchar(255);--> statement-breakpoint
ALTER TABLE `accounts` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_invitations` ADD `role_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `transactions` ADD `payment_method` varchar(50);--> statement-breakpoint
ALTER TABLE `transactions` ADD `attachments` json DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `users` ADD `role_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `users` ADD `created_by` bigint unsigned;--> statement-breakpoint
ALTER TABLE `organization_invitations` ADD CONSTRAINT `organization_invitations_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_acc_type` ON `accounts` (`account_type`);--> statement-breakpoint
CREATE INDEX `idx_acc_subtype` ON `accounts` (`subtype`);--> statement-breakpoint
CREATE INDEX `idx_user_role_id` ON `users` (`role_id`);--> statement-breakpoint
ALTER TABLE `organization_invitations` DROP COLUMN `role`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `role`;