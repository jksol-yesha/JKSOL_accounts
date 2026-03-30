
DROP TABLE IF EXISTS `sub_categories`;
DROP TABLE IF EXISTS `categories`;

CREATE TABLE `categories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`org_id` bigint unsigned NOT NULL DEFAULT 1,
	`branch_id` bigint unsigned NOT NULL,
	`txn_type` enum('income','expense','investment') NOT NULL,
	`name` varchar(120) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_cat_org_type_name` UNIQUE(`org_id`,`branch_id`,`txn_type`,`name`)
);

CREATE TABLE `sub_categories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`category_id` bigint unsigned NOT NULL,
	`name` varchar(120) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sub_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_subcat_cat_name` UNIQUE(`category_id`,`name`)
);

ALTER TABLE `categories` ADD CONSTRAINT `categories_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `categories` ADD CONSTRAINT `categories_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `sub_categories` ADD CONSTRAINT `sub_categories_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE INDEX `idx_cat_org_type` ON `categories` (`org_id`,`txn_type`);
CREATE INDEX `idx_cat_branch` ON `categories` (`branch_id`);
CREATE INDEX `idx_subcat_cat` ON `sub_categories` (`category_id`);