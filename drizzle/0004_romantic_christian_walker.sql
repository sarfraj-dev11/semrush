ALTER TABLE `crawl_pages` ADD `cache_control` text;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `cdn_provider` text;--> statement-breakpoint
ALTER TABLE `crawls` ADD `trap_patterns` text;--> statement-breakpoint
ALTER TABLE `crawls` ADD `trap_affected_urls` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `parity_checked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `parity_differing` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `render_gap_checked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `js_only_pages` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `browser_probe_checked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `browser_probe_unavailable` text;--> statement-breakpoint
ALTER TABLE `crawls` ADD `fragments_checked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `fragments_broken` integer DEFAULT 0 NOT NULL;