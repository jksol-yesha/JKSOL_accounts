UPDATE `transactions` AS `t`
JOIN `users_old` AS `uo`
  ON `uo`.`id` = `t`.`created_by`
JOIN `users` AS `u`
  ON LOWER(`u`.`email`) = LOWER(`uo`.`email`)
LEFT JOIN `users` AS `existing_user`
  ON `existing_user`.`id` = `t`.`created_by`
SET `t`.`created_by` = `u`.`id`
WHERE `t`.`created_by` IS NOT NULL
  AND `existing_user`.`id` IS NULL;

ALTER TABLE `transactions`
DROP FOREIGN KEY `transactions_created_by_users_id_fk`;

ALTER TABLE `transactions`
ADD CONSTRAINT `transactions_created_by_users_id_fk`
FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
