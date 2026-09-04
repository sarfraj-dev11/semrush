import type { BotAccess } from "@/db/schema";
import { THRESHOLDS } from "./rules";

/**
 * Thematic scoring.
 *
 * Every score is the same shape: count the checks that apply to this site,
 * count the ones that passed, divide. A check that cannot apply is never
 * counted, so a single-language site is not punished for having no hreflang and
 * a site with no sitemap is not credited for having a valid one.
 *
 * A null score means "nothing to measure" and should render as such — it is
 * not the same as scoring zero, and collapsing the two is exactly how a
 * dashboard ends up lying.
 */

export type ScorablePage = {
  url: string;
  isStartUrl: boolean;
  isHtml: boolean;
  statusCode: number | null;
  fetchError: string | null;
  redirectChain: number;
  depth: number;

  isNoindex: boolean;
  canonical: string | null;
  isSelfCanonical: boolean | null;

  isHttps: boolean;
  hasHsts: boolean;
  mixedContentCount: number;
  /** 0-6, from analyzeSecurityHeaders. */
  securityHeaderCount: number;

  structuredDataTypes: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;

  lang: string | null;
  hreflangs: string[];
  /** Problems the hreflang graph audit attributed to this page. */
  hreflangProblemCount: number;

  wordCount: number;
  semanticTagCount: number;

  inlinkCount: number;
  internalLinks: number;
  externalBrokenCount: number;
  isBlockedByRobots: boolean;

  responseTimeMs: number | null;
  sizeBytes: number | null;

  /** Total issues raised against this page, used for classification only. */
  issueCount: number;
};

export type ScorableSite = {
  robotsTxtFound: boolean;
  llmsTxtFound: boolean;
  botAccess: BotAccess[];
  sitemapUrlCount: number;
  sitemapProblemCount: number;
  /** ISO 3166-1 codes the site signals targeting for. */
  countriesTargeted: string[];
  /** null when the locale probe did not run. */
  localeForcesRedirect: boolean | null;
};

export type PageClassification = {
  healthy: number;
  broken: number;
  withIssues: number;
  redirects: number;
  blocked: number;
};

export type ThematicScores = {
  crawlability: number | null;
  https: number | null;
  internalLinking: number | null;
  markup: number | null;
  intlSeo: number | null;
  performance: number | null;
  aiSearch: number | null;
  avgResponseMs: number | null;
  classification: PageClassification;
};

type Tally = { passed: number; total: number };

const newTally = (): Tally => ({ passed: 0, total: 0 });

/** Records one applicable check and whether it passed. */
function check(tally: Tally, passed: boolean) {
  tally.total++;
  if (passed) tally.passed++;
}

function pct(tally: Tally): number | null {
  if (tally.total === 0) return null;
  return Math.round((tally.passed / tally.total) * 100);
}

const isOk = (page: ScorablePage) =>
  page.fetchError === null &&
  page.statusCode !== null &&
  page.statusCode >= 200 &&
  page.statusCode < 400;

/** Pages that returned real HTML — the only ones with markup worth judging. */
const isContentPage = (page: ScorablePage) => isOk(page) && page.isHtml;

export function classifyPages(pages: ScorablePage[]): PageClassification {
  const out: PageClassification = {
    healthy: 0,
    broken: 0,
    withIssues: 0,
    redirects: 0,
    blocked: 0,
  };

  // Priority order — a 404 that also redirects is reported as broken, since
  // that is the fact worth acting on.
  for (const page of pages) {
    if (page.fetchError || (page.statusCode !== null && page.statusCode >= 400)) {
      out.broken++;
    } else if (page.redirectChain > 0) {
      out.redirects++;
    } else if (page.isNoindex || page.isBlockedByRobots) {
      out.blocked++;
    } else if (page.issueCount > 0) {
      out.withIssues++;
    } else {
      out.healthy++;
    }
  }

  return out;
}

export function computeScores(
  pages: ScorablePage[],
  site: ScorableSite,
): ThematicScores {
  const crawlability = newTally();
  const https = newTally();
  const internalLinking = newTally();
  const markup = newTally();
  const intlSeo = newTally();
  const performance = newTally();
  const aiSearch = newTally();

  /* ------------------------------------------------------- site-level -- */
  check(crawlability, site.robotsTxtFound);
  if (site.sitemapUrlCount > 0) {
    check(crawlability, site.sitemapProblemCount === 0);
  }

  check(aiSearch, site.llmsTxtFound);
  for (const bot of site.botAccess) {
    if (bot.group !== "ai") continue;
    check(aiSearch, bot.allowed);
  }

  /* ------------------------------------------------------- page-level -- */
  let responseTotal = 0;
  let responseCount = 0;

  const anyHreflang = pages.some((page) => page.hreflangs.length > 0);
  const contentPages = pages.filter(isContentPage).length;

  /**
   * International SEO only applies to a site that is actually international.
   * A single-market site with no hreflang has nothing to get right or wrong,
   * and scoring it would be noise.
   */
  const isInternational =
    anyHreflang || site.countriesTargeted.length > 1;

  if (isInternational && site.localeForcesRedirect !== null) {
    // Auto-redirecting by locale is the single most damaging mistake here.
    check(intlSeo, !site.localeForcesRedirect);
  }

  for (const page of pages) {
    /* -- crawlability ---------------------------------------------------- */
    check(crawlability, isOk(page));
    if (isOk(page)) {
      check(crawlability, page.redirectChain <= THRESHOLDS.maxRedirects);
      check(crawlability, !page.isNoindex);
      check(crawlability, page.canonical !== null);
      // Only meaningful once a canonical exists.
      if (page.canonical !== null) {
        check(crawlability, page.isSelfCanonical !== false);
      }
    }

    /* -- https ----------------------------------------------------------- */
    check(https, page.isHttps);
    if (page.isHttps) {
      check(https, page.mixedContentCount === 0);
      check(https, page.hasHsts);
      check(https, page.securityHeaderCount >= THRESHOLDS.minSecurityHeaders);
    }

    /* -- performance ----------------------------------------------------- */
    if (isOk(page)) {
      if (page.responseTimeMs !== null) {
        check(performance, page.responseTimeMs <= THRESHOLDS.slowResponseMs);
        responseTotal += page.responseTimeMs;
        responseCount++;
      }
      if (page.sizeBytes !== null) {
        check(performance, page.sizeBytes <= THRESHOLDS.largePageBytes);
      }
    }

    // Everything below only makes sense for a page that returned HTML.
    if (!isContentPage(page)) continue;

    /* -- internal linking ------------------------------------------------ */
    check(internalLinking, page.inlinkCount > 0 || page.isStartUrl);
    check(internalLinking, page.depth <= 3);
    check(internalLinking, page.internalLinks > 0);
    check(internalLinking, page.externalBrokenCount === 0);

    /* -- markup ---------------------------------------------------------- */
    check(markup, page.structuredDataTypes.length > 0);
    check(markup, Boolean(page.ogTitle));
    check(markup, Boolean(page.ogDescription));
    check(markup, Boolean(page.ogImage));
    check(markup, Boolean(page.twitterCard));

    /* -- international seo ----------------------------------------------- */
    if (isInternational) {
      check(intlSeo, Boolean(page.lang));
      if (page.hreflangs.length > 0) {
        check(intlSeo, page.hreflangs.includes("x-default"));
        // One check per participating page: does its hreflang cluster hold up?
        check(intlSeo, page.hreflangProblemCount === 0);
      }
    }

    /* -- ai search ------------------------------------------------------- */
    check(aiSearch, !page.isBlockedByRobots);
    check(aiSearch, page.wordCount >= THRESHOLDS.jsOnlyContentWords);
    check(aiSearch, page.semanticTagCount >= THRESHOLDS.minSemanticTags);
    check(aiSearch, page.structuredDataTypes.length > 0);
  }

  return {
    crawlability: pct(crawlability),
    https: pct(https),
    internalLinking: pct(internalLinking),
    markup: pct(markup),
    intlSeo: isInternational ? pct(intlSeo) : null,
    performance: pct(performance),
    // robots.txt and llms.txt alone would let a site whose pages all failed to
    // fetch score highly for AI readiness. Without a readable page there is
    // nothing for an assistant to read, so there is nothing to score.
    aiSearch: contentPages > 0 ? pct(aiSearch) : null,
    avgResponseMs:
      responseCount > 0 ? Math.round(responseTotal / responseCount) : null,
    classification: classifyPages(pages),
  };
}
