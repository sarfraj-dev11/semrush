import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BotAccess } from "@/db/schema";
import { classifyPages, computeScores, type ScorablePage, type ScorableSite } from "./scores";

function page(overrides: Partial<ScorablePage> = {}): ScorablePage {
  return {
    url: "https://example.com/",
    isStartUrl: false,
    isHtml: true,
    statusCode: 200,
    fetchError: null,
    redirectChain: 0,
    depth: 1,
    isNoindex: false,
    canonical: "https://example.com/",
    isSelfCanonical: true,
    isHttps: true,
    hasHsts: true,
    mixedContentCount: 0,
    securityHeaderCount: 6,
    structuredDataTypes: ["Article"],
    ogTitle: "t",
    ogDescription: "d",
    ogImage: "i",
    twitterCard: "summary",
    lang: "en",
    hreflangs: [],
    hreflangProblemCount: 0,
    wordCount: 800,
    semanticTagCount: 4,
    inlinkCount: 3,
    internalLinks: 10,
    externalBrokenCount: 0,
    isBlockedByRobots: false,
    responseTimeMs: 200,
    sizeBytes: 20_000,
    issueCount: 0,
    ...overrides,
  };
}

const bots = (allowed: boolean): BotAccess[] => [
  { bot: "GPTBot", label: "GPTBot", group: "ai", allowed, blockedSample: [] },
  { bot: "Googlebot", label: "Googlebot", group: "search", allowed: true, blockedSample: [] },
];

function site(overrides: Partial<ScorableSite> = {}): ScorableSite {
  return {
    robotsTxtFound: true,
    llmsTxtFound: true,
    botAccess: bots(true),
    sitemapUrlCount: 10,
    sitemapProblemCount: 0,
    countriesTargeted: [],
    localeForcesRedirect: false,
    ...overrides,
  };
}

describe("computeScores", () => {
  it("gives a flawless site 100 across the board", () => {
    const scores = computeScores([page(), page()], site());

    assert.equal(scores.crawlability, 100);
    assert.equal(scores.https, 100);
    assert.equal(scores.internalLinking, 100);
    assert.equal(scores.markup, 100);
    assert.equal(scores.performance, 100);
    assert.equal(scores.aiSearch, 100);
  });

  it("reports international SEO as null, not zero, when hreflang is unused", () => {
    const scores = computeScores([page()], site());
    assert.equal(scores.intlSeo, null);
  });

  it("scores international SEO once hreflang exists", () => {
    const scores = computeScores(
      [page({ hreflangs: ["en", "fr"] }), page({ hreflangs: ["en", "x-default"] })],
      site(),
    );
    // Seven checks: no forced redirect, plus lang + x-default + clean graph
    // per page. Only the first page's missing x-default fails.
    assert.equal(scores.intlSeo, 86);
  });

  it("counts a forced locale redirect against international SEO", () => {
    const clean = computeScores([page({ hreflangs: ["en", "x-default"] })], site());
    const forced = computeScores(
      [page({ hreflangs: ["en", "x-default"] })],
      site({ localeForcesRedirect: true }),
    );

    assert.ok(
      forced.intlSeo !== null &&
        clean.intlSeo !== null &&
        forced.intlSeo < clean.intlSeo,
    );
  });

  it("scores international SEO for a multi-country site with no hreflang", () => {
    const scores = computeScores([page()], site({ countriesTargeted: ["GB", "DE"] }));
    assert.ok(scores.intlSeo !== null);
  });

  it("counts a broken hreflang cluster against the score", () => {
    const scores = computeScores(
      [page({ hreflangs: ["en", "x-default"], hreflangProblemCount: 2 })],
      site(),
    );
    assert.ok(scores.intlSeo !== null && scores.intlSeo < 100);
  });

  it("drops the HTTPS score when a page is insecure", () => {
    const scores = computeScores(
      [page(), page({ isHttps: false, hasHsts: false })],
      site(),
    );
    assert.ok(scores.https !== null && scores.https < 100);
  });

  it("counts a blocked AI crawler against AI search health", () => {
    const allowed = computeScores([page()], site());
    const blocked = computeScores([page()], site({ botAccess: bots(false) }));

    assert.ok(
      blocked.aiSearch !== null &&
        allowed.aiSearch !== null &&
        blocked.aiSearch < allowed.aiSearch,
    );
  });

  it("reports AI search as unmeasurable when no page could be read", () => {
    const scores = computeScores(
      [page({ statusCode: null, fetchError: "fetch failed" })],
      site(),
    );
    // robots.txt and llms.txt passing must not imply a readable site.
    assert.equal(scores.aiSearch, null);
    assert.equal(scores.markup, null);
    assert.equal(scores.internalLinking, null);
  });

  it("counts a missing llms.txt against AI search health", () => {
    const withFile = computeScores([page()], site());
    const without = computeScores([page()], site({ llmsTxtFound: false }));

    assert.ok(
      without.aiSearch !== null &&
        withFile.aiSearch !== null &&
        without.aiSearch < withFile.aiSearch,
    );
  });

  it("penalises crawlability for an inaccurate sitemap", () => {
    const clean = computeScores([page()], site());
    const dirty = computeScores([page()], site({ sitemapProblemCount: 4 }));

    assert.ok(
      dirty.crawlability !== null &&
        clean.crawlability !== null &&
        dirty.crawlability < clean.crawlability,
    );
  });

  it("ignores sitemap accuracy when there is no sitemap", () => {
    const scores = computeScores(
      [page()],
      site({ sitemapUrlCount: 0, sitemapProblemCount: 0 }),
    );
    assert.equal(scores.crawlability, 100);
  });

  it("skips markup checks for non-HTML responses", () => {
    const scores = computeScores(
      [page(), page({ isHtml: false, structuredDataTypes: [], ogTitle: null })],
      site(),
    );
    assert.equal(scores.markup, 100);
  });

  it("averages response time across fetched pages only", () => {
    const scores = computeScores(
      [page({ responseTimeMs: 100 }), page({ responseTimeMs: 300 })],
      site(),
    );
    assert.equal(scores.avgResponseMs, 200);
  });
});

describe("classifyPages", () => {
  it("sorts pages into one bucket each, worst first", () => {
    const result = classifyPages([
      page({ statusCode: 404 }),
      page({ fetchError: "Timed out" }),
      page({ redirectChain: 1 }),
      page({ isNoindex: true }),
      page({ isBlockedByRobots: true }),
      page({ issueCount: 3 }),
      page(),
    ]);

    assert.deepEqual(result, {
      broken: 2,
      redirects: 1,
      blocked: 2,
      withIssues: 1,
      healthy: 1,
    });
  });

  it("counts a broken page as broken even when it also redirects", () => {
    const result = classifyPages([page({ statusCode: 500, redirectChain: 2 })]);
    assert.equal(result.broken, 1);
    assert.equal(result.redirects, 0);
  });
});
