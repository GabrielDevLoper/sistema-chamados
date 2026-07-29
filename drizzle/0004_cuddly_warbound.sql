ALTER TABLE `tickets` ADD `sector` text;
--> statement-breakpoint
UPDATE `tickets`
SET `sector` = (
	SELECT `sectors`.`name`
	FROM `sectors`
	WHERE `sectors`.`id` = `tickets`.`sector_id`
)
WHERE `sector_id` IS NOT NULL;
