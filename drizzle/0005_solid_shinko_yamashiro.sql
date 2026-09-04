DROP INDEX `keyword_rankings_keyword_date_idx`;--> statement-breakpoint
ALTER TABLE `keyword_rankings` ADD `device` text;--> statement-breakpoint
ALTER TABLE `keyword_rankings` ADD `country` text;--> statement-breakpoint
CREATE UNIQUE INDEX `keyword_rankings_kw_date_dev_country_idx` ON `keyword_rankings` (`keyword_id`,`date`,`device`,`country`);