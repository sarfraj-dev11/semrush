ALTER TABLE `crawl_pages` ADD `hreflangs` text;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `is_https` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `has_hsts` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `mixed_content_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `semantic_tag_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `external_broken_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `is_blocked_by_robots` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `crawl_pages` ADD `in_sitemap` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `healthy_pages` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `broken_pages` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `pages_with_issues` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `redirect_pages` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `blocked_pages` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `crawlability_score` real;--> statement-breakpoint
ALTER TABLE `crawls` ADD `https_score` real;--> statement-breakpoint
ALTER TABLE `crawls` ADD `internal_linking_score` real;--> statement-breakpoint
ALTER TABLE `crawls` ADD `markup_score` real;--> statement-breakpoint
ALTER TABLE `crawls` ADD `intl_seo_score` real;--> statement-breakpoint
ALTER TABLE `crawls` ADD `performance_score` real;--> statement-breakpoint
ALTER TABLE `crawls` ADD `ai_search_score` real;--> statement-breakpoint
ALTER TABLE `crawls` ADD `cwv_score` real;--> statement-breakpoint
ALTER TABLE `crawls` ADD `avg_response_ms` integer;--> statement-breakpoint
ALTER TABLE `crawls` ADD `llms_txt_found` integer;--> statement-breakpoint
ALTER TABLE `crawls` ADD `bot_access` text;--> statement-breakpoint
ALTER TABLE `crawls` ADD `external_links_checked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `external_links_broken` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crawls` ADD `sitemap_invalid_urls` integer DEFAULT 0 NOT NULL;