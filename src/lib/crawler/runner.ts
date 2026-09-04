import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crawlPages,
  crawls,
  issueTypes,
  pageIssues,
  pageLinks,
  type Project,
} from "@/db/schema";
import {
  evaluateBotAccess,
  fetchLlmsTxt,
  isBlockedForAiBots,
  parseRobots,
} from "./ai-bots";
import { DEFAULT_USER_AGENT, fetchText, isPlainTextBody } from "./fetcher";
import { ALL_COUNTRIES } from "@/lib/countries";
import { detectGeoSignals, summarizeCoverage, type GeoSignals } from "./geo-targeting";
import { auditHreflang, type HreflangPage } from "./hreflang-audit";
import { accessibilityIssues, summarizeAccessibility } from "./accessibility";
import { collectBrowserDiagnostics } from "./browser-probe";
import { analyzeCacheHeaders, cacheIssues } from "./cache-headers";
import { ChallengeTracker, detectChallenge } from "./challenge-detection";
import { consoleIssues, summarizeConsole } from "./console-checker";
import { detectCrawlTraps } from "./crawl-trap";
import { checkDeviceParity, parityIssueCode } from "./device-parity";
import { checkFragments } from "./fragment-checker";
import { checkRenderGap, renderGapIssueCode } from "./render-gap";
import { discoverSitemapUrls } from "./sitemap-discovery";
import { checkImages, OVERSIZED_IMAGE_BYTES } from "./image-checker";
import { probeLocales } from "./locale-probe";
import { ISSUE_BY_CODE, ISSUE_CATALOG } from "./issue-catalog";
import { checkExternalLinks } from "./link-checker";
import { extractPage, normalizeUrl } from "./parser";
import {
  detectProtection,
  profileForConcurrency,
  slower,
  type CrawlProfile,
} from "./profiles";
import { describePool, loadProxyPool } from "./proxy-config";
import { fetchWithRotation } from "./resilient-fetch";
import { getRenderer } from "./renderer";
import { auditPage, auditSite, healthScore, THRESHOLDS, type SitePage } from "./rules";
import { computeScores, type ScorablePage } from "./scores";
import { analyzeSecurityHeaders } from "./security-headers";
import { validateSitemap, type SitemapPageState } from "./sitemap-audit";
import { HostThrottle } from "./throttle";
import type { DetectedIssue, PageFacts } from "./types";

export class CrawlCancelled extends Error {
  constructor() {
    super("Crawl cancelled");
    this.name = "CrawlCancelled";
  }
}

type RunnerHooks = {
  report: (progress: number, label: string) => Promise<void>;
  isCancelled: () => Promise<boolean>;
  log: (line: string) => Promise<void>;
};

type QueueItem = { url: string; depth: number };

/** Mirrors the static catalog into the database so issues can be joined. */
export async function syncIssueCatalog() {
  for (const issue of ISSUE_CATALOG) {
    await db
      .insert(issueTypes)
      .values(issue)
      .onConflictDoUpdate({ target: issueTypes.code, set: issue });
  }
}

function splitPatterns(value: string | null) {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((pattern) => pattern.trim())
    .filter(Boolean);
}

/** ISO 3166-1 codes, minus the synthetic "Worldwide" entry the UI uses. */
const VALID_REGIONS = new Set(
  ALL_COUNTRIES.map((country) => country.code).filter((code) => code !== "WW"),
);

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type CrawlConfig = {
  scopeMode?: "subdomains" | "exact" | "subfolder";
  crawlSource?: "site" | "sitemap_auto" | "sitemap_custom" | "file";
  sitemapUrl?: string;
  seedUrls?: string[];
  userAgent?: string;
  crawlDelay?: number;
  disallowRules?: string[];
  allowRules?: string[];
  ignoreParams?: boolean;
  paramsList?: string[];
  auth?: { user: string; pass: string } | null;
};

function matchesPattern(url: string, pattern: string): boolean {
  try {
    const trimmed = pattern.trim();
    if (!trimmed) return false;
    const regexPattern = trimmed
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    const regex = new RegExp(regexPattern, "i");
    const parsed = new URL(url);
    const pathAndQuery = parsed.pathname + parsed.search;
    return regex.test(url) || regex.test(pathAndQuery);
  } catch {
    return url.includes(pattern.trim());
  }
}

function cleanUrlForQueue(
  rawUrl: string,
  ignoreParams: boolean,
  paramsToStrip: string[],
): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    if (ignoreParams) {
      const defaultStrip = new Set([
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "gclid",
        "fbclid",
        "session_id",
        "sid",
        "ref",
        "affiliate_id",
        "mc_eid",
        "_ga",
        ...paramsToStrip.map((p) => p.toLowerCase().trim()),
      ]);
      const toDelete: string[] = [];
      parsed.searchParams.forEach((_, key) => {
        if (defaultStrip.has(key.toLowerCase()) || defaultStrip.has(key)) {
          toDelete.push(key);
        }
      });
      for (const k of toDelete) {
        parsed.searchParams.delete(k);
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export async function runCrawl(
  crawlId: number,
  project: Project,
  hooks: RunnerHooks,
  config?: CrawlConfig,
): Promise<void> {
  const userAgent = config?.userAgent || project.userAgent || DEFAULT_USER_AGENT;
  const origin = new URL(project.domain).origin;
  const host = new URL(project.domain).hostname.replace(/^www\./, "");
  const rawStartUrl = normalizeUrl(project.domain) ?? project.domain;
  const startUrl = cleanUrlForQueue(
    rawStartUrl,
    config?.ignoreParams ?? true,
    config?.paramsList ?? [],
  );
  const includes = splitPatterns(project.includePatterns);
  const excludes = splitPatterns(project.excludePatterns);

  await syncIssueCatalog();
  await db
    .update(crawls)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(crawls.id, crawlId));

  /* ------------------------------------------------ politeness profile -- */
  // The project's concurrency setting picks the starting profile; the crawl can
  // still drop to a slower one if the site turns out to be protected or starts
  // pushing back.
  let profile: CrawlProfile = profileForConcurrency(project.crawlConcurrency);
  const throttle = new HostThrottle(profile.throttle);
  let protectionDetected: string | null = null;

  await hooks.log(
    `Crawl profile: ${profile.label} — ${profile.throttle.maxConcurrentPerHost} in flight, ` +
      `${profile.throttle.minIntervalMs}ms apart`,
  );

  /* -------------------------------------------------------------- proxies -- */
  const proxyPool = await loadProxyPool();
  if (proxyPool) {
    await hooks.log(`Proxy pool: ${describePool(proxyPool)}`);
    if (
      project.targetCountry &&
      project.targetCountry !== "WW" &&
      !proxyPool.countries.includes(project.targetCountry)
    ) {
      await hooks.log(
        `No proxy in ${project.targetCountry} — crawling from the default location instead`,
      );
    }
  }

  // Only route through a country when the pool can actually honour it.
  const primaryCountry = project.targetCountry.split(",")[0]?.trim() || "US";
  const proxyCountry =
    proxyPool && primaryCountry !== "WW" &&
    proxyPool.countries.includes(primaryCountry)
      ? primaryCountry
      : undefined;

  const identityDevice = project.targetDevice === "both" ? "mobile" : project.targetDevice;

  /* ------------------------------------------------------------ rendering -- */
  const renderer = getRenderer({});
  await hooks.log(
    renderer.rendersJavaScript
      ? `JS rendering: enabled via ${renderer.label}`
      : "JS rendering: disabled (raw HTML only)",
  );
  let reRendered = 0;

  // Recognises a bot challenge and stops, rather than retrying into a ban.
  const challenges = new ChallengeTracker();

  /* ------------------------------------------------------------ robots -- */
  const robotsUrl = new URL("/robots.txt", origin).toString();
  const robotsResponse = await throttle.run(robotsUrl, () =>
    fetchText(robotsUrl, { userAgent, auth: config?.auth }),
  );
  // Same soft-404 guard as llms.txt — an HTML page served at /robots.txt is
  // not a robots.txt, and parsing it would invent rules that do not exist.
  const robotsBody = isPlainTextBody(
    robotsResponse.body,
    robotsResponse.contentType,
  )
    ? robotsResponse.body
    : null;
  const robots = parseRobots(robotsUrl, robotsBody);

  await hooks.log(
    robots ? "robots.txt found" : "No robots.txt — crawling everything allowed",
  );

  // A site that asks for a delay gets it, even if that is slower than our
  // profile. Ignoring Crawl-delay is the fastest way to earn a block.
  const crawlDelay = robots?.getCrawlDelay(userAgent);
  if (crawlDelay) {
    throttle.setCrawlDelay(startUrl, crawlDelay);
    await hooks.log(`robots.txt requests a ${crawlDelay}s crawl delay — honouring it`);
  }

  /* ---------------------------------------------------------- llms.txt -- */
  const llmsTxtFound = await throttle.run(origin, () =>
    fetchLlmsTxt(origin, userAgent),
  );
  await hooks.log(
    llmsTxtFound ? "llms.txt found" : "No llms.txt published",
  );

  /* ----------------------------------------------------------- sitemaps -- */
  await hooks.report(1, "Reading sitemaps");
  let sitemapUrls: string[] = [];
  if (config?.crawlSource === "site") {
    await hooks.log("Crawl source: internal links only (skipping sitemap discovery)");
  } else if (config?.crawlSource === "sitemap_custom" && config.sitemapUrl) {
    await hooks.log(`Crawl source: custom sitemap ${config.sitemapUrl}`);
    sitemapUrls = await discoverSitemapUrls(
      origin,
      [config.sitemapUrl],
      userAgent,
      host,
      throttle,
    );
  } else if (config?.crawlSource === "file" && config.seedUrls && config.seedUrls.length > 0) {
    await hooks.log(`Crawl source: seed list (${config.seedUrls.length} URLs)`);
    sitemapUrls = config.seedUrls;
  } else {
    sitemapUrls = await discoverSitemapUrls(
      origin,
      robots?.getSitemaps() ?? [],
      userAgent,
      host,
      throttle,
    );
  }
  await hooks.log(`Sitemap URLs discovered: ${sitemapUrls.length}`);

  await db
    .update(crawls)
    .set({
      robotsTxtFound: Boolean(robotsBody),
      sitemapUrls: sitemapUrls.length,
    })
    .where(eq(crawls.id, crawlId));

  /* -------------------------------------------------------------- crawl -- */
  const allowed = (url: string) => {
    if (robots && project.respectRobots && robots.isDisallowed(url, userAgent)) {
      return false;
    }
    if (excludes.some((pattern) => url.includes(pattern))) return false;

    // Custom disallow rules
    if (config?.disallowRules && config.disallowRules.length > 0) {
      for (const rule of config.disallowRules) {
        if (rule && matchesPattern(url, rule)) return false;
      }
    }

    // Custom allow rules (if specified, URL must match or be startUrl)
    if (config?.allowRules && config.allowRules.length > 0) {
      const matchesAny = config.allowRules.some((rule) => rule && matchesPattern(url, rule));
      if (!matchesAny && url !== startUrl) return false;
    }

    if (includes.length > 0 && !includes.some((p) => url.includes(p))) {
      return url === startUrl;
    }

    // Scope modes
    if (config?.scopeMode === "exact") {
      try {
        const u = new URL(url);
        const s = new URL(startUrl);
        if (u.hostname.toLowerCase() !== s.hostname.toLowerCase()) return false;
      } catch {
        return false;
      }
    } else if (config?.scopeMode === "subfolder") {
      try {
        const u = new URL(url);
        const s = new URL(startUrl);
        if (!u.pathname.startsWith(s.pathname)) return false;
      } catch {
        return false;
      }
    }

    return true;
  };

  const queue: QueueItem[] = [{ url: startUrl, depth: 0 }];
  const queued = new Set(queue.map((item) => item.url));

  // Sitemap URLs enter at depth 1 so pages nothing links to still get audited;
  // that is exactly what makes orphan detection possible.
  for (const rawUrl of sitemapUrls) {
    const cleanUrl = cleanUrlForQueue(
      rawUrl,
      config?.ignoreParams ?? true,
      config?.paramsList ?? [],
    );
    if (cleanUrl !== startUrl && allowed(cleanUrl) && !queued.has(cleanUrl)) {
      queued.add(cleanUrl);
      queue.push({ url: cleanUrl, depth: 1 });
    }
  }

  const sitemapSet = new Set(sitemapUrls);

  /**
   * Everything the post-crawl passes need, kept in memory so scoring and
   * sitemap validation do not have to re-read what was just written.
   */
  type CrawledPage = {
    id: number;
    url: string;
    depth: number;
    isStartUrl: boolean;
    isHtml: boolean;
    statusCode: number | null;
    fetchError: string | null;
    redirectChain: number;
    title: string | null;
    metaDescription: string | null;
    isNoindex: boolean;
    canonical: string | null;
    isSelfCanonical: boolean | null;
    isHttps: boolean;
    hasHsts: boolean;
    mixedContentCount: number;
    securityHeaderCount: number;
    structuredDataTypes: string[];
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    twitterCard: string | null;
    lang: string | null;
    hreflangs: string[];
    hreflangLinks: { code: string; href: string }[];
    geoRegion: string | null;
    schemaCountries: string[];
    currencies: string[];
    wordCount: number;
    semanticTagCount: number;
    internalLinks: number;
    isBlockedByRobots: boolean;
    responseTimeMs: number | null;
    sizeBytes: number | null;
  };

  const crawled: CrawledPage[] = [];
  const linkRows: {
    fromPageId: number;
    fromUrl: string;
    toUrl: string;
    anchorText: string | null;
    rel: string | null;
    isInternal: boolean;
  }[] = [];

  const imageRows: { pageId: number; url: string }[] = [];
  const pageIssueRows: {
    crawlId: number;
    pageId: number;
    code: string;
    detail: string | null;
  }[] = [];

  /** Anchor data for the fragment checker, kept in memory like linkRows. */
  const elementIdsByUrl = new Map<string, string[]>();
  const fragmentRows: {
    fromPageId: number;
    toUrl: string;
    fragment: string;
  }[] = [];

  /** Raw-HTML snapshots the render-gap bot compares its rendered pass against. */
  const renderSnapshots: {
    pageId: number;
    url: string;
    title: string | null;
    wordCount: number;
    internalLinkCount: number;
    h1Count: number;
    structuredDataTypes: string[];
  }[] = [];

  let processed = 0;
  let cancelled = false;

  const takeNext = (): QueueItem | null => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      if (item.depth > project.crawlDepth) continue;
      if (!allowed(item.url)) continue;
      return item;
    }
    return null;
  };

  async function processOne(item: QueueItem) {
    // fetchWithRotation handles throttling, proxy rotation on infrastructure
    // faults, and backoff on 429/503. It does not retry a 403 from a fresh IP.
    const { outcome } = await fetchWithRotation(item.url, {
      pool: proxyPool,
      throttle,
      country: proxyCountry,
      device: identityDevice,
      userAgent,
      auth: config?.auth,
      timeoutMs: profile.timeoutMs,
    });

    if (protectionDetected === null) {
      const protection = detectProtection(outcome.headers);
      if (protection) {
        protectionDetected = protection;
        const next = slower(profile);
        if (next.id !== profile.id) {
          profile = next;
          await hooks.log(
            `${protection} detected — dropping to the ${next.label} profile to avoid a block`,
          );
        } else {
          await hooks.log(`${protection} detected`);
        }
      }
    }

    let extracted =
      outcome.html && outcome.statusCode && outcome.statusCode < 400
        ? extractPage(outcome.html, outcome.finalUrl)
        : null;

    const challenge = detectChallenge({
      statusCode: outcome.statusCode,
      headers: outcome.headers,
      html: outcome.html,
      wordCount: extracted?.wordCount,
    });

    if (challenge.challenged) {
      challenges.record(challenge);
      await hooks.log(
        `Challenged on ${item.url}: ${challenge.type} (${challenge.evidence})`,
      );
    }

    // Re-render only what the raw fetch proved needs it. Rendering every page
    // would multiply the crawl's cost for pages that were already complete.
    if (
      renderer.rendersJavaScript &&
      extracted &&
      extracted.wordCount < THRESHOLDS.jsOnlyContentWords
    ) {
      const rendered = await throttle.run(item.url, () =>
        renderer.render(item.url, {
          timeoutMs: profile.timeoutMs,
          userAgent,
        }),
      );

      if (rendered.html) {
        extracted = extractPage(rendered.html, outcome.finalUrl);
        reRendered++;
      }
    }

    const isSelfCanonical = extracted?.canonical
      ? extracted.canonical === normalizeUrl(outcome.finalUrl)
      : null;

    const isHttps = (() => {
      try {
        return new URL(outcome.finalUrl).protocol === "https:";
      } catch {
        return false;
      }
    })();

    // HSTS only counts when the browser was told over a secure connection.
    const hasHsts =
      isHttps && Boolean(outcome.headers["strict-transport-security"]);

    const blockedForAiBots = isBlockedForAiBots(robots, item.url);
    const isHtml = Boolean(
      outcome.contentType && /text\/html|application\/xhtml/i.test(outcome.contentType),
    );
    const security = analyzeSecurityHeaders(outcome.headers);
    const cache = analyzeCacheHeaders(outcome.headers);

    const facts: PageFacts = {
      url: item.url,
      depth: item.depth,
      statusCode: outcome.statusCode,
      contentType: outcome.contentType,
      redirectChain: outcome.redirectChain,
      responseTimeMs: outcome.responseTimeMs,
      sizeBytes: outcome.sizeBytes,
      fetchError: outcome.error,
      isSelfCanonical,
      isHttps,
      hasHsts,
      blockedForAiBots,
      securityHeaderCount: security.present,
      extracted,
    };

    const issues = auditPage(facts);

    // Caching only makes sense to judge on a real HTML page that returned
    // content — directives on a redirect or an error say nothing useful.
    if (isHtml && outcome.statusCode === 200) {
      issues.push(...cacheIssues(cache));
    }

    const [inserted] = await db
      .insert(crawlPages)
      .values({
        crawlId,
        url: item.url,
        path: (() => {
          try {
            return new URL(item.url).pathname;
          } catch {
            return item.url;
          }
        })(),
        depth: item.depth,
        statusCode: outcome.statusCode,
        redirectTo: outcome.redirectTo,
        redirectChain: outcome.redirectChain,
        contentType: outcome.contentType,
        title: extracted?.title ?? null,
        titleLength: extracted?.title?.length ?? null,
        metaDescription: extracted?.metaDescription ?? null,
        metaDescriptionLength: extracted?.metaDescription?.length ?? null,
        h1: extracted?.h1 ?? [],
        h1Count: extracted?.h1.length ?? 0,
        h2Count: extracted?.h2Count ?? 0,
        headingOrderBroken: extracted?.headingOrderBroken ?? false,
        canonical: extracted?.canonical ?? null,
        isSelfCanonical,
        metaRobots: extracted?.metaRobots ?? null,
        isNoindex: extracted?.isNoindex ?? false,
        isNofollow: extracted?.isNofollow ?? false,
        ogTitle: extracted?.ogTitle ?? null,
        ogDescription: extracted?.ogDescription ?? null,
        ogImage: extracted?.ogImage ?? null,
        twitterCard: extracted?.twitterCard ?? null,
        lang: extracted?.lang ?? null,
        hreflangCount: extracted?.hreflangCount ?? 0,
        hreflangs: extracted?.hreflangs ?? [],
        hreflangLinks: extracted?.hreflangLinks ?? [],
        geoRegion: extracted?.geoRegion ?? null,
        schemaCountries: extracted?.schemaCountries ?? [],
        currencies: extracted?.currencies ?? [],
        structuredDataTypes: extracted?.structuredDataTypes ?? [],
        wordCount: extracted?.wordCount ?? 0,
        imageCount: extracted?.imageCount ?? 0,
        imagesMissingAlt: extracted?.imagesMissingAlt ?? 0,
        internalLinks:
          extracted?.links.filter((link) => link.isInternal).length ?? 0,
        externalLinks:
          extracted?.links.filter((link) => !link.isInternal).length ?? 0,
        isHttps,
        hasHsts,
        mixedContentCount: extracted?.mixedContentCount ?? 0,
        securityHeaderCount: security.present,
        semanticTagCount: extracted?.semanticTagCount ?? 0,
        isBlockedByRobots: blockedForAiBots,
        inSitemap: sitemapSet.has(item.url),
        responseTimeMs: outcome.responseTimeMs,
        sizeBytes: outcome.sizeBytes,
        fetchError: outcome.error,
        cacheControl: cache.cacheControl,
        cdnProvider: cache.cdn,
      })
      .returning({ id: crawlPages.id });

    crawled.push({
      id: inserted.id,
      url: item.url,
      depth: item.depth,
      isStartUrl: item.url === startUrl,
      isHtml,
      statusCode: outcome.statusCode,
      fetchError: outcome.error,
      redirectChain: outcome.redirectChain,
      title: extracted?.title ?? null,
      metaDescription: extracted?.metaDescription ?? null,
      isNoindex: extracted?.isNoindex ?? false,
      canonical: extracted?.canonical ?? null,
      isSelfCanonical,
      isHttps,
      hasHsts,
      mixedContentCount: extracted?.mixedContentCount ?? 0,
      securityHeaderCount: security.present,
      structuredDataTypes: extracted?.structuredDataTypes ?? [],
      ogTitle: extracted?.ogTitle ?? null,
      ogDescription: extracted?.ogDescription ?? null,
      ogImage: extracted?.ogImage ?? null,
      twitterCard: extracted?.twitterCard ?? null,
      lang: extracted?.lang ?? null,
      hreflangs: extracted?.hreflangs ?? [],
      hreflangLinks: extracted?.hreflangLinks ?? [],
      geoRegion: extracted?.geoRegion ?? null,
      schemaCountries: extracted?.schemaCountries ?? [],
      currencies: extracted?.currencies ?? [],
      wordCount: extracted?.wordCount ?? 0,
      semanticTagCount: extracted?.semanticTagCount ?? 0,
      internalLinks:
        extracted?.links.filter((link) => link.isInternal).length ?? 0,
      isBlockedByRobots: blockedForAiBots,
      responseTimeMs: outcome.responseTimeMs,
      sizeBytes: outcome.sizeBytes,
    });

    if (issues.length > 0) {
      for (const issue of issues) {
        pageIssueRows.push({
          crawlId,
          pageId: inserted.id,
          code: issue.code,
          detail: issue.detail ?? null,
        });
      }
    }

    for (const imageUrl of extracted?.imageUrls ?? []) {
      imageRows.push({ pageId: inserted.id, url: imageUrl });
    }

    if (extracted) {
      elementIdsByUrl.set(item.url, extracted.elementIds);

      for (const fragment of extracted.fragmentLinks) {
        fragmentRows.push({
          fromPageId: inserted.id,
          toUrl: fragment.url,
          fragment: fragment.fragment,
        });
      }

      renderSnapshots.push({
        pageId: inserted.id,
        url: item.url,
        title: extracted.title,
        wordCount: extracted.wordCount,
        internalLinkCount: extracted.links.filter((link) => link.isInternal)
          .length,
        h1Count: extracted.h1.length,
        structuredDataTypes: extracted.structuredDataTypes,
      });
    }

    for (const link of extracted?.links ?? []) {
      linkRows.push({
        fromPageId: inserted.id,
        fromUrl: item.url,
        toUrl: link.url,
        anchorText: link.anchorText,
        rel: link.rel,
        isInternal: link.isInternal,
      });

      const normalizedTarget = cleanUrlForQueue(
        link.url,
        config?.ignoreParams ?? true,
        config?.paramsList ?? [],
      );

      if (
        link.isInternal &&
        allowed(normalizedTarget) &&
        item.depth + 1 <= project.crawlDepth &&
        !queued.has(normalizedTarget) &&
        queued.size < project.crawlLimit * 4
      ) {
        queued.add(normalizedTarget);
        queue.push({ url: normalizedTarget, depth: item.depth + 1 });
      }
    }
  }

  // Every page belongs to one host, so the per-host cap is the real ceiling.
  // We keep all workers alive until the crawl is truly finished (queue empty & 0 in flight).
  let inFlight = 0;
  const concurrency = profile.throttle.maxConcurrentPerHost;
  const workers = Array.from({ length: concurrency }, async () => {
    for (;;) {
      if (cancelled || processed >= project.crawlLimit) return;

      const item = takeNext();
      if (!item) {
        // Only terminate if no other workers are currently in flight fetching pages
        if (inFlight === 0 && queue.length === 0) return;
        await new Promise((resolve) => setTimeout(resolve, 35));
        continue;
      }

      inFlight++;
      processed++;
      const current = processed;

      try {
        await processOne(item);
      } catch (error) {
        console.error(`❌ Failed on ${item.url}:`, error);
        await hooks.log(
          `Failed on ${item.url}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        inFlight--;
      }

      // Once a site has challenged us repeatedly it has answered the question.
      // Continuing would trade a temporary throttle for a permanent block.
      if (challenges.shouldStop) {
        await hooks.log(
          `Stopping early — ${challenges.count} challenges from this host. ${challenges.summary() ?? ""}`,
        );
        return;
      }

      // Checking every few pages keeps cancellation responsive without
      // querying the jobs table on every single fetch.
      if (current % 5 === 0) {
        if (await hooks.isCancelled()) {
          cancelled = true;
          return;
        }
        const target = Math.min(
          project.crawlLimit,
          current + queue.length,
        );
        await hooks.report(
          Math.min(98, Math.round((current / Math.max(1, target)) * 95)),
          `Crawled ${current} of ~${target} pages`,
        );
      }
    }
  });

  await Promise.all(workers);

  if (cancelled) {
    await db
      .update(crawls)
      .set({
        status: "cancelled",
        pagesCrawled: crawled.length,
        pagesFound: queued.size,
        finishedAt: new Date(),
      })
      .where(eq(crawls.id, crawlId));
    await proxyPool?.close();
    throw new CrawlCancelled();
  }

  /* ------------------------------------------------------- link graph -- */
  await hooks.report(96, "Building the link graph");

  const pageIdByUrl = new Map(crawled.map((page) => [page.url, page.id]));
  const inlinkCounts = new Map<string, number>();

  for (const link of linkRows) {
    if (!link.isInternal || link.toUrl === link.fromUrl) continue;
    if (!pageIdByUrl.has(link.toUrl)) continue;
    inlinkCounts.set(link.toUrl, (inlinkCounts.get(link.toUrl) ?? 0) + 1);
  }

  for (const batch of chunk(linkRows, 400)) {
    await db.insert(pageLinks).values(
      batch.map((link) => ({
        crawlId,
        fromPageId: link.fromPageId,
        toUrl: link.toUrl,
        toPageId: pageIdByUrl.get(link.toUrl) ?? null,
        anchorText: link.anchorText,
        rel: link.rel,
        isInternal: link.isInternal,
      })),
    );
  }

  for (const [url, count] of inlinkCounts) {
    const pageId = pageIdByUrl.get(url);
    if (pageId) {
      await db
        .update(crawlPages)
        .set({ inlinkCount: count })
        .where(eq(crawlPages.id, pageId));
    }
  }

  /* --------------------------------------------- external link check -- */
  await hooks.report(97, "Checking outbound links");

  const externalCheck = await checkExternalLinks(
    linkRows
      .filter((link) => !link.isInternal)
      .map((link) => ({ fromPageId: link.fromPageId, toUrl: link.toUrl })),
    {
      userAgent,
      isCancelled: () => cancelled,
      throttle,
      limit: profile.externalLinkLimit,
      concurrency: profile.externalLinkConcurrency,
      timeoutMs: profile.timeoutMs,
    },
  );

  await hooks.log(
    `Checked ${externalCheck.checked} outbound links, ${externalCheck.broken} broken`,
  );

  for (const [pageId, urls] of externalCheck.brokenByPage) {
    await db
      .update(crawlPages)
      .set({ externalBrokenCount: urls.length })
      .where(eq(crawlPages.id, pageId));
  }

  /* ---------------------------------------------------------- images -- */
  await hooks.report(97, "Checking images");

  const imageCheck = await checkImages(imageRows, {
    userAgent,
    isCancelled: () => cancelled,
    throttle,
    limit: profile.imageLimit,
    concurrency: profile.imageConcurrency,
    timeoutMs: profile.timeoutMs,
  });

  await hooks.log(
    `Checked ${imageCheck.checked} images, ${imageCheck.broken} broken, ` +
      `${imageCheck.oversized} oversized`,
  );

  for (const [pageId, urls] of imageCheck.brokenByPage) {
    await db
      .update(crawlPages)
      .set({ brokenImageCount: urls.length })
      .where(eq(crawlPages.id, pageId));
  }

  for (const [pageId, entries] of imageCheck.oversizedByPage) {
    await db
      .update(crawlPages)
      .set({ oversizedImageCount: entries.length })
      .where(eq(crawlPages.id, pageId));
  }

  /* ------------------------------------------------------- site audit -- */
  await hooks.report(98, "Running site-wide checks");

  const sitePages: SitePage[] = crawled.map((page) => ({
    url: page.url,
    statusCode: page.statusCode,
    title: page.title,
    metaDescription: page.metaDescription,
    inlinkCount: inlinkCounts.get(page.url) ?? 0,
    isStartUrl: page.url === startUrl,
  }));

  const siteIssues = auditSite(
    sitePages,
    linkRows
      .filter((link) => link.isInternal)
      .map((link) => ({ fromUrl: link.fromUrl, toUrl: link.toUrl })),
  );

  const siteIssueRows: {
    crawlId: number;
    pageId: number;
    code: string;
    detail: string | null;
  }[] = [];

  for (const [url, issues] of siteIssues) {
    const pageId = pageIdByUrl.get(url);
    if (!pageId) continue;
    for (const issue of issues) {
      siteIssueRows.push({
        crawlId,
        pageId,
        code: issue.code,
        detail: issue.detail ?? null,
      });
    }
  }

  for (const [pageId, urls] of externalCheck.brokenByPage) {
    const [first] = urls;
    siteIssueRows.push({
      crawlId,
      pageId,
      code: "broken_external_link",
      detail:
        urls.length === 1
          ? first
          : `${urls.length} broken outbound links, including ${first}`,
    });
  }

  for (const [pageId, urls] of imageCheck.brokenByPage) {
    const [first] = urls;
    siteIssueRows.push({
      crawlId,
      pageId,
      code: "broken_image",
      detail:
        urls.length === 1 ? first : `${urls.length} broken images, including ${first}`,
    });
  }

  for (const [pageId, entries] of imageCheck.oversizedByPage) {
    const heaviest = entries.reduce((worst, entry) =>
      entry.bytes > worst.bytes ? entry : worst,
    );
    siteIssueRows.push({
      crawlId,
      pageId,
      code: "oversized_image",
      detail:
        `${entries.length} image${entries.length === 1 ? "" : "s"} over ` +
        `${Math.round(OVERSIZED_IMAGE_BYTES / 1000)} kB, largest ` +
        `${Math.round(heaviest.bytes / 1000)} kB`,
    });
  }

  /* ------------------------------------------------- fragment link check -- */
  // Pure: the ids were collected while parsing, so this costs no requests.
  const fragmentCheck = checkFragments(
    [...elementIdsByUrl].map(([url, elementIds]) => ({
      pageId: pageIdByUrl.get(url) ?? 0,
      url,
      elementIds,
    })),
    fragmentRows.map((row) => ({
      fromPageId: row.fromPageId,
      toUrl: row.toUrl,
      fragment: row.fragment,
    })),
  );

  for (const [pageId, targets] of fragmentCheck.brokenByPage) {
    const [first] = targets;
    siteIssueRows.push({
      crawlId,
      pageId,
      code: "broken_fragment_link",
      detail:
        targets.length === 1
          ? first
          : `${targets.length} links to missing anchors, including ${first}`,
    });
  }

  if (fragmentCheck.checked > 0) {
    await hooks.log(
      `Checked ${fragmentCheck.checked} fragment links, ${fragmentCheck.broken} broken`,
    );
  }

  /* ------------------------------------------------------------ crawl traps -- */
  // Deliberately over *discovered* URLs: the page limit stops the crawler long
  // before it stops a trap, so the evidence is in what got queued.
  const trapReport = detectCrawlTraps([...queued]);
  if (trapReport.patterns.length > 0) {
    await hooks.log(
      `Crawl traps: ${trapReport.patterns
        .map((pattern) => `${pattern.kind} (${pattern.urlCount})`)
        .join(", ")}`,
    );
  }

  /* --------------------------------------------------------- device parity -- */
  await hooks.report(98, "Comparing mobile and desktop");

  const parityTargets = crawled
    .filter((page) => page.isHtml && page.statusCode === 200)
    .sort(
      (a, b) =>
        (inlinkCounts.get(b.url) ?? 0) - (inlinkCounts.get(a.url) ?? 0),
    )
    .map((page) => ({ pageId: page.id, url: page.url }));

  const parityCheck = await checkDeviceParity(parityTargets, {
    limit: Math.min(50, project.crawlLimit),
    concurrency: Math.max(1, Math.floor(profile.throttle.maxConcurrentPerHost / 2)),
    timeoutMs: profile.timeoutMs,
    throttle,
    isCancelled: () => cancelled,
  });

  for (const [pageId, differences] of parityCheck.differencesByPage) {
    for (const difference of differences) {
      siteIssueRows.push({
        crawlId,
        pageId,
        code: parityIssueCode(difference.field),
        detail: `desktop: ${difference.desktop} · mobile: ${difference.mobile}`,
      });
    }
  }

  await hooks.log(
    `Device parity: compared ${parityCheck.checked} pages, ${parityCheck.differing} differ`,
  );

  /* ------------------------------------------------------------ render gap -- */
  const renderGap = await checkRenderGap(renderSnapshots, renderer, {
    limit: 25,
    timeoutMs: profile.timeoutMs,
    throttle,
    isCancelled: () => cancelled,
  });

  if (renderGap.available) {
    for (const [pageId, differences] of renderGap.gapsByPage) {
      for (const difference of differences) {
        siteIssueRows.push({
          crawlId,
          pageId,
          code: renderGapIssueCode(difference.field),
          detail: `raw: ${difference.raw} · rendered: ${difference.rendered}`,
        });
      }
    }

    for (const pageId of renderGap.jsOnlyPages) {
      siteIssueRows.push({
        crawlId,
        pageId,
        code: "js_only_page",
        detail: "Raw HTML carried almost no text; content appeared only after JS",
      });
    }

    await hooks.log(
      `Render gap: checked ${renderGap.checked} pages, ` +
        `${renderGap.gapsByPage.size} differ, ${renderGap.jsOnlyPages.length} JS-only`,
    );
  }

  /* ----------------------------------------- browser console + accessibility -- */
  const browserProbe = await collectBrowserDiagnostics(
    parityTargets,
    renderer,
    {
      limit: 20,
      timeoutMs: Math.max(profile.timeoutMs, 45_000),
      throttle,
      isCancelled: () => cancelled,
      includeAccessibility: true,
      userAgent,
    },
  );

  if (browserProbe.available) {
    const urlByPageId = new Map(crawled.map((page) => [page.id, page.url]));

    for (const [pageId, diagnostics] of browserProbe.diagnosticsByPage) {
      const pageUrl = urlByPageId.get(pageId) ?? project.domain;

      for (const issue of consoleIssues(
        summarizeConsole(diagnostics.console, diagnostics.failedRequests, pageUrl),
      )) {
        siteIssueRows.push({
          crawlId,
          pageId,
          code: issue.code,
          detail: issue.detail ?? null,
        });
      }

      if (diagnostics.axeViolations) {
        for (const issue of accessibilityIssues(
          summarizeAccessibility(diagnostics.axeViolations),
        )) {
          siteIssueRows.push({
            crawlId,
            pageId,
            code: issue.code,
            detail: issue.detail ?? null,
          });
        }
      }
    }

    await hooks.log(
      `Browser probe: ${browserProbe.checked} pages inspected, ${browserProbe.failed} failed`,
    );
  } else if (browserProbe.unavailableReason) {
    await hooks.log(`Browser probe skipped — ${browserProbe.unavailableReason}`);
  }

  /* -------------------------------------------------- sitemap accuracy -- */
  const sitemapStates = new Map<string, SitemapPageState>(
    crawled.map((page) => [
      page.url,
      {
        statusCode: page.statusCode,
        redirectChain: page.redirectChain,
        isNoindex: page.isNoindex,
        canonical: page.canonical,
        fetchError: page.fetchError,
      },
    ]),
  );

  const sitemapProblems = validateSitemap(sitemapUrls, sitemapStates);

  for (const problem of sitemapProblems) {
    const pageId = pageIdByUrl.get(problem.url);
    if (!pageId) continue;
    siteIssueRows.push({
      crawlId,
      pageId,
      code: "sitemap_invalid_url",
      detail: problem.reason,
    });
  }

  if (sitemapProblems.length > 0) {
    await hooks.log(
      `${sitemapProblems.length} of ${sitemapUrls.length} sitemap URLs are not canonical 200 pages`,
    );
  }

  /* --------------------------------------------------- country targeting -- */
  await hooks.report(98, "Analysing country targeting");

  const hreflangPages: HreflangPage[] = crawled.map((page) => ({
    url: page.url,
    links: page.hreflangLinks,
    canonical: page.canonical,
    statusCode: page.statusCode,
    isNoindex: page.isNoindex,
  }));

  const hreflang = auditHreflang(hreflangPages, VALID_REGIONS);

  for (const problem of hreflang.problems) {
    const pageId = pageIdByUrl.get(problem.url);
    if (!pageId) continue;
    siteIssueRows.push({
      crawlId,
      pageId,
      code: problem.code,
      detail: problem.detail,
    });
  }

  const geoSignals: GeoSignals[] = crawled
    .filter((page) => page.isHtml)
    .map((page) =>
      detectGeoSignals(
        page.url,
        {
          geoRegion: page.geoRegion,
          schemaCountries: page.schemaCountries,
          currencies: page.currencies,
        },
        VALID_REGIONS,
      ),
    );

  const coverage = summarizeCoverage(geoSignals, hreflang.regions, VALID_REGIONS);

  await hooks.log(
    coverage.countries.length > 0
      ? `Country targeting: ${coverage.countries.join(", ")}` +
          (hreflang.problems.length
            ? ` — ${hreflang.problems.length} hreflang problems`
            : "")
      : "No country targeting signals found — single-market site",
  );

  /* -- locale probing: does the site redirect by Accept-Language? --------- */
  let localeForcesRedirect: boolean | null = null;
  if (!cancelled) {
    const locale = await probeLocales(startUrl, {
      userAgent,
      throttle,
      timeoutMs: profile.timeoutMs,
    });
    localeForcesRedirect = locale.forcesRedirect;

    if (locale.forcesRedirect) {
      const startPageId = pageIdByUrl.get(startUrl);
      if (startPageId) {
        siteIssueRows.push({
          crawlId,
          pageId: startPageId,
          code: "geo_forced_redirect",
          detail: `Redirects by Accept-Language to ${locale.destinations.join(", ")}`,
        });
      }
      await hooks.log(
        `Locale probe: forced redirect to ${locale.destinations.join(", ")}`,
      );
    } else {
      await hooks.log("Locale probe: no forced redirect by Accept-Language");
    }
  }

  // A missing llms.txt is one site-wide fact; it hangs off the start page so it
  // has somewhere to live in a page-keyed issue table.
  if (!llmsTxtFound) {
    const startPageId = pageIdByUrl.get(startUrl);
    if (startPageId) {
      siteIssueRows.push({
        crawlId,
        pageId: startPageId,
        code: "llms_txt_missing",
        detail: new URL("/llms.txt", origin).toString(),
      });
    }
  }

  for (const batch of chunk([...pageIssueRows, ...siteIssueRows], 400)) {
    await db.insert(pageIssues).values(batch);
  }

  /* ----------------------------------------------------------- totals -- */
  const severityRows = await db
    .select({ code: pageIssues.code, count: sql<number>`count(*)` })
    .from(pageIssues)
    .where(eq(pageIssues.crawlId, crawlId))
    .groupBy(pageIssues.code);

  const counts = { critical: 0, warning: 0, notice: 0 };
  let issuesFound = 0;
  for (const row of severityRows) {
    const definition = ISSUE_BY_CODE.get(row.code);
    if (!definition) continue;
    counts[definition.severity] += row.count;
    issuesFound += row.count;
  }

  const issueCountRows = await db
    .select({ pageId: pageIssues.pageId, count: sql<number>`count(*)` })
    .from(pageIssues)
    .where(eq(pageIssues.crawlId, crawlId))
    .groupBy(pageIssues.pageId);

  const issueCountByPage = new Map(
    issueCountRows.map((row) => [row.pageId, row.count]),
  );

  /* ------------------------------------------------- thematic scoring -- */
  await hooks.report(99, "Scoring thematic reports");

  const botAccess = evaluateBotAccess(
    robots,
    crawled.map((page) => page.url),
  );

  const hreflangProblemsByUrl = new Map<string, number>();
  for (const problem of hreflang.problems) {
    hreflangProblemsByUrl.set(
      problem.url,
      (hreflangProblemsByUrl.get(problem.url) ?? 0) + 1,
    );
  }

  const scorable: ScorablePage[] = crawled.map((page) => ({
    url: page.url,
    isStartUrl: page.isStartUrl,
    isHtml: page.isHtml,
    statusCode: page.statusCode,
    fetchError: page.fetchError,
    redirectChain: page.redirectChain,
    depth: page.depth,
    isNoindex: page.isNoindex,
    canonical: page.canonical,
    isSelfCanonical: page.isSelfCanonical,
    isHttps: page.isHttps,
    hasHsts: page.hasHsts,
    mixedContentCount: page.mixedContentCount,
    securityHeaderCount: page.securityHeaderCount,
    structuredDataTypes: page.structuredDataTypes,
    ogTitle: page.ogTitle,
    ogDescription: page.ogDescription,
    ogImage: page.ogImage,
    twitterCard: page.twitterCard,
    lang: page.lang,
    hreflangs: page.hreflangs,
    hreflangProblemCount: hreflangProblemsByUrl.get(page.url) ?? 0,
    wordCount: page.wordCount,
    semanticTagCount: page.semanticTagCount,
    inlinkCount: inlinkCounts.get(page.url) ?? 0,
    internalLinks: page.internalLinks,
    externalBrokenCount: externalCheck.brokenByPage.get(page.id)?.length ?? 0,
    isBlockedByRobots: page.isBlockedByRobots,
    responseTimeMs: page.responseTimeMs,
    sizeBytes: page.sizeBytes,
    issueCount: issueCountByPage.get(page.id) ?? 0,
  }));

  const scores = computeScores(scorable, {
    robotsTxtFound: Boolean(robotsBody),
    llmsTxtFound,
    botAccess,
    sitemapUrlCount: sitemapUrls.length,
    sitemapProblemCount: sitemapProblems.length,
    countriesTargeted: coverage.countries,
    localeForcesRedirect,
  });

  await db
    .update(crawls)
    .set({
      status: "completed",
      pagesCrawled: crawled.length,
      pagesFound: queued.size,
      issuesFound,
      criticalCount: counts.critical,
      warningCount: counts.warning,
      noticeCount: counts.notice,
      healthScore: healthScore(counts, crawled.length),

      healthyPages: scores.classification.healthy,
      brokenPages: scores.classification.broken,
      pagesWithIssues: scores.classification.withIssues,
      redirectPages: scores.classification.redirects,
      blockedPages: scores.classification.blocked,

      crawlabilityScore: scores.crawlability,
      httpsScore: scores.https,
      internalLinkingScore: scores.internalLinking,
      markupScore: scores.markup,
      intlSeoScore: scores.intlSeo,
      performanceScore: scores.performance,
      aiSearchScore: scores.aiSearch,

      avgResponseMs: scores.avgResponseMs,
      llmsTxtFound,
      botAccess,
      trapPatterns: trapReport.patterns,
      trapAffectedUrls: trapReport.affectedUrls,
      parityChecked: parityCheck.checked,
      parityDiffering: parityCheck.differing,
      renderGapChecked: renderGap.checked,
      jsOnlyPages: renderGap.jsOnlyPages.length,
      browserProbeChecked: browserProbe.checked,
      browserProbeUnavailable: browserProbe.unavailableReason,
      fragmentsChecked: fragmentCheck.checked,
      fragmentsBroken: fragmentCheck.broken,

      externalLinksChecked: externalCheck.checked,
      externalLinksBroken: externalCheck.broken,
      sitemapInvalidUrls: sitemapProblems.length,
      imagesChecked: imageCheck.checked,
      imagesBroken: imageCheck.broken,
      imagesOversized: imageCheck.oversized,

      countriesTargeted: coverage.countries,
      countrySources: coverage.sources,
      hreflangLanguages: hreflang.languages,
      hreflangPages: hreflang.participating,
      hreflangProblems: hreflang.problems.length,
      localeForcesRedirect,

      crawlProfile: profile.id,
      protectionDetected,

      finishedAt: new Date(),
    })
    .where(eq(crawls.id, crawlId));

  await hooks.log(
    `Crawled ${crawled.length} pages, found ${issuesFound} issues ` +
      `(${counts.critical} critical, ${counts.warning} warnings, ${counts.notice} notices)`,
  );
  await hooks.log(
    `Scores — health ${healthScore(counts, crawled.length)}%, ` +
      `crawlability ${scores.crawlability ?? "n/a"}%, https ${scores.https ?? "n/a"}%, ` +
      `AI search ${scores.aiSearch ?? "n/a"}%`,
  );

  if (reRendered > 0) {
    await hooks.log(`Re-rendered ${reRendered} JavaScript-only pages`);
  }

  await renderer.close?.();

  if (proxyPool) {
    const benched = proxyPool.stats().filter((entry) => entry.benched).length;
    if (benched > 0) {
      await hooks.log(`${benched} of ${proxyPool.size} proxies were benched`);
    }
    await proxyPool.close();
  }
}

export type { DetectedIssue };
