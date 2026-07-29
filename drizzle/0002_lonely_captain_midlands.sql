ALTER TABLE `settings` RENAME TO `organization_settings`;--> statement-breakpoint
CREATE TABLE `account_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_tokens_hash_unique` ON `account_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `account_tokens_user_purpose_idx` ON `account_tokens` (`user_id`,`purpose`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_user_id` integer,
	`organization_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_org_created_idx` ON `audit_logs` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `desks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`name` text NOT NULL,
	`number` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `desks_org_number_unique` ON `desks` (`organization_id`,`number`);--> statement-breakpoint
CREATE INDEX `desks_org_active_idx` ON `desks` (`organization_id`,`active`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_name` text NOT NULL,
	`slug` text NOT NULL,
	`business_type` text DEFAULT 'other' NOT NULL,
	`logo_key` text,
	`primary_color` text DEFAULT '#123D3A' NOT NULL,
	`timezone` text DEFAULT 'America/Maceio' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
INSERT INTO `organizations` (
	`id`,
	`trade_name`,
	`slug`,
	`business_type`,
	`primary_color`,
	`timezone`,
	`status`
) VALUES (
	1,
	'Cartório',
	'cartorio',
	'registry',
	'#123D3A',
	'America/Maceio',
	'active'
);--> statement-breakpoint
CREATE TABLE `services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`name` text NOT NULL,
	`ticket_prefix` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_org_name_unique` ON `services` (`organization_id`,`name`);--> statement-breakpoint
CREATE INDEX `services_org_active_sort_idx` ON `services` (`organization_id`,`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`device_label` text,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_active_idx` ON `sessions` (`user_id`,`revoked_at`,`expires_at`);--> statement-breakpoint
CREATE TABLE `ticket_sequences` (
	`organization_id` integer NOT NULL,
	`service_date` text NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`organization_id`, `service_date`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`failed_login_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`last_login_at` text,
	`password_changed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_one_account_per_organization` ON `users` (`organization_id`) WHERE "users"."role" = 'organization';--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_organization_settings` (
	`organization_id` integer NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`organization_id`, `key`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_organization_settings`("organization_id", "key", "value", "updated_at") SELECT 1, "key", "value", "updated_at" FROM `organization_settings`;--> statement-breakpoint
DROP TABLE `organization_settings`;--> statement-breakpoint
ALTER TABLE `__new_organization_settings` RENAME TO `organization_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
INSERT INTO `services` (
	`organization_id`,
	`name`,
	`ticket_prefix`,
	`sort_order`
) VALUES
	(1, 'Atendimento geral', 'A', 1),
	(1, 'Certidões', 'C', 2),
	(1, 'Registro e reconhecimento', 'R', 3);--> statement-breakpoint
WITH RECURSIVE `desk_numbers`(`number`) AS (
	SELECT 1
	UNION ALL
	SELECT `number` + 1
	FROM `desk_numbers`
	WHERE `number` < COALESCE(
		(
			SELECT CAST(`value` AS INTEGER)
			FROM `organization_settings`
			WHERE `organization_id` = 1 AND `key` = 'desk_count'
		),
		4
	)
)
INSERT INTO `desks` (`organization_id`, `name`, `number`)
SELECT 1, 'Guichê ' || printf('%02d', `number`), `number`
FROM `desk_numbers`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer DEFAULT 1 NOT NULL,
	`service_id` integer,
	`desk_id` integer,
	`service_date` text,
	`sequence_number` integer DEFAULT 0 NOT NULL,
	`code` text NOT NULL,
	`service` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`desk` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`called_at` text,
	`finished_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`desk_id`) REFERENCES `desks`(`id`) ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
INSERT INTO `__new_tickets` (
	`id`,
	`organization_id`,
	`service_id`,
	`desk_id`,
	`service_date`,
	`sequence_number`,
	`code`,
	`service`,
	`priority`,
	`status`,
	`desk`,
	`created_at`,
	`called_at`,
	`finished_at`
)
SELECT
	`tickets`.`id`,
	1,
	(
		SELECT `services`.`id`
		FROM `services`
		WHERE `services`.`organization_id` = 1
			AND `services`.`name` = `tickets`.`service`
	),
	(
		SELECT `desks`.`id`
		FROM `desks`
		WHERE `desks`.`organization_id` = 1
			AND `desks`.`number` = `tickets`.`desk`
	),
	date(`tickets`.`created_at`, '-3 hours'),
	CAST(substr(`tickets`.`code`, 2) AS INTEGER),
	`tickets`.`code`,
	`tickets`.`service`,
	`tickets`.`priority`,
	`tickets`.`status`,
	`tickets`.`desk`,
	`tickets`.`created_at`,
	`tickets`.`called_at`,
	`tickets`.`finished_at`
FROM `tickets`;--> statement-breakpoint
DROP TABLE `tickets`;--> statement-breakpoint
ALTER TABLE `__new_tickets` RENAME TO `tickets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
INSERT INTO `ticket_sequences` (`organization_id`, `service_date`, `last_number`)
SELECT `organization_id`, `service_date`, MAX(`sequence_number`)
FROM `tickets`
WHERE `service_date` IS NOT NULL
GROUP BY `organization_id`, `service_date`;--> statement-breakpoint
CREATE INDEX `tickets_org_status_created_idx` ON `tickets` (`organization_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `tickets_org_service_created_idx` ON `tickets` (`organization_id`,`service_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_org_date_code_unique` ON `tickets` (`organization_id`,`service_date`,`code`);
