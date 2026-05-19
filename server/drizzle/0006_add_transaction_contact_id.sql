ALTER TABLE `transactions` ADD COLUMN `contact_id` bigint unsigned NULL;
ALTER TABLE `transactions` ADD INDEX `idx_tx_contact_id` (`contact_id`);
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_contact_id_parties_id_fk`
  FOREIGN KEY (`contact_id`) REFERENCES `parties`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
