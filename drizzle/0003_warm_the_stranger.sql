CREATE TABLE `sectors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sectors_org_name_unique` ON `sectors` (`organization_id`,`name`);
--> statement-breakpoint
CREATE INDEX `sectors_org_active_sort_idx` ON `sectors` (`organization_id`,`active`,`sort_order`);
--> statement-breakpoint
INSERT INTO `sectors` (`organization_id`, `name`, `description`, `sort_order`)
SELECT `id`, 'Atendimento Geral', 'Setor padrão criado durante a atualização', 1
FROM `organizations`;
--> statement-breakpoint
CREATE TABLE `sector_services` (
	`sector_id` integer NOT NULL,
	`service_id` integer NOT NULL,
	PRIMARY KEY(`sector_id`, `service_id`),
	FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sector_services_service_idx` ON `sector_services` (`service_id`);
--> statement-breakpoint
INSERT INTO `sector_services` (`sector_id`, `service_id`)
SELECT `sectors`.`id`, `services`.`id`
FROM `sectors`
INNER JOIN `services` ON `services`.`organization_id` = `sectors`.`organization_id`;
--> statement-breakpoint
ALTER TABLE `desks` ADD `sector_id` integer REFERENCES sectors(id);
--> statement-breakpoint
UPDATE `desks`
SET `sector_id` = (
	SELECT `sectors`.`id`
	FROM `sectors`
	WHERE `sectors`.`organization_id` = `desks`.`organization_id`
	ORDER BY `sectors`.`sort_order` ASC, `sectors`.`id` ASC
	LIMIT 1
);
--> statement-breakpoint
CREATE INDEX `desks_org_sector_active_idx` ON `desks` (`organization_id`,`sector_id`,`active`);
--> statement-breakpoint
CREATE TRIGGER `desks_sector_required_insert`
BEFORE INSERT ON `desks`
WHEN NEW.`sector_id` IS NULL
BEGIN
	SELECT RAISE(ABORT, 'O setor do guichê é obrigatório');
END;
--> statement-breakpoint
CREATE TRIGGER `desks_sector_required_update`
BEFORE UPDATE OF `sector_id` ON `desks`
WHEN NEW.`sector_id` IS NULL
BEGIN
	SELECT RAISE(ABORT, 'O setor do guichê é obrigatório');
END;
--> statement-breakpoint
ALTER TABLE `tickets` ADD `sector_id` integer REFERENCES sectors(id);
