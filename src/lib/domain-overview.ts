import { analyzeCacheHeaders, type CacheReport } from "@/lib/crawler/cache-headers";
import {
  evaluateBotAccess,
  fetchLlmsTxt,
  parseRobots,
} from "@/lib/crawler/ai-bots";
import { diffRenditions, type ParityDifference } from "@/lib/crawler/device-parity";
import { DEFAULT_USER_AGENT, fetchPage, fetchText } from "@/lib/crawler/fetcher";
import { detectGeoSignals, type GeoSignals } from "@/lib/crawler/geo-targeting";
import { pickIdentity } from "@/lib/crawler/identity";
import { extractPage, normalizeUrl } from "@/lib/crawler/parser";
import { profileFor } from "@/lib/crawler/profiles";
import { auditPage } from "@/lib/crawler/rules";
import {
  analyzeSecurityHeaders,
  type SecurityHeaderReport,
} from "@/lib/crawler/security-headers";
import { discoverSitemapUrls } from "@/lib/crawler/sitemap-discovery";
import { HostThrottle } from "@/lib/crawler/throttle";
import type { DetectedIssue } from "@/lib/crawler/types";
import { ALL_COUNTRIES } from "@/lib/countries";
import type { BotAccess } from "@/db/schema";
import { getSearchProvider } from "@/lib/search/registry";
import "@/lib/search/providers";
import {
  findDomainPosition,
  QuotaExhaustedError,
  type SearchResult,
} from "@/lib/search/types";

/**
 * On-demand domain overview.
 *
 * Everything here is measured live from the domain the user typed — there are
 * no estimates and no stored aggregates. That constrains what can be shown:
 * traffic volume, authority scores and keyword counts all require a licensed
 * index this tool does not have, so they are absent rather than approximated.
 *
 * What a handful of well-chosen requests genuinely establishes is the technical
 * state of the site, which is the part a crawler can know first-hand.
 */

const VALID_REGIONS = new Set(
  ALL_COUNTRIES.map((country) => country.code).filter((code) => code !== "WW"),
);

export type HomepageFacts = {
  finalUrl: string;
  statusCode: number | null;
  redirectChain: number;
  responseTimeMs: number;
  sizeBytes: number | null;
  contentType: string | null;
  isHttps: boolean;
  hasHsts: boolean;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  isSelfCanonical: boolean | null;
  metaRobots: string | null;
  isNoindex: boolean;
  lang: string | null;
  hreflangs: string[];
  ogTitle: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  wordCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinks: number;
  externalLinks: number;
  structuredDataTypes: string[];
  semanticTagCount: number;
};

export type SearchVisibility =
  | { state: "not_requested" }
  | { state: "unconfigured" }
  | { state: "quota"; message: string }
  | { state: "error"; message: string }
  | {
      state: "ok";
      provider: string;
      /** Pages of this domain Google returned for a site: query. */
      indexedSample: SearchResult[];
      /**
       * Why the site: sample is empty, when it is. Serper's free tier rejects
       * `site:` operators outright, so this is a plan limit rather than a bug.
       */
      indexedSampleUnavailable: string | null;
      /** Where the domain ranks for its own bare name. */
      brandPosition: number | null;
      brandQuery: string;
      brandUnavailable: string | null;
    };

export type DomainOverviewResult = {
  input: string;
  host: string;
  origin: string;
  country: string;
  fetchedAt: Date;
  /** Set only when no response arrived at all — DNS, TLS, timeout. */
  error: string | null;
  /**
   * True when the site answered but refused us. Bot protection is the usual
   * cause and it is a finding in itself, not a failed analysis: everything
   * gathered outside the homepage request is still valid.
   */
  blocked: boolean;
  homepage: HomepageFacts | null;
  issues: DetectedIssue[];
  security: SecurityHeaderReport | null;
  cache: CacheReport | null;
  robotsTxtFound: boolean;
  declaredSitemaps: number;
  sitemapUrlCount: number;
  llmsTxtFound: boolean;
  botAccess: BotAccess[];
  geo: GeoSignals | null;
  /**
   * Every timing measured for the homepage. The desktop and mobile fetches are
   * both real samples, and reporting the range rather than one number stops a
   * warm connection from presenting an implausibly fast round trip as fact.
   */
  responseTimeSamples: number[];
  /** Homepage mobile-vs-desktop differences; empty means they match. */
  parity: ParityDifference[];
  parityChecked: boolean;
  search: SearchVisibility;
};

/** Accepts "example.com", "https://example.com/path", "www.example.com". */
export function resolveDomainInput(
  input: string,
): { origin: string; host: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return null;
    return { origin: url.origin, host: url.hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}

export async function analyzeDomain(
  input: string,
  options: { country?: string; includeSearch?: boolean } = {},
): Promise<DomainOverviewResult> {
  const resolved = resolveDomainInput(input);
  if (!resolved) {
    throw new Error(`"${input}" is not a domain this can analyse.`);
  }

  const { origin, host } = resolved;
  const country = options.country && options.country !== "WW" ? options.country : "US";
  const userAgent = DEFAULT_USER_AGENT;

  // Someone else's site, so the polite profile — two in flight, a second apart.
  const profile = profileFor("polite");
  const throttle = new HostThrottle(profile.throttle);

  const base: DomainOverviewResult = {
    input,
    host,
    origin,
    country,
    fetchedAt: new Date(),
    error: null,
    blocked: false,
    homepage: null,
    issues: [],
    security: null,
    cache: null,
    robotsTxtFound: false,
    declaredSitemaps: 0,
    sitemapUrlCount: 0,
    llmsTxtFound: false,
    botAccess: [],
    geo: null,
    responseTimeSamples: [],
    parity: [],
    parityChecked: false,
    search: { state: "not_requested" },
  };

  /* ------------------------------------------------------------ homepage -- */
  const desktopIdentity = pickIdentity({ device: "desktop" });
  const homepage = await throttle.run(origin, () =>
    fetchPage(origin, {
      userAgent,
      timeoutMs: profile.timeoutMs,
      context: { identity: desktopIdentity },
    }),
  );
  throttle.observe(origin, homepage.statusCode, null);

  if (homepage.error || homepage.statusCode === null) {
    return {
      ...base,
      error:
        homepage.error ??
        "The site did not return a response. It may be down, blocking crawlers, or the domain may not exist.",
    };
  }

  const extracted =
    homepage.html && homepage.statusCode < 400
      ? extractPage(homepage.html, homepage.finalUrl)
      : null;

  const isHttps = homepage.finalUrl.startsWith("https:");
  const hasHsts = isHttps && Boolean(homepage.headers["strict-transport-security"]);
  const security = analyzeSecurityHeaders(homepage.headers);
  const cache = analyzeCacheHeaders(homepage.headers);
  const isSelfCanonical = extracted?.canonical
    ? extracted.canonical === normalizeUrl(homepage.finalUrl)
    : null;

  const issues = auditPage({
    url: homepage.finalUrl,
    depth: 0,
    statusCode: homepage.statusCode,
    contentType: homepage.contentType,
    redirectChain: homepage.redirectChain,
    responseTimeMs: homepage.responseTimeMs,
    sizeBytes: homepage.sizeBytes,
    fetchError: homepage.error,
    isSelfCanonical,
    isHttps,
    hasHsts,
    // Filled in below once robots.txt has been read.
    blockedForAiBots: false,
    securityHeaderCount: security.present,
    extracted,
  });

  // Built from any response, not just a parseable one. A 403 from bot
  // protection still tells us the status, the timing, the CDN and the security
  // headers — discarding all of that because there was no HTML to parse would
  // throw away most of the answer.
  const facts: HomepageFacts = {
    finalUrl: homepage.finalUrl,
    statusCode: homepage.statusCode,
    redirectChain: homepage.redirectChain,
    responseTimeMs: homepage.responseTimeMs,
    sizeBytes: homepage.sizeBytes,
    contentType: homepage.contentType,
    isHttps,
    hasHsts,
    title: extracted?.title ?? null,
    metaDescription: extracted?.metaDescription ?? null,
    canonical: extracted?.canonical ?? null,
    isSelfCanonical,
    metaRobots: extracted?.metaRobots ?? null,
    isNoindex: extracted?.isNoindex ?? false,
    lang: extracted?.lang ?? null,
    hreflangs: extracted?.hreflangs ?? [],
    ogTitle: extracted?.ogTitle ?? null,
    ogImage: extracted?.ogImage ?? null,
    twitterCard: extracted?.twitterCard ?? null,
    wordCount: extracted?.wordCount ?? 0,
    imageCount: extracted?.imageCount ?? 0,
    imagesMissingAlt: extracted?.imagesMissingAlt ?? 0,
    internalLinks:
      extracted?.links.filter((link) => link.isInternal).length ?? 0,
    externalLinks:
      extracted?.links.filter((link) => !link.isInternal).length ?? 0,
    structuredDataTypes: extracted?.structuredDataTypes ?? [],
    semanticTagCount: extracted?.semanticTagCount ?? 0,
  };

  // 401/403 and 429 are the shapes bot protection takes.
  const blocked =
    homepage.statusCode === 401 ||
    homepage.statusCode === 403 ||
    homepage.statusCode === 429;

  /* --------------------------------------------------- robots & sitemaps -- */
  const robotsUrl = new URL("/robots.txt", origin).toString();
  const robotsResponse = await throttle.run(robotsUrl, () =>
    fetchText(robotsUrl, { userAgent }),
  );
  const robots = parseRobots(robotsUrl, robotsResponse.body);
  const declaredSitemaps = robots?.getSitemaps() ?? [];

  const [llmsTxtFound, sitemapUrls] = await Promise.all([
    fetchLlmsTxt(origin, userAgent),
    discoverSitemapUrls(origin, declaredSitemaps, userAgent, host, throttle),
  ]);

  const botAccess = evaluateBotAccess(robots, [homepage.finalUrl]);
  if (botAccess.some((bot) => bot.group === "ai" && !bot.allowed)) {
    issues.push({ code: "blocked_from_ai_search" });
  }
  if (!llmsTxtFound) issues.push({ code: "llms_txt_missing" });

  /* -------------------------------------------------------- device parity -- */
  let parity: ParityDifference[] = [];
  let parityChecked = false;
  const responseTimeSamples: number[] = [homepage.responseTimeMs];

  // Only worth doing when the desktop rendition actually parsed — comparing
  // two error pages says nothing about the site.
  if (extracted) {
    const mobileIdentity = pickIdentity({ device: "mobile" });
    const mobile = await throttle.run(origin, () =>
      fetchPage(origin, {
        userAgent,
        timeoutMs: profile.timeoutMs,
        context: { identity: mobileIdentity },
      }),
    );
    throttle.observe(origin, mobile.statusCode, null);

    if (!mobile.error) {
      responseTimeSamples.push(mobile.responseTimeMs);
      const mobileExtracted =
        mobile.html && mobile.statusCode && mobile.statusCode < 400
          ? extractPage(mobile.html, mobile.finalUrl)
          : null;

      parity = diffRenditions(
        {
          statusCode: homepage.statusCode,
          finalUrl: homepage.finalUrl,
          title: extracted?.title ?? null,
          canonical: extracted?.canonical ?? null,
          metaRobots: extracted?.metaRobots ?? null,
          isNoindex: extracted?.isNoindex ?? false,
          wordCount: extracted?.wordCount ?? 0,
          internalLinkCount: facts.internalLinks,
          error: null,
        },
        {
          statusCode: mobile.statusCode,
          finalUrl: mobile.finalUrl,
          title: mobileExtracted?.title ?? null,
          canonical: mobileExtracted?.canonical ?? null,
          metaRobots: mobileExtracted?.metaRobots ?? null,
          isNoindex: mobileExtracted?.isNoindex ?? false,
          wordCount: mobileExtracted?.wordCount ?? 0,
          internalLinkCount:
            mobileExtracted?.links.filter((link) => link.isInternal).length ?? 0,
          error: null,
        },
      );
      parityChecked = true;
    }
  }

  /* ------------------------------------------------------------------ geo -- */
  const geo = extracted
    ? detectGeoSignals(
        homepage.finalUrl,
        {
          geoRegion: extracted.geoRegion,
          schemaCountries: extracted.schemaCountries,
          currencies: extracted.currencies,
        },
        VALID_REGIONS,
      )
    : null;

  /* ------------------------------------------------- search visibility -- */
  const search = options.includeSearch
    ? await lookupSearchVisibility(host, country)
    : ({ state: "not_requested" } as const);

  return {
    ...base,
    blocked,
    homepage: facts,
    issues,
    security,
    cache,
    robotsTxtFound: Boolean(robotsResponse.body),
    declaredSitemaps: declaredSitemaps.length,
    sitemapUrlCount: sitemapUrls.length,
    llmsTxtFound,
    botAccess,
    geo,
    responseTimeSamples,
    parity,
    parityChecked,
    search,
  };
}

/**
 * Two metered queries: what Google returns for `site:` (a sample of indexed
 * pages, not a count — the reported total is famously unreliable) and where the
 * domain sits for its own name.
 *
 * They are settled independently on purpose. Not every plan permits every query
 * shape — Serper's free tier rejects the `site:` operator outright — and losing
 * a working brand lookup because the other query was refused would report
 * nothing when half the answer was available.
 */
async function lookupSearchVisibility(
  host: string,
  country: string,
): Promise<SearchVisibility> {
  const provider = await getSearchProvider();
  if (!provider) return { state: "unconfigured" };

  const brandQuery = host.replace(/\.[a-z.]+$/i, "").replace(/[-_]/g, " ");
  const options = { country, device: "desktop" as const, limit: 20 };

  const [siteResult, brandResult] = await Promise.allSettled([
    provider.search(`site:${host}`, options),
    provider.search(brandQuery, options),
  ]);

  const reasons = [siteResult, brandResult]
    .filter((entry) => entry.status === "rejected")
    .map((entry) => (entry as PromiseRejectedResult).reason);

  // An exhausted quota is the whole story: neither query will work, and the
  // user needs to see that rather than a per-query failure.
  const quota = reasons.find(
    (reason): reason is QuotaExhaustedError =>
      reason instanceof QuotaExhaustedError,
  );
  if (quota) return { state: "quota", message: quota.message };

  // Both refused for some other reason — nothing useful to show.
  if (siteResult.status === "rejected" && brandResult.status === "rejected") {
    const reason = reasons[0];
    return {
      state: "error",
      message: reason instanceof Error ? reason.message : String(reason),
    };
  }

  const describe = (result: PromiseSettledResult<unknown>) =>
    result.status === "rejected"
      ? result.reason instanceof Error
        ? result.reason.message
        : String(result.reason)
      : null;

  const brandMatch =
    brandResult.status === "fulfilled"
      ? findDomainPosition(brandResult.value.results, host)
      : null;

  return {
    state: "ok",
    provider: provider.label,
    indexedSample:
      siteResult.status === "fulfilled"
        ? siteResult.value.results.slice(0, 10)
        : [],
    indexedSampleUnavailable: describe(siteResult),
    brandPosition: brandMatch?.position ?? null,
    brandQuery,
    brandUnavailable: describe(brandResult),
  };
}
