ALTER TABLE `crawl_pages` ADD `security_header_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `broken_image_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `oversized_image_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `images_checked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `images_broken` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `images_oversized` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `crawl_profile` text;--> statement-breakpoint
ALTER TABLE `crawls` ADD `protection_detected` text;