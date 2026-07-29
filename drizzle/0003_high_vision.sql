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
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_desks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`sector_id` integer NOT NULL,
	`name` text NOT NULL,
	`number` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sector_id`) REFERENCES `sectors`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_desks` (
	`id`, `organization_id`, `sector_id`, `name`, `number`, `active`, `created_at`, `updated_at`
)
SELECT
	`desks`.`id`, `desks`.`organization_id`, `sectors`.`id`, `desks`.`name`,
	`desks`.`number`, `desks`.`active`, `desks`.`created_at`, `desks`.`updated_at`
FROM `desks`
INNER JOIN `sectors` ON `sectors`.`organization_id` = `desks`.`organization_id`;
--> statement-breakpoint
DROP TABLE `desks`;
--> statement-breakpoint
ALTER TABLE `__new_desks` RENAME TO `desks`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `desks_org_number_unique` ON `desks` (`organization_id`,`number`);
--> statement-breakpoint
CREATE INDEX `desks_org_active_idx` ON `desks` (`organization_id`,`active`);
--> statement-breakpoint
CREATE INDEX `desks_org_sector_active_idx` ON `desks` (`organization_id`,`sector_id`,`active`);
--> statement-breakpoint
ALTER TABLE `tickets` ADD `sector_id` integer REFERENCES sectors(id);
