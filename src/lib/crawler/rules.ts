import { SEVERITY_WEIGHT, type IssueSeverity } from "./issue-catalog";
import type { DetectedIssue, PageFacts } from "./types";

export const THRESHOLDS = {
  titleMin: 30,
  titleMax: 60,
  metaDescriptionMin: 70,
  metaDescriptionMax: 160,
  thinContentWords: 300,
  slowResponseMs: 2000,
  largePageBytes: 1_000_000,
  /** One redirect is normal; two or more is a chain worth flagging. */
  maxRedirects: 1,
  /**
   * Below this a 200 response is not a thin page, it is an empty shell whose
   * content only appears once JavaScript runs.
   */
  jsOnlyContentWords: 50,
  /** main + article + nav is the realistic floor for a well-structured page. */
  minSemanticTags: 3,
  /** Below half the standard security headers is worth a notice. */
  minSecurityHeaders: 3,
} as const;

/**
 * Page-level audit. Pure: same facts in, same issues out, no I/O.
 * Availability failures short-circuit — there is no point reporting a missing
 * title on a page that returned 404.
 */
export function auditPage(facts: PageFacts): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  if (facts.fetchError) {
    return [{ code: "fetch_failed", detail: facts.fetchError }];
  }

  const status = facts.statusCode;
  if (status !== null && status >= 500) {
    return [{ code: "server_error", detail: `Returned ${status}` }];
  }
  if (status !== null && status >= 400) {
    return [{ code: "not_found", detail: `Returned ${status}` }];
  }

  if (facts.redirectChain > THRESHOLDS.maxRedirects) {
    issues.push({
      code: "redirect_chain",
      detail: `${facts.redirectChain} redirects before the final page`,
    });
  }

  if (
    facts.responseTimeMs !== null &&
    facts.responseTimeMs > THRESHOLDS.slowResponseMs
  ) {
    issues.push({
      code: "slow_response",
      detail: `Responded in ${(facts.responseTimeMs / 1000).toFixed(1)}s`,
    });
  }

  if (facts.sizeBytes !== null && facts.sizeBytes > THRESHOLDS.largePageBytes) {
    issues.push({
      code: "large_page",
      detail: `${(facts.sizeBytes / 1024 / 1024).toFixed(1)} MB of HTML`,
    });
  }

  /* ----------------------------------------------------------------- https -- */
  if (!facts.isHttps) {
    issues.push({ code: "no_https" });
  } else if (!facts.hasHsts) {
    // Only meaningful once the page is already secure.
    issues.push({ code: "no_hsts" });
  }

  if (facts.securityHeaderCount < THRESHOLDS.minSecurityHeaders) {
    issues.push({
      code: "weak_security_headers",
      detail: `${facts.securityHeaderCount} of 6 standard headers present`,
    });
  }

  /* ------------------------------------------------------------- ai search -- */
  if (facts.blockedForAiBots) {
    issues.push({ code: "blocked_from_ai_search" });
  }

  const page = facts.extracted;
  // Non-HTML responses (PDFs, images) have nothing further to check.
  if (!page) return issues;

  if (facts.isHttps && page.mixedContentCount > 0) {
    issues.push({
      code: "mixed_content",
      detail: `${page.mixedContentCount} resource${page.mixedContentCount === 1 ? "" : "s"} loaded over HTTP`,
    });
  }

  /* ---------------------------------------------------------------- meta -- */
  if (!page.title) {
    issues.push({ code: "missing_title" });
  } else if (page.title.length > THRESHOLDS.titleMax) {
    issues.push({
      code: "title_too_long",
      detail: `${page.title.length} characters`,
    });
  } else if (page.title.length < THRESHOLDS.titleMin) {
    issues.push({
      code: "title_too_short",
      detail: `${page.title.length} characters`,
    });
  }

  if (!page.metaDescription) {
    issues.push({ code: "missing_meta_description" });
  } else if (page.metaDescription.length > THRESHOLDS.metaDescriptionMax) {
    issues.push({
      code: "meta_description_too_long",
      detail: `${page.metaDescription.length} characters`,
    });
  } else if (page.metaDescription.length < THRESHOLDS.metaDescriptionMin) {
    issues.push({
      code: "meta_description_too_short",
      detail: `${page.metaDescription.length} characters`,
    });
  }

  /* -------------------------------------------------------- indexability -- */
  if (page.isNoindex) {
    issues.push({ code: "noindex", detail: page.metaRobots ?? undefined });
  }

  if (!page.canonical) {
    issues.push({ code: "missing_canonical" });
  } else if (facts.isSelfCanonical === false) {
    issues.push({ code: "non_self_canonical", detail: page.canonical });
  }

  /* ------------------------------------------------------------- content -- */
  if (page.h1.length === 0) {
    issues.push({ code: "missing_h1" });
  } else if (page.h1.length > 1) {
    issues.push({ code: "multiple_h1", detail: `${page.h1.length} H1 tags` });
  }

  if (page.headingOrderBroken) {
    issues.push({ code: "heading_order_broken" });
  }

  // An almost-empty 200 is a rendering problem, not a content problem, so it
  // gets its own code rather than being lumped in with genuinely thin pages.
  if (page.wordCount < THRESHOLDS.jsOnlyContentWords) {
    issues.push({
      code: "js_only_content",
      detail: `${page.wordCount} words in the raw HTML`,
    });
  } else if (page.wordCount < THRESHOLDS.thinContentWords) {
    issues.push({
      code: "thin_content",
      detail: `${page.wordCount} words`,
    });
  }

  if (page.semanticTagCount < THRESHOLDS.minSemanticTags) {
    issues.push({
      code: "low_semantic_html",
      detail: `${page.semanticTagCount} of the common HTML5 landmarks in use`,
    });
  }

  if (page.imagesMissingAlt > 0) {
    issues.push({
      code: "images_missing_alt",
      detail: `${page.imagesMissingAlt} of ${page.imageCount} images`,
    });
  }

  if (!page.lang) {
    issues.push({ code: "missing_lang" });
  }

  // Only sites that actually use hreflang can get this wrong.
  if (
    page.hreflangs.length > 0 &&
    !page.hreflangs.includes("x-default")
  ) {
    issues.push({
      code: "hreflang_missing_x_default",
      detail: `${page.hreflangs.length} alternates declared, no x-default`,
    });
  }

  /* ------------------------------------------------------------- sharing -- */
  if (!page.ogTitle || !page.ogImage) {
    issues.push({ code: "missing_og_tags" });
  }

  if (page.structuredDataTypes.length === 0) {
    issues.push({ code: "no_structured_data" });
  }

  return issues;
}

export type SitePage = {
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  inlinkCount: number;
  isStartUrl: boolean;
};

export type SiteLink = {
  fromUrl: string;
  toUrl: string;
};

/**
 * Checks that only make sense across the whole crawl — duplication, orphans,
 * and links into pages that turned out to be broken. Also pure.
 */
export function auditSite(
  pages: SitePage[],
  links: SiteLink[],
): Map<string, DetectedIssue[]> {
  const result = new Map<string, DetectedIssue[]>();
  const add = (url: string, issue: DetectedIssue) => {
    const list = result.get(url);
    if (list) list.push(issue);
    else result.set(url, [issue]);
  };

  const groupBy = (key: (page: SitePage) => string | null) => {
    const groups = new Map<string, string[]>();
    for (const page of pages) {
      if (page.statusCode === null || page.statusCode >= 400) continue;
      const value = key(page);
      if (!value) continue;
      const bucket = groups.get(value);
      if (bucket) bucket.push(page.url);
      else groups.set(value, [page.url]);
    }
    return groups;
  };

  for (const [title, urls] of groupBy((page) => page.title)) {
    if (urls.length < 2) continue;
    for (const url of urls) {
      add(url, {
        code: "duplicate_title",
        detail: `Shared with ${urls.length - 1} other page${urls.length > 2 ? "s" : ""}: "${title.slice(0, 80)}"`,
      });
    }
  }

  for (const [, urls] of groupBy((page) => page.metaDescription)) {
    if (urls.length < 2) continue;
    for (const url of urls) {
      add(url, {
        code: "duplicate_meta_description",
        detail: `Shared with ${urls.length - 1} other page${urls.length > 2 ? "s" : ""}`,
      });
    }
  }

  for (const page of pages) {
    if (page.isStartUrl) continue;
    if (page.statusCode === null || page.statusCode >= 400) continue;
    if (page.inlinkCount === 0) {
      add(page.url, { code: "orphan_page" });
    }
  }

  const brokenUrls = new Set(
    pages
      .filter((page) => page.statusCode !== null && page.statusCode >= 400)
      .map((page) => page.url),
  );

  if (brokenUrls.size > 0) {
    const brokenBySource = new Map<string, Set<string>>();
    for (const link of links) {
      if (!brokenUrls.has(link.toUrl)) continue;
      const bucket = brokenBySource.get(link.fromUrl);
      if (bucket) bucket.add(link.toUrl);
      else brokenBySource.set(link.fromUrl, new Set([link.toUrl]));
    }

    for (const [fromUrl, targets] of brokenBySource) {
      const [first] = [...targets];
      add(fromUrl, {
        code: "broken_internal_link",
        detail:
          targets.size === 1
            ? first
            : `${targets.size} broken links, including ${first}`,
      });
    }
  }

  return result;
}

/**
 * 0–100. Weighted issues per page, where six weighted points on every page is
 * a floor of zero. Expressed this way so a large clean site and a small clean
 * site score the same.
 */
export function healthScore(
  counts: Record<IssueSeverity, number>,
  pagesCrawled: number,
): number {
  if (pagesCrawled <= 0) return 100;

  const weighted =
    counts.critical * SEVERITY_WEIGHT.critical +
    counts.warning * SEVERITY_WEIGHT.warning +
    counts.notice * SEVERITY_WEIGHT.notice;

  const perPage = weighted / pagesCrawled;
  return Math.max(0, Math.round(100 * (1 - Math.min(1, perPage / 6))));
}
