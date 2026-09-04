export type IssueSeverity = "critical" | "warning" | "notice";

export type IssueDefinition = {
  code: string;
  label: string;
  severity: IssueSeverity;
  category: string;
  description: string;
  howToFix: string;
};

/**
 * The full set of checks the audit can raise. Rules in rules.ts may only emit
 * codes that appear here; the catalog is mirrored into the database so issue
 * lists can be joined and filtered without hard-coding copy in the UI.
 */
export const ISSUE_CATALOG: IssueDefinition[] = [
  /* -------------------------------------------------------- availability -- */
  {
    code: "fetch_failed",
    label: "Page could not be fetched",
    severity: "critical",
    category: "Availability",
    description:
      "The request failed before a response arrived — DNS, TLS, or a timeout.",
    howToFix:
      "Open the URL directly. If it loads in a browser, check for bot blocking, rate limiting, or a slow server.",
  },
  {
    code: "server_error",
    label: "Server error (5xx)",
    severity: "critical",
    category: "Availability",
    description: "The server returned a 5xx status, so the page is not usable.",
    howToFix:
      "Check application and server logs for this URL. Search engines drop pages that repeatedly return 5xx.",
  },
  {
    code: "not_found",
    label: "Page not found (4xx)",
    severity: "critical",
    category: "Availability",
    description:
      "The page returned a 4xx status but is still linked from the site.",
    howToFix:
      "Restore the page or update the internal links pointing at it. Redirect it only if a genuine replacement exists.",
  },
  {
    code: "broken_internal_link",
    label: "Links to a broken page",
    severity: "warning",
    category: "Availability",
    description: "This page links to an internal URL that returned 4xx or 5xx.",
    howToFix: "Update or remove the link so crawlers and users don't hit a dead end.",
  },
  {
    code: "redirect_chain",
    label: "Redirect chain",
    severity: "warning",
    category: "Availability",
    description:
      "Reaching this page took more than one redirect, which wastes crawl budget and slows users.",
    howToFix: "Point the first URL straight at the final destination.",
  },
  {
    code: "broken_external_link",
    label: "Broken external links",
    severity: "warning",
    category: "Availability",
    description:
      "This page links out to a URL that returned an error or could not be reached.",
    howToFix:
      "Update the link to its current address, or drop it if the destination is gone for good.",
  },

  /* --------------------------------------------------------- indexability -- */
  {
    code: "noindex",
    label: "Page is noindex",
    severity: "warning",
    category: "Indexability",
    description:
      "A robots meta tag tells search engines not to index this page. Often deliberate, but worth confirming.",
    howToFix:
      "If the page should rank, remove the noindex directive. If not, consider whether it should be linked at all.",
  },
  {
    code: "missing_canonical",
    label: "No canonical tag",
    severity: "warning",
    category: "Indexability",
    description:
      "Without a canonical, duplicate URLs (parameters, trailing slashes) can split ranking signals.",
    howToFix: "Add a self-referencing canonical link to the page head.",
  },
  {
    code: "non_self_canonical",
    label: "Canonical points elsewhere",
    severity: "notice",
    category: "Indexability",
    description:
      "This page declares a different URL as canonical, so it is asking not to be indexed itself.",
    howToFix:
      "Confirm this is intended. If the page is meant to rank, make the canonical self-referencing.",
  },
  {
    code: "orphan_page",
    label: "Orphan page",
    severity: "warning",
    category: "Indexability",
    description:
      "The page was found in the sitemap but nothing on the site links to it.",
    howToFix:
      "Link to it from relevant pages so both crawlers and users can reach it.",
  },
  {
    code: "sitemap_invalid_url",
    label: "Incorrect pages found in sitemap.xml",
    severity: "warning",
    category: "Indexability",
    description:
      "The sitemap lists this URL as a live, indexable page, but the crawl found it redirecting, erroring, noindexed, or canonicalised elsewhere.",
    howToFix:
      "Keep sitemaps to canonical 200-status pages only. Everything else dilutes the signal and wastes crawl budget.",
  },

  /* ---------------------------------------------------------------- https -- */
  {
    code: "no_https",
    label: "Page served over HTTP",
    severity: "critical",
    category: "HTTPS",
    description:
      "The page loads over an unencrypted connection, so browsers mark it as not secure.",
    howToFix:
      "Serve the page over HTTPS and redirect the HTTP version to it permanently.",
  },
  {
    code: "mixed_content",
    label: "Mixed content",
    severity: "warning",
    category: "HTTPS",
    description:
      "A secure page pulls in scripts, images or styles over plain HTTP, which browsers block or downgrade.",
    howToFix:
      "Point every sub-resource at its https:// address, or use protocol-relative paths.",
  },
  {
    code: "no_hsts",
    label: "No HSTS header",
    severity: "notice",
    category: "HTTPS",
    description:
      "Without Strict-Transport-Security a visitor's first request can still be made over HTTP and intercepted.",
    howToFix:
      "Send a Strict-Transport-Security header with a max-age of at least six months.",
  },
  {
    code: "weak_security_headers",
    label: "Few security headers",
    severity: "notice",
    category: "HTTPS",
    description:
      "The response carries almost none of the standard security headers, leaving clickjacking and MIME-sniffing defences off.",
    howToFix:
      "Add Content-Security-Policy, X-Content-Type-Options, X-Frame-Options and Referrer-Policy at the server or CDN.",
  },

  /* ------------------------------------------------- international seo -- */
  {
    code: "hreflang_missing_x_default",
    label: "hreflang has no x-default",
    severity: "notice",
    category: "International SEO",
    description:
      "The page declares language alternates but no x-default, so search engines have no fallback for unmatched visitors.",
    howToFix:
      'Add <link rel="alternate" hreflang="x-default" href="…"> pointing at your default-language page.',
  },
  {
    code: "hreflang_no_return_link",
    label: "hreflang has no return link",
    severity: "warning",
    category: "International SEO",
    description:
      "This page names another page as its alternate, but that page does not name this one back. Search engines ignore one-sided hreflang entirely.",
    howToFix:
      "Add the reciprocal link. Every page in a language group must list every other page in the group, itself included.",
  },
  {
    code: "hreflang_missing_self",
    label: "hreflang omits itself",
    severity: "warning",
    category: "International SEO",
    description:
      "A page that declares alternates must also declare itself. Without the self-reference the whole cluster is treated as invalid.",
    howToFix: "Add a self-referencing hreflang with this page's own language code.",
  },
  {
    code: "hreflang_invalid_code",
    label: "Invalid hreflang value",
    severity: "warning",
    category: "International SEO",
    description:
      "An hreflang value is not a valid ISO 639-1 language, optionally paired with an ISO 3166-1 country. Invalid values are silently discarded.",
    howToFix:
      'Use language, or language-COUNTRY, e.g. "en", "en-GB", "pt-BR". The United Kingdom is "gb", not "uk".',
  },
  {
    code: "hreflang_broken_target",
    label: "hreflang points at a dead page",
    severity: "warning",
    category: "International SEO",
    description:
      "An alternate points at a URL that errors or is marked noindex, so the language version it promises cannot be indexed.",
    howToFix: "Point the alternate at a live, indexable URL, or drop the declaration.",
  },
  {
    code: "hreflang_conflicts_canonical",
    label: "hreflang conflicts with canonical",
    severity: "warning",
    category: "International SEO",
    description:
      "An alternate canonicalises to a different URL, which tells search engines to ignore the very page the hreflang points at.",
    howToFix:
      "Make each language version self-canonical. Canonical and hreflang must agree or both are discarded.",
  },
  {
    code: "hreflang_duplicate",
    label: "Duplicate hreflang value",
    severity: "notice",
    category: "International SEO",
    description:
      "The same hreflang value is declared more than once on this page, leaving search engines to pick one arbitrarily.",
    howToFix: "Declare each language-country combination exactly once per page.",
  },
  {
    code: "geo_forced_redirect",
    label: "Forced redirect by language",
    severity: "warning",
    category: "International SEO",
    description:
      "The site redirects visitors to a different URL based on their Accept-Language header. Googlebot crawls mostly from the US, so the other language versions may never be discovered.",
    howToFix:
      "Serve the requested URL and suggest the local version with a banner instead of redirecting automatically.",
  },

  /* ---------------------------------------------------------------- meta -- */
  {
    code: "missing_title",
    label: "Missing title",
    severity: "critical",
    category: "Metadata",
    description:
      "The page has no title tag, so search engines invent one from the content.",
    howToFix: "Add a unique, descriptive title of roughly 30–60 characters.",
  },
  {
    code: "title_too_long",
    label: "Title too long",
    severity: "notice",
    category: "Metadata",
    description: "Titles beyond ~60 characters are usually truncated in results.",
    howToFix: "Tighten the title so the important words come first.",
  },
  {
    code: "title_too_short",
    label: "Title too short",
    severity: "notice",
    category: "Metadata",
    description:
      "Very short titles waste the strongest on-page ranking signal available.",
    howToFix: "Expand the title to describe the page and include its main term.",
  },
  {
    code: "duplicate_title",
    label: "Duplicate title",
    severity: "warning",
    category: "Metadata",
    description:
      "Several pages share this exact title, making them hard to tell apart in results.",
    howToFix: "Give each page a title that reflects its own content.",
  },
  {
    code: "missing_meta_description",
    label: "Missing meta description",
    severity: "warning",
    category: "Metadata",
    description:
      "With no description, search engines pull an arbitrary snippet from the page.",
    howToFix: "Write a 70–160 character summary that earns the click.",
  },
  {
    code: "meta_description_too_long",
    label: "Meta description too long",
    severity: "notice",
    category: "Metadata",
    description: "Descriptions past ~160 characters get cut off.",
    howToFix: "Trim it so the whole message survives truncation.",
  },
  {
    code: "meta_description_too_short",
    label: "Meta description too short",
    severity: "notice",
    category: "Metadata",
    description: "A very short description leaves useful snippet space unused.",
    howToFix: "Expand it toward 70–160 characters.",
  },
  {
    code: "duplicate_meta_description",
    label: "Duplicate meta description",
    severity: "notice",
    category: "Metadata",
    description: "Several pages share this description word for word.",
    howToFix: "Write a distinct description per page.",
  },

  /* ------------------------------------------------------------- content -- */
  {
    code: "missing_h1",
    label: "Missing H1",
    severity: "warning",
    category: "Content",
    description: "The page has no H1, so its main topic is not stated in the markup.",
    howToFix: "Add exactly one H1 describing what the page is about.",
  },
  {
    code: "multiple_h1",
    label: "Multiple H1s",
    severity: "notice",
    category: "Content",
    description:
      "More than one H1 makes the page's primary topic ambiguous to assistive tech and crawlers.",
    howToFix: "Keep one H1 and demote the rest to H2.",
  },
  {
    code: "heading_order_broken",
    label: "Heading levels skip",
    severity: "notice",
    category: "Content",
    description:
      "Heading levels jump (for example H2 straight to H4), which breaks the document outline.",
    howToFix: "Use heading levels in order so the outline is readable.",
  },
  {
    code: "thin_content",
    label: "Thin content",
    severity: "warning",
    category: "Content",
    description:
      "The page has very little body text, so it may not satisfy the query it targets.",
    howToFix:
      "Expand it, or consolidate it into a stronger page and redirect this URL.",
  },
  {
    code: "images_missing_alt",
    label: "Images missing alt text",
    severity: "warning",
    category: "Content",
    description:
      "Images without alt text are invisible to screen readers and image search.",
    howToFix:
      "Describe each meaningful image. Decorative images take an empty alt attribute.",
  },
  {
    code: "missing_lang",
    label: "No lang attribute",
    severity: "notice",
    category: "Content",
    description:
      "The html element has no lang attribute, which assistive tech relies on.",
    howToFix: 'Add lang to the html element, e.g. <html lang="en">.',
  },
  {
    code: "broken_image",
    label: "Broken images",
    severity: "warning",
    category: "Content",
    description:
      "An image on this page could not be fetched, so visitors see a placeholder where the picture should be.",
    howToFix:
      "Re-upload the missing file or point the src at its current location.",
  },
  {
    code: "oversized_image",
    label: "Oversized images",
    severity: "notice",
    category: "Performance",
    description:
      "An image on this page is large enough to delay the largest contentful paint on a mobile connection.",
    howToFix:
      "Compress the file, serve it as WebP or AVIF, and size it to the largest box it actually renders in.",
  },

  /* --------------------------------------------------------- performance -- */
  {
    code: "slow_response",
    label: "Slow server response",
    severity: "warning",
    category: "Performance",
    description: "The server took over two seconds to return this page.",
    howToFix:
      "Look at server-side caching, database queries, and time to first byte.",
  },
  {
    code: "large_page",
    label: "Large HTML document",
    severity: "notice",
    category: "Performance",
    description:
      "The HTML alone is over 1 MB, which delays rendering on slow connections.",
    howToFix:
      "Trim inlined data and markup bloat; move large payloads to separate cached requests.",
  },

  /* ------------------------------------------------------------- sharing -- */
  {
    code: "missing_og_tags",
    label: "Missing social tags",
    severity: "notice",
    category: "Sharing",
    description:
      "No Open Graph title or image, so shared links render without a preview.",
    howToFix: "Add og:title, og:description and og:image to the page head.",
  },
  {
    code: "no_structured_data",
    label: "No structured data",
    severity: "notice",
    category: "Sharing",
    description:
      "The page has no JSON-LD, so it cannot qualify for rich results.",
    howToFix:
      "Add schema.org JSON-LD matching the page type (Article, Product, FAQ, and so on).",
  },

  /* ----------------------------------------------------------- ai search -- */
  {
    code: "blocked_from_ai_search",
    label: "Blocked from AI search",
    severity: "warning",
    category: "AI Search",
    description:
      "robots.txt disallows at least one major AI crawler from this URL, so assistants cannot cite the page.",
    howToFix:
      "If you want the page quoted in AI answers, allow GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and Google-Extended in robots.txt.",
  },
  {
    code: "js_only_content",
    label: "Content requires JavaScript",
    severity: "warning",
    category: "AI Search",
    description:
      "The page returns almost no text in its HTML, so its content only exists after JavaScript runs. Most AI crawlers do not execute JavaScript.",
    howToFix:
      "Server-render or pre-render the main content so it is present in the initial HTML response.",
  },
  {
    code: "low_semantic_html",
    label: "Low semantic HTML usage",
    severity: "notice",
    category: "AI Search",
    description:
      "The page uses few HTML5 landmarks (main, article, nav, header), leaving extractive readers to guess which markup holds the answer.",
    howToFix:
      "Wrap the primary content in <main> and <article>, and mark navigation and page furniture with <nav>, <header> and <footer>.",
  },
  {
    code: "llms_txt_missing",
    label: "Llms.txt not found",
    severity: "notice",
    category: "AI Search",
    description:
      "The site has no /llms.txt, the emerging convention for telling assistants which pages are worth reading.",
    howToFix:
      "Publish /llms.txt listing your key pages in Markdown. It is not yet a formal standard, so treat this as optional.",
  },

  /* --------------------------------------------------------- device parity -- */
  {
    code: "parity_canonical",
    label: "Canonical differs by device",
    severity: "critical",
    category: "Device Parity",
    description:
      "The mobile and desktop renditions declare different canonical URLs. Google indexes the mobile one, so the desktop page you audit is not the page that ranks.",
    howToFix:
      "Serve the same canonical to both. If the site uses separate mobile URLs, the mobile page should canonicalise to the desktop URL and the desktop page should carry a rel=alternate pointing back.",
  },
  {
    code: "parity_robots",
    label: "Indexing directive differs by device",
    severity: "critical",
    category: "Device Parity",
    description:
      "A robots meta directive is present on one rendition and not the other. Because indexing is mobile-first, a mobile-only noindex removes the page from search while the desktop version looks perfectly healthy.",
    howToFix:
      "Make the robots directive identical across devices, then confirm the mobile rendition is the one you intend to index.",
  },
  {
    code: "parity_status",
    label: "Status code differs by device",
    severity: "critical",
    category: "Device Parity",
    description:
      "The same URL returns different status codes to a phone and a desktop browser.",
    howToFix:
      "Check device-conditional routing and any WAF or CDN rule keyed on user agent.",
  },
  {
    code: "parity_redirect",
    label: "Device-specific redirect",
    severity: "warning",
    category: "Device Parity",
    description:
      "One device is redirected somewhere the other is not — typically a separate mobile host.",
    howToFix:
      "Separate mobile URLs are still supported but need matching canonical and alternate annotations. A responsive single URL avoids the problem entirely.",
  },
  {
    code: "parity_content",
    label: "Content differs by device",
    severity: "warning",
    category: "Device Parity",
    description:
      "The mobile rendition carries materially less text than the desktop one. Under mobile-first indexing, content missing from mobile is content that will not be indexed.",
    howToFix:
      "Serve the same primary content to both. Collapsing it behind an accordion is fine — omitting it from the markup is not.",
  },
  {
    code: "parity_title",
    label: "Title differs by device",
    severity: "notice",
    category: "Device Parity",
    description: "The two renditions use different title tags.",
    howToFix: "Serve one title per URL regardless of device.",
  },
  {
    code: "parity_links",
    label: "Internal links differ by device",
    severity: "notice",
    category: "Device Parity",
    description:
      "The mobile rendition exposes noticeably fewer internal links, which shapes how the site is discovered and how link equity flows.",
    howToFix:
      "Keep the primary navigation and in-content links present in the mobile markup, even when visually collapsed.",
  },

  /* ----------------------------------------------------------- render gap -- */
  {
    code: "js_only_page",
    label: "Content requires JavaScript",
    severity: "warning",
    category: "Rendering",
    description:
      "The raw HTML is effectively empty and the content appears only after JavaScript runs. Google renders, but most AI crawlers do not — to those, this page is blank.",
    howToFix:
      "Server-render or pre-render the main content so it is in the initial HTML response.",
  },
  {
    code: "render_gap_content",
    label: "Text only present after rendering",
    severity: "warning",
    category: "Rendering",
    description:
      "A significant share of the page's text is missing from the raw HTML and added by JavaScript.",
    howToFix:
      "Move the primary copy into the server response; leave JavaScript for enhancement.",
  },
  {
    code: "render_gap_links",
    label: "Links only present after rendering",
    severity: "warning",
    category: "Rendering",
    description:
      "Internal links are injected by JavaScript, so a non-rendering crawler cannot discover the pages they point at.",
    howToFix:
      "Emit real <a href> elements in the server response for anything that should be crawlable.",
  },
  {
    code: "render_gap_title",
    label: "Title changes after rendering",
    severity: "notice",
    category: "Rendering",
    description:
      "JavaScript rewrites the title. Crawlers that do not render will index the original.",
    howToFix: "Set the final title server-side.",
  },
  {
    code: "render_gap_headings",
    label: "H1 only present after rendering",
    severity: "notice",
    category: "Rendering",
    description: "The page has no H1 until JavaScript adds one.",
    howToFix: "Include the H1 in the initial HTML.",
  },
  {
    code: "render_gap_structured_data",
    label: "Structured data only present after rendering",
    severity: "notice",
    category: "Rendering",
    description:
      "JSON-LD is injected client-side. Google can pick this up, but it delays rich-result eligibility and other consumers miss it.",
    howToFix: "Emit JSON-LD in the server response.",
  },

  /* ------------------------------------------------------ browser console -- */
  {
    code: "js_error",
    label: "JavaScript error on load",
    severity: "warning",
    category: "Rendering",
    description:
      "A script threw while the page loaded. Whatever it was going to do — inject content, wire up navigation — did not finish.",
    howToFix:
      "Reproduce in a browser console and fix the throwing script. Errors during load frequently mean content never renders for some users.",
  },
  {
    code: "failed_subresource",
    label: "Resource failed to load",
    severity: "warning",
    category: "Rendering",
    description:
      "A script, stylesheet or image on the site's own domain failed to load.",
    howToFix: "Fix or remove the reference — the page is shipping a broken asset.",
  },
  {
    code: "failed_third_party_resource",
    label: "Third-party resource failed to load",
    severity: "notice",
    category: "Rendering",
    description:
      "An asset from another domain failed. Often harmless, but a blocking third-party script that fails can stall rendering.",
    howToFix:
      "Confirm the resource is still needed, and load it asynchronously so its failure cannot block the page.",
  },

  /* ------------------------------------------------------- accessibility -- */
  {
    code: "a11y_critical",
    label: "Critical accessibility violations",
    severity: "critical",
    category: "Accessibility",
    description:
      "axe-core found violations it rates critical — typically content that is entirely unavailable to assistive technology.",
    howToFix:
      "Work through the listed rules; each links to axe's explanation and remediation steps.",
  },
  {
    code: "a11y_serious",
    label: "Serious accessibility violations",
    severity: "warning",
    category: "Accessibility",
    description:
      "Violations that make parts of the page difficult to use with assistive technology.",
    howToFix: "Address the listed rules, starting with the ones affecting the most elements.",
  },
  {
    code: "a11y_minor",
    label: "Minor accessibility violations",
    severity: "notice",
    category: "Accessibility",
    description:
      "Lower-impact violations. Worth clearing, but not ahead of critical and serious ones.",
    howToFix: "Address once the higher-impact violations are resolved.",
  },

  /* ------------------------------------------------------------- fragments -- */
  {
    code: "broken_fragment_link",
    label: "Link to a missing anchor",
    severity: "notice",
    category: "Availability",
    description:
      "A link points at a #fragment that does not exist on the target page. The page returns 200, so link checkers call it healthy — the browser silently lands at the top instead of the intended section.",
    howToFix:
      "Correct the fragment, or add the missing id to the target element. These break most often when a heading is renamed.",
  },

  /* ---------------------------------------------------------------- caching -- */
  {
    code: "vary_user_agent",
    label: "Vary: User-Agent",
    severity: "warning",
    category: "Caching",
    description:
      "The response varies on User-Agent, which forces a separate cache entry per user-agent string and effectively disables shared caching. It is also a signal that the site serves different markup per device.",
    howToFix:
      "Serve one responsive rendition and drop User-Agent from Vary. If adaptive serving is genuinely required, use Client Hints instead.",
  },
  {
    code: "cache_no_store",
    label: "Caching disabled",
    severity: "notice",
    category: "Caching",
    description:
      "Cache-Control: no-store prevents any cache — browser or CDN — from storing this page. Correct for authenticated pages, wasteful for public ones.",
    howToFix:
      "If the page is public, replace no-store with a cache policy suited to how often it changes.",
  },
  {
    code: "no_cache_policy",
    label: "No caching policy",
    severity: "notice",
    category: "Caching",
    description:
      "The response carries no Cache-Control and no ETag or Last-Modified, so every visit re-downloads it in full and caches have to guess.",
    howToFix:
      "Set an explicit Cache-Control, and emit an ETag or Last-Modified so repeat visits can revalidate cheaply.",
  },
  {
    code: "no_revalidation_token",
    label: "No revalidation token",
    severity: "notice",
    category: "Caching",
    description:
      "The response is cacheable but carries neither ETag nor Last-Modified, so a stale cache has no cheap way to check whether it is still current.",
    howToFix: "Emit an ETag or Last-Modified alongside the existing Cache-Control.",
  },
];

/** Issues surfaced under the AI Search banner rather than classic SEO. */
export const AI_SEARCH_CODES = new Set(
  ISSUE_CATALOG.filter((issue) => issue.category === "AI Search").map(
    (issue) => issue.code,
  ),
);

/**
 * Which issue codes sit behind each thematic report. Kept explicit rather than
 * derived from `category`, because a report and a category are not the same
 * thing — a broken outbound link is an Availability issue but belongs under
 * Internal Linking, where someone would actually go looking for it.
 */
export const THEMATIC_ISSUE_CODES: Record<string, string[]> = {
  Crawlability: [
    "fetch_failed",
    "server_error",
    "not_found",
    "redirect_chain",
    "noindex",
    "missing_canonical",
    "non_self_canonical",
    "sitemap_invalid_url",
  ],
  HTTPS: ["no_https", "mixed_content", "no_hsts", "weak_security_headers"],
  "Site Performance": [
    "slow_response",
    "large_page",
    "oversized_image",
    // Caching decides whether a fast response is served twice or fetched twice.
    "no_cache_policy",
    "no_revalidation_token",
    "cache_no_store",
    "vary_user_agent",
    // A page that throws mid-load is a performance problem the timings miss.
    "js_error",
    "failed_subresource",
    "failed_third_party_resource",
  ],
  "Internal Linking": [
    "orphan_page",
    "broken_internal_link",
    "broken_external_link",
    "broken_fragment_link",
  ],
  Markup: ["no_structured_data", "missing_og_tags"],
  "International SEO": [
    "missing_lang",
    "hreflang_missing_x_default",
    "hreflang_no_return_link",
    "hreflang_missing_self",
    "hreflang_invalid_code",
    "hreflang_broken_target",
    "hreflang_conflicts_canonical",
    "hreflang_duplicate",
    "geo_forced_redirect",
  ],
  // Rendering gaps belong here rather than under Performance: the pages are
  // fine for a browser and invisible to a crawler that does not run JavaScript,
  // which is precisely the AI-crawler problem.
  "AI Search": [
    ...AI_SEARCH_CODES,
    "js_only_page",
    "render_gap_content",
    "render_gap_links",
    "render_gap_title",
    "render_gap_headings",
    "render_gap_structured_data",
  ],
  "Device Parity": [
    "parity_canonical",
    "parity_robots",
    "parity_status",
    "parity_redirect",
    "parity_content",
    "parity_title",
    "parity_links",
  ],
  Accessibility: ["a11y_critical", "a11y_serious", "a11y_minor"],
};

export const ISSUE_BY_CODE = new Map(
  ISSUE_CATALOG.map((issue) => [issue.code, issue]),
);

export const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 0,
  warning: 1,
  notice: 2,
};

/** Weights used for the 0–100 health score. */
export const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  critical: 3,
  warning: 1,
  notice: 0.25,
};
