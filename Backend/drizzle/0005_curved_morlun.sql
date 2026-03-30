CREATE TABLE `countries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`country_name` varchar(100) NOT NULL,
	`country_code` char(2) NOT NULL,
	`country_currency` char(3),
	CONSTRAINT `countries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `transaction_entries` DROP FOREIGN KEY `transaction_entries_account_id_accounts_id_fk`;
--> statement-breakpoint
ALTER TABLE `branches` MODIFY COLUMN `code` varchar(30);--> statement-breakpoint
ALTER TABLE `transactions` ADD `category_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `transactions` ADD `sub_category_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `transactions` ADD `party` varchar(255);--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_sub_category_id_sub_categories_id_fk` FOREIGN KEY (`sub_category_id`) REFERENCES `sub_categories`(`id`) ON DELETE no action ON UPDATE no action;