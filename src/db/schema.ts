import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch())`;

/* ------------------------------------------------------------------ core -- */

export const clients = sqliteTable(
  "clients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    website: text("website"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    status: text("status", { enum: ["active", "paused", "archived"] })
      .notNull()
      .default("active"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(now),
  },
  (t) => [index("clients_status_idx").on(t.status)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Root URL including protocol, e.g. https://example.com */
    domain: text("domain").notNull(),
    targetCountry: text("target_country").notNull().default("US"),
    targetDevice: text("target_device", { enum: ["mobile", "desktop", "both"] })
      .notNull()
      .default("mobile"),
    crawlDepth: integer("crawl_depth").notNull().default(3),
    crawlLimit: integer("crawl_limit").notNull().default(500),
    crawlConcurrency: integer("crawl_concurrency").notNull().default(4),
    respectRobots: integer("respect_robots", { mode: "boolean" })
      .notNull()
      .default(true),
    /** Newline-separated substring patterns. */
    includePatterns: text("include_patterns"),
    excludePatterns: text("exclude_patterns"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(now),
  },
  (t) => [index("projects_client_idx").on(t.clientId)],
);

export const competitors = sqliteTable(
  "competitors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name"),
    domain: text("domain").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
  },
  (t) => [index("competitors_project_idx").on(t.projectId)],
);

/* ----------------------------------------------------------------- crawl -- */

/** One row per bot in the crawl's `botAccess` snapshot. */
export type BotAccess = {
  /** User-agent token as it appears in robots.txt, e.g. "GPTBot". */
  bot: string;
  label: string;
  group: "ai" | "search";
  allowed: boolean;
  /** Sample of crawled paths this bot may not fetch. */
  blockedSample: string[];
};

export const crawls = sqliteTable(
  "crawls",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["queued", "running", "completed", "failed", "cancelled"],
    })
      .notNull()
      .default("queued"),
    pagesCrawled: integer("pages_crawled").notNull().default(0),
    pagesFound: integer("pages_found").notNull().default(0),
    issuesFound: integer("issues_found").notNull().default(0),
    criticalCount: integer("critical_count").notNull().default(0),
    warningCount: integer("warning_count").notNull().default(0),
    noticeCount: integer("notice_count").notNull().default(0),
    /** 0-100, derived from weighted issue counts against pages crawled. */
    healthScore: real("health_score"),
    robotsTxtFound: integer("robots_txt_found", { mode: "boolean" }),
    sitemapUrls: integer("sitemap_urls"),

    /* -- page classification, counted once when the crawl finishes --------- */
    healthyPages: integer("healthy_pages").notNull().default(0),
    brokenPages: integer("broken_pages").notNull().default(0),
    pagesWithIssues: integer("pages_with_issues").notNull().default(0),
    redirectPages: integer("redirect_pages").notNull().default(0),
    blockedPages: integer("blocked_pages").notNull().default(0),

    /* -- thematic scores, 0-100; null means "not measurable this run" ------ */
    crawlabilityScore: real("crawlability_score"),
    httpsScore: real("https_score"),
    internalLinkingScore: real("internal_linking_score"),
    markupScore: real("markup_score"),
    intlSeoScore: real("intl_seo_score"),
    performanceScore: real("performance_score"),
    aiSearchScore: real("ai_search_score"),
    /** Populated from psi_runs; stays null until a PageSpeed key is set. */
    cwvScore: real("cwv_score"),

    /* -- supporting detail the thematic cards render ----------------------- */
    avgResponseMs: integer("avg_response_ms"),
    llmsTxtFound: integer("llms_txt_found", { mode: "boolean" }),
    botAccess: text("bot_access", { mode: "json" }).$type<BotAccess[]>(),
    externalLinksChecked: integer("external_links_checked").notNull().default(0),
    externalLinksBroken: integer("external_links_broken").notNull().default(0),
    sitemapInvalidUrls: integer("sitemap_invalid_urls").notNull().default(0),
    imagesChecked: integer("images_checked").notNull().default(0),
    imagesBroken: integer("images_broken").notNull().default(0),
    imagesOversized: integer("images_oversized").notNull().default(0),

    /* -- crawl traps, measured over discovered URLs rather than crawled ones - */
    trapPatterns: text("trap_patterns", { mode: "json" }).$type<
      {
        kind: string;
        detail: string;
        urlCount: number;
        example: string;
      }[]
    >(),
    trapAffectedUrls: integer("trap_affected_urls").notNull().default(0),

    /* -- bots that only run when their prerequisites exist ------------------ */
    parityChecked: integer("parity_checked").notNull().default(0),
    parityDiffering: integer("parity_differing").notNull().default(0),
    renderGapChecked: integer("render_gap_checked").notNull().default(0),
    /** Pages whose content exists only after JavaScript runs. */
    jsOnlyPages: integer("js_only_pages").notNull().default(0),
    browserProbeChecked: integer("browser_probe_checked").notNull().default(0),
    /** Set when a browser-backed bot could not run, so the UI can say why. */
    browserProbeUnavailable: text("browser_probe_unavailable"),
    fragmentsChecked: integer("fragments_checked").notNull().default(0),
    fragmentsBroken: integer("fragments_broken").notNull().default(0),

    /* -- country targeting ------------------------------------------------ */
    /** ISO 3166-1 codes the site signals, however it signals them. */
    countriesTargeted: text("countries_targeted", { mode: "json" }).$type<string[]>(),
    /** How each country was detected, e.g. { GB: ["hreflang", "ccTLD"] }. */
    countrySources: text("country_sources", { mode: "json" }).$type<
      Record<string, string[]>
    >(),
    hreflangLanguages: text("hreflang_languages", { mode: "json" }).$type<string[]>(),
    hreflangPages: integer("hreflang_pages").notNull().default(0),
    hreflangProblems: integer("hreflang_problems").notNull().default(0),
    /** Set when Accept-Language probing found a forced locale redirect. */
    localeForcesRedirect: integer("locale_forces_redirect", { mode: "boolean" }),

    /* -- how the crawl was run, for reproducibility ------------------------ */
    crawlProfile: text("crawl_profile"),
    /** CDN or WAF detected on the origin, e.g. "Cloudflare". */
    protectionDetected: text("protection_detected"),

    error: text("error"),
    startedAt: integer("started_at", { mode: "timestamp" }),
    finishedAt: integer("finished_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
  },
  (t) => [index("crawls_project_idx").on(t.projectId, t.createdAt)],
);

export const crawlPages = sqliteTable(
  "crawl_pages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    crawlId: integer("crawl_id")
      .notNull()
      .references(() => crawls.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    path: text("path").notNull(),
    depth: integer("depth").notNull().default(0),
    statusCode: integer("status_code"),
    redirectTo: text("redirect_to"),
    redirectChain: integer("redirect_chain").notNull().default(0),
    contentType: text("content_type"),

    title: text("title"),
    titleLength: integer("title_length"),
    metaDescription: text("meta_description"),
    metaDescriptionLength: integer("meta_description_length"),
    h1: text("h1", { mode: "json" }).$type<string[]>(),
    h1Count: integer("h1_count").notNull().default(0),
    h2Count: integer("h2_count").notNull().default(0),
    headingOrderBroken: integer("heading_order_broken", { mode: "boolean" })
      .notNull()
      .default(false),

    canonical: text("canonical"),
    isSelfCanonical: integer("is_self_canonical", { mode: "boolean" }),
    metaRobots: text("meta_robots"),
    isNoindex: integer("is_noindex", { mode: "boolean" })
      .notNull()
      .default(false),
    isNofollow: integer("is_nofollow", { mode: "boolean" })
      .notNull()
      .default(false),

    ogTitle: text("og_title"),
    ogDescription: text("og_description"),
    ogImage: text("og_image"),
    twitterCard: text("twitter_card"),
    lang: text("lang"),
    hreflangCount: integer("hreflang_count").notNull().default(0),
    /** Declared hreflang codes, needed to check reciprocity and x-default. */
    hreflangs: text("hreflangs", { mode: "json" }).$type<string[]>(),
    /** Full alternate declarations: the graph reciprocity is checked against. */
    hreflangLinks: text("hreflang_links", { mode: "json" }).$type<
      { code: string; href: string }[]
    >(),
    /** Legacy geo.region meta value, uppercased. */
    geoRegion: text("geo_region"),
    /** Country codes found in JSON-LD (addressCountry, areaServed…). */
    schemaCountries: text("schema_countries", { mode: "json" }).$type<string[]>(),
    /** Currency codes found in JSON-LD offers. */
    currencies: text("currencies", { mode: "json" }).$type<string[]>(),
    structuredDataTypes: text("structured_data_types", {
      mode: "json",
    }).$type<string[]>(),

    wordCount: integer("word_count").notNull().default(0),
    imageCount: integer("image_count").notNull().default(0),
    imagesMissingAlt: integer("images_missing_alt").notNull().default(0),
    internalLinks: integer("internal_links").notNull().default(0),
    externalLinks: integer("external_links").notNull().default(0),
    inlinkCount: integer("inlink_count").notNull().default(0),

    /* -- security -------------------------------------------------------- */
    isHttps: integer("is_https", { mode: "boolean" }).notNull().default(false),
    hasHsts: integer("has_hsts", { mode: "boolean" }).notNull().default(false),
    /** Sub-resources or links served over http:// from an https:// page. */
    mixedContentCount: integer("mixed_content_count").notNull().default(0),

    /** Of the six standard security headers, how many the response carried. */
    securityHeaderCount: integer("security_header_count").notNull().default(0),

    /* -- caching ---------------------------------------------------------- */
    /** Raw Cache-Control, kept verbatim so the UI can show what was sent. */
    cacheControl: text("cache_control"),
    /** CDN inferred from vendor headers; null when nothing identified one. */
    cdnProvider: text("cdn_provider"),

    /* -- AI-readability --------------------------------------------------- */
    semanticTagCount: integer("semantic_tag_count").notNull().default(0),

    /* -- resolved after the crawl ---------------------------------------- */
    externalBrokenCount: integer("external_broken_count").notNull().default(0),
    brokenImageCount: integer("broken_image_count").notNull().default(0),
    oversizedImageCount: integer("oversized_image_count").notNull().default(0),
    isBlockedByRobots: integer("is_blocked_by_robots", { mode: "boolean" })
      .notNull()
      .default(false),
    inSitemap: integer("in_sitemap", { mode: "boolean" })
      .notNull()
      .default(false),

    responseTimeMs: integer("response_time_ms"),
    sizeBytes: integer("size_bytes"),
    /** Set when the fetch itself failed (DNS, timeout, TLS). */
    fetchError: text("fetch_error"),
    crawledAt: integer("crawled_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [
    uniqueIndex("crawl_pages_crawl_url_idx").on(t.crawlId, t.url),
    index("crawl_pages_status_idx").on(t.crawlId, t.statusCode),
  ],
);

export const pageLinks = sqliteTable(
  "page_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    crawlId: integer("crawl_id")
      .notNull()
      .references(() => crawls.id, { onDelete: "cascade" }),
    fromPageId: integer("from_page_id")
      .notNull()
      .references(() => crawlPages.id, { onDelete: "cascade" }),
    toUrl: text("to_url").notNull(),
    /** Resolved after the crawl finishes; null for external or uncrawled URLs. */
    toPageId: integer("to_page_id"),
    anchorText: text("anchor_text"),
    rel: text("rel"),
    isInternal: integer("is_internal", { mode: "boolean" })
      .notNull()
      .default(true),
  },
  (t) => [
    index("page_links_from_idx").on(t.fromPageId),
    index("page_links_to_idx").on(t.crawlId, t.toUrl),
  ],
);

/** Static catalog, seeded from src/lib/crawler/issue-catalog.ts. */
export const issueTypes = sqliteTable("issue_types", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
  severity: text("severity", { enum: ["critical", "warning", "notice"] })
    .notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  howToFix: text("how_to_fix").notNull(),
});

export const pageIssues = sqliteTable(
  "page_issues",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    crawlId: integer("crawl_id")
      .notNull()
      .references(() => crawls.id, { onDelete: "cascade" }),
    pageId: integer("page_id")
      .notNull()
      .references(() => crawlPages.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    /** Human-readable specifics, e.g. "Title is 71 characters". */
    detail: text("detail"),
  },
  (t) => [
    index("page_issues_crawl_code_idx").on(t.crawlId, t.code),
    index("page_issues_page_idx").on(t.pageId),
  ],
);

/* ----------------------------------------------------------- performance -- */

export const psiRuns = sqliteTable(
  "psi_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    strategy: text("strategy", { enum: ["mobile", "desktop"] })
      .notNull()
      .default("mobile"),
    performanceScore: real("performance_score"),
    seoScore: real("seo_score"),
    accessibilityScore: real("accessibility_score"),
    bestPracticesScore: real("best_practices_score"),
    lcpMs: real("lcp_ms"),
    cls: real("cls"),
    inpMs: real("inp_ms"),
    fcpMs: real("fcp_ms"),
    ttfbMs: real("ttfb_ms"),
    tbtMs: real("tbt_ms"),
    speedIndexMs: real("speed_index_ms"),
    /** Field data from CrUX when the URL has enough traffic. */
    hasFieldData: integer("has_field_data", { mode: "boolean" })
      .notNull()
      .default(false),
    opportunities: text("opportunities", { mode: "json" }).$type<
      { id: string; title: string; savingsMs: number }[]
    >(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
  },
  (t) => [index("psi_runs_project_idx").on(t.projectId, t.createdAt)],
);

/* -------------------------------------------------------------- imported -- */

export const keywords = sqliteTable(
  "keywords",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    tags: text("tags"),
    targetUrl: text("target_url"),
    searchVolume: integer("search_volume"),
    difficulty: real("difficulty"),
    cpc: real("cpc"),
    intent: text("intent"),
    country: text("country").notNull().default("US"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
  },
  (t) => [
    uniqueIndex("keywords_project_keyword_idx").on(t.projectId, t.keyword),
  ],
);

export const keywordRankings = sqliteTable(
  "keyword_rankings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
    /** Stored as YYYY-MM-DD so a re-import of the same day replaces cleanly. */
    date: text("date").notNull(),
    /** null means "not ranking in the tracked range". */
    position: integer("position"),
    url: text("url"),
    source: text("source").notNull().default("import"),
    /** "desktop" | "mobile"; null for legacy/imported rows. */
    device: text("device"),
    /** ISO 3166-1 alpha-2 country code; null for legacy/imported rows. */
    country: text("country"),
  },
  (t) => [
    uniqueIndex("keyword_rankings_kw_date_dev_country_idx").on(
      t.keywordId,
      t.date,
      t.device,
      t.country,
    ),
  ],
);


export const backlinks = sqliteTable(
  "backlinks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    sourceDomain: text("source_domain").notNull(),
    targetUrl: text("target_url"),
    anchorText: text("anchor_text"),
    domainRating: real("domain_rating"),
    isFollow: integer("is_follow", { mode: "boolean" }).notNull().default(true),
    firstSeen: text("first_seen"),
    lastSeen: text("last_seen"),
    status: text("status", { enum: ["new", "active", "lost"] })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
  },
  (t) => [
    uniqueIndex("backlinks_project_source_idx").on(t.projectId, t.sourceUrl),
    index("backlinks_domain_idx").on(t.projectId, t.sourceDomain),
  ],
);

/* ------------------------------------------------------------------- ops -- */

export type JobType = "crawl" | "psi" | "import" | "tracking";

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", { enum: ["crawl", "psi", "import", "tracking"] }).notNull(),
    projectId: integer("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    payload: text("payload", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    status: text("status", {
      enum: ["queued", "running", "completed", "failed", "cancelled"],
    })
      .notNull()
      .default("queued"),
    progress: integer("progress").notNull().default(0),
    progressLabel: text("progress_label"),
    log: text("log"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    /** Set by the UI; the worker checks it between units of work. */
    cancelRequested: integer("cancel_requested", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
    startedAt: integer("started_at", { mode: "timestamp" }),
    finishedAt: integer("finished_at", { mode: "timestamp" }),
  },
  (t) => [
    index("jobs_status_idx").on(t.status, t.createdAt),
    index("jobs_project_idx").on(t.projectId),
  ],
);

export type ImportSourceType =
  | "keywords"
  | "rankings"
  | "backlinks"
  | "competitors";

export const imports = sqliteTable(
  "imports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceType: text("source_type", {
      enum: ["keywords", "rankings", "backlinks", "competitors"],
    }).notNull(),
    fileName: text("file_name").notNull(),
    mapping: text("mapping", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull(),
    rowsTotal: integer("rows_total").notNull().default(0),
    rowsImported: integer("rows_imported").notNull().default(0),
    rowsSkipped: integer("rows_skipped").notNull().default(0),
    status: text("status", { enum: ["completed", "failed"] })
      .notNull()
      .default("completed"),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
  },
  (t) => [index("imports_project_idx").on(t.projectId, t.createdAt)],
);

/** Reusable column mappings so a recurring export only gets mapped once. */
export const importMappings = sqliteTable(
  "import_mappings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    sourceType: text("source_type", {
      enum: ["keywords", "rankings", "backlinks", "competitors"],
    }).notNull(),
    mapping: text("mapping", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
  },
  (t) => [uniqueIndex("import_mappings_name_idx").on(t.name)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: ["todo", "in_progress", "done"] })
      .notNull()
      .default("todo"),
    priority: text("priority", { enum: ["low", "medium", "high"] })
      .notNull()
      .default("medium"),
    /** Free text until auth exists; becomes a user FK later. */
    assignee: text("assignee"),
    dueDate: text("due_date"),
    /** Set when the task was created from an audit issue. */
    issueCode: text("issue_code"),
    pageUrl: text("page_url"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (t) => [index("tasks_project_status_idx").on(t.projectId, t.status)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});

/* ----------------------------------------------------------------- types -- */

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Competitor = typeof competitors.$inferSelect;
export type Crawl = typeof crawls.$inferSelect;
export type CrawlPage = typeof crawlPages.$inferSelect;
export type NewCrawlPage = typeof crawlPages.$inferInsert;
export type PageLink = typeof pageLinks.$inferSelect;
export type IssueType = typeof issueTypes.$inferSelect;
export type PageIssue = typeof pageIssues.$inferSelect;
export type PsiRun = typeof psiRuns.$inferSelect;
export type Keyword = typeof keywords.$inferSelect;
export type KeywordRanking = typeof keywordRankings.$inferSelect;
export type Backlink = typeof backlinks.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Import = typeof imports.$inferSelect;
export type ImportMapping = typeof importMappings.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Severity = IssueType["severity"];
