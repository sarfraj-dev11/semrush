CREATE TABLE `backlinks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`source_url` text NOT NULL,
	`source_domain` text NOT NULL,
	`target_url` text,
	`anchor_text` text,
	`domain_rating` real,
	`is_follow` integer DEFAULT true NOT NULL,
	`first_seen` text,
	`last_seen` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `backlinks_project_source_idx` ON `backlinks` (`project_id`,`source_url`);--> statement-breakpoint
CREATE INDEX `backlinks_domain_idx` ON `backlinks` (`project_id`,`source_domain`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`contact_name` text,
	`contact_email` text,
	`contact_phone` text,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clients_status_idx` ON `clients` (`status`);--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`name` text,
	`domain` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `competitors_project_idx` ON `competitors` (`project_id`);--> statement-breakpoint
CREATE TABLE `crawl_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`crawl_id` integer NOT NULL,
	`url` text NOT NULL,
	`path` text NOT NULL,
	`depth` integer DEFAULT 0 NOT NULL,
	`status_code` integer,
	`redirect_to` text,
	`redirect_chain` integer DEFAULT 0 NOT NULL,
	`content_type` text,
	`title` text,
	`title_length` integer,
	`meta_description` text,
	`meta_description_length` integer,
	`h1` text,
	`h1_count` integer DEFAULT 0 NOT NULL,
	`h2_count` integer DEFAULT 0 NOT NULL,
	`heading_order_broken` integer DEFAULT false NOT NULL,
	`canonical` text,
	`is_self_canonical` integer,
	`meta_robots` text,
	`is_noindex` integer DEFAULT false NOT NULL,
	`is_nofollow` integer DEFAULT false NOT NULL,
	`og_title` text,
	`og_description` text,
	`og_image` text,
	`twitter_card` text,
	`lang` text,
	`hreflang_count` integer DEFAULT 0 NOT NULL,
	`structured_data_types` text,
	`word_count` integer DEFAULT 0 NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`images_missing_alt` integer DEFAULT 0 NOT NULL,
	`internal_links` integer DEFAULT 0 NOT NULL,
	`external_links` integer DEFAULT 0 NOT NULL,
	`inlink_count` integer DEFAULT 0 NOT NULL,
	`response_time_ms` integer,
	`size_bytes` integer,
	`fetch_error` text,
	`crawled_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`crawl_id`) REFERENCES `crawls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crawl_pages_crawl_url_idx` ON `crawl_pages` (`crawl_id`,`url`);--> statement-breakpoint
CREATE INDEX `crawl_pages_status_idx` ON `crawl_pages` (`crawl_id`,`status_code`);--> statement-breakpoint
CREATE TABLE `crawls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`pages_crawled` integer DEFAULT 0 NOT NULL,
	`pages_found` integer DEFAULT 0 NOT NULL,
	`issues_found` integer DEFAULT 0 NOT NULL,
	`critical_count` integer DEFAULT 0 NOT NULL,
	`warning_count` integer DEFAULT 0 NOT NULL,
	`notice_count` integer DEFAULT 0 NOT NULL,
	`health_score` real,
	`robots_txt_found` integer,
	`sitemap_urls` integer,
	`error` text,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `crawls_project_idx` ON `crawls` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `import_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`source_type` text NOT NULL,
	`mapping` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_mappings_name_idx` ON `import_mappings` (`name`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`source_type` text NOT NULL,
	`file_name` text NOT NULL,
	`mapping` text NOT NULL,
	`rows_total` integer DEFAULT 0 NOT NULL,
	`rows_imported` integer DEFAULT 0 NOT NULL,
	`rows_skipped` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `imports_project_idx` ON `imports` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `issue_types` (
	`code` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`severity` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`how_to_fix` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`project_id` integer,
	`payload` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`progress_label` text,
	`log` text,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `jobs_project_idx` ON `jobs` (`project_id`);--> statement-breakpoint
CREATE TABLE `keyword_rankings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword_id` integer NOT NULL,
	`date` text NOT NULL,
	`position` integer,
	`url` text,
	`source` text DEFAULT 'import' NOT NULL,
	FOREIGN KEY (`keyword_id`) REFERENCES `keywords`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `keyword_rankings_keyword_date_idx` ON `keyword_rankings` (`keyword_id`,`date`);--> statement-breakpoint
CREATE TABLE `keywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`keyword` text NOT NULL,
	`tags` text,
	`target_url` text,
	`search_volume` integer,
	`difficulty` real,
	`cpc` real,
	`intent` text,
	`country` text DEFAULT 'US' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `keywords_project_keyword_idx` ON `keywords` (`project_id`,`keyword`);--> statement-breakpoint
CREATE TABLE `page_issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`crawl_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	`code` text NOT NULL,
	`detail` text,
	FOREIGN KEY (`crawl_id`) REFERENCES `crawls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `crawl_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `page_issues_crawl_code_idx` ON `page_issues` (`crawl_id`,`code`);--> statement-breakpoint
CREATE INDEX `page_issues_page_idx` ON `page_issues` (`page_id`);--> statement-breakpoint
CREATE TABLE `page_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`crawl_id` integer NOT NULL,
	`from_page_id` integer NOT NULL,
	`to_url` text NOT NULL,
	`to_page_id` integer,
	`anchor_text` text,
	`rel` text,
	`is_internal` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`crawl_id`) REFERENCES `crawls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_page_id`) REFERENCES `crawl_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `page_links_from_idx` ON `page_links` (`from_page_id`);--> statement-breakpoint
CREATE INDEX `page_links_to_idx` ON `page_links` (`crawl_id`,`to_url`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`target_country` text DEFAULT 'US' NOT NULL,
	`target_device` text DEFAULT 'mobile' NOT NULL,
	`crawl_depth` integer DEFAULT 3 NOT NULL,
	`crawl_limit` integer DEFAULT 500 NOT NULL,
	`crawl_concurrency` integer DEFAULT 4 NOT NULL,
	`respect_robots` integer DEFAULT true NOT NULL,
	`include_patterns` text,
	`exclude_patterns` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_client_idx` ON `projects` (`client_id`);--> statement-breakpoint
CREATE TABLE `psi_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`url` text NOT NULL,
	`strategy` text DEFAULT 'mobile' NOT NULL,
	`performance_score` real,
	`seo_score` real,
	`accessibility_score` real,
	`best_practices_score` real,
	`lcp_ms` real,
	`cls` real,
	`inp_ms` real,
	`fcp_ms` real,
	`ttfb_ms` real,
	`tbt_ms` real,
	`speed_index_ms` real,
	`has_field_data` integer DEFAULT false NOT NULL,
	`opportunities` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `psi_runs_project_idx` ON `psi_runs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`assignee` text,
	`due_date` text,
	`issue_code` text,
	`page_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_project_status_idx` ON `tasks` (`project_id`,`status`);