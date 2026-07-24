CREATE TABLE `tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`service` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`desk` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`called_at` text,
	`finished_at` text
);
