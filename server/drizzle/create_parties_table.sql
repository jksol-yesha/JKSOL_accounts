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

ALTER TABLE `parties` ADD CONSTRAINT `parties_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `parties` ADD CONSTRAINT `parties_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `parties` ADD CONSTRAINT `parties_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
CREATE INDEX `idx_party_org_branch` ON `parties` (`org_id`,`branch_id`);
