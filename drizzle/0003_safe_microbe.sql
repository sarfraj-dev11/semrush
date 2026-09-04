ALTER TABLE `crawl_pages` ADD `hreflang_links` text;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `geo_region` text;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `schema_countries` text;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `currencies` text;--> statement-breakpoint
ALTER TABLE `crawls` ADD `countries_targeted` text;--> statement-breakpoint
ALTER TABLE `crawls` ADD `country_sources` text;--> statement-breakpoint
ALTER TABLE `crawls` ADD `hreflang_languages` text;--> statement-breakpoint
ALTER TABLE `crawls` ADD `hreflang_pages` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `hreflang_problems` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `locale_forces_redirect` integer;