ALTER TABLE `accounts`
DROP FOREIGN KEY `accounts_created_by_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `accounts`
ADD CONSTRAINT `accounts_created_by_users_id_fk`
FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
