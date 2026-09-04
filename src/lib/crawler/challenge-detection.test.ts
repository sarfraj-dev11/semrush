import assert from "node:assert/strict";
import { describe, it } from "node:test";
import robotsParser from "robots-parser";
import {
  ChallengeTracker,
  detectChallenge,
  type ChallengeVerdict,
} from "./challenge-detection";
import { assessRobotsImpact } from "./robots-impact";
import { findDomainPosition, toHostname } from "@/lib/search/types";

const verdict = (input: Parameters<typeof detectChallenge>[0]) =>
  detectChallenge(input);

describe("detectChallenge", () => {
  it("recognises a Cloudflare interstitial", () => {
    const result = verdict({
      statusCode: 403,
      headers: {},
      html: "<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>",
      wordCount: 6,
    });

    assert.ok(result.challenged);
    assert.equal(result.type, "cloudflare");
    assert.ok(result.remedy?.includes("Cloudflare"));
  });

  it("recognises a challenge from headers alone", () => {
    const result = verdict({
      statusCode: 200,
      headers: { "x-datadome": "protected" },
      html: null,
    });

    assert.ok(result.challenged);
    assert.equal(result.type, "datadome");
  });

  it("treats 429 as a rate limit and says to slow down, not switch IP", () => {
    const result = verdict({ statusCode: 429, headers: {}, html: null });

    assert.equal(result.type, "rate_limit");
    assert.ok(/fewer requests/i.test(result.remedy ?? ""));
    // The remedy must point at slowing down, and explicitly rule out the
    // "just switch IP" reading rather than leaving it open.
    assert.ok(/not a different IP/i.test(result.remedy ?? ""));
  });

  it("does NOT flag a healthy page that merely embeds a reCAPTCHA", () => {
    // A contact form on a real, content-bearing page is not a challenge.
    const result = verdict({
      statusCode: 200,
      headers: {},
      html: '<html><body><form><div class="g-recaptcha"></div></form></body></html>',
      wordCount: 900,
    });

    assert.equal(result.challenged, false);
  });

  it("does flag a near-empty page carrying a captcha widget", () => {
    const result = verdict({
      statusCode: 403,
      headers: {},
      html: '<html><body><div class="h-captcha"></div></body></html>',
      wordCount: 2,
    });

    assert.ok(result.challenged);
    assert.equal(result.type, "hcaptcha");
  });

  it("flags a bare 403 with no content as a block of unknown origin", () => {
    const result = verdict({
      statusCode: 403,
      headers: {},
      html: "<html><body>Forbidden</body></html>",
      wordCount: 1,
    });

    assert.ok(result.challenged);
    assert.equal(result.type, "login_wall");
  });

  it("leaves an ordinary page alone", () => {
    const result = verdict({
      statusCode: 200,
      headers: { server: "nginx" },
      html: "<html><body><h1>Hello</h1></body></html>",
      wordCount: 500,
    });

    assert.equal(result.challenged, false);
    assert.equal(result.type, null);
  });
});

describe("ChallengeTracker", () => {
  const challenge = (type: ChallengeVerdict["type"]): ChallengeVerdict => ({
    challenged: true,
    type,
    evidence: "test",
    remedy: "Allowlist the crawler.",
  });

  it("stops the crawl once the threshold is reached", () => {
    const tracker = new ChallengeTracker(3);
    assert.equal(tracker.shouldStop, false);

    tracker.record(challenge("cloudflare"));
    tracker.record(challenge("cloudflare"));
    assert.equal(tracker.shouldStop, false);

    tracker.record(challenge("cloudflare"));
    assert.ok(tracker.shouldStop);
  });

  it("ignores non-challenges", () => {
    const tracker = new ChallengeTracker(2);
    tracker.record({ challenged: false, type: null, evidence: null, remedy: null });
    assert.equal(tracker.count, 0);
  });

  it("summarises what blocked us and what to do", () => {
    const tracker = new ChallengeTracker();
    tracker.record(challenge("cloudflare"));
    tracker.record(challenge("recaptcha"));

    const summary = tracker.summary();
    assert.ok(summary?.includes("cloudflare"));
    assert.ok(summary?.includes("Allowlist"));
  });

  it("has no summary when nothing was challenged", () => {
    assert.equal(new ChallengeTracker().summary(), null);
  });
});

describe("assessRobotsImpact", () => {
  const ROBOTS_URL = "https://example.com/robots.txt";

  it("counts what each bot is blocked from and how to fix it", () => {
    const robots = robotsParser(
      ROBOTS_URL,
      ["User-agent: GPTBot", "Disallow: /blog/", "", "User-agent: *", "Allow: /"].join("\n"),
    );

    const impact = assessRobotsImpact(
      robots,
      [
        "https://example.com/",
        "https://example.com/blog/one",
        "https://example.com/blog/two",
      ],
      "SEOConsoleBot",
    );

    const gptbot = impact.byBot.find((entry) => entry.bot === "GPTBot");
    assert.equal(gptbot?.blocked, 2);
    assert.equal(impact.skipped.length, 2);
    assert.ok(impact.recommendations.some((line) => line.includes("GPTBot")));
  });

  it("raises the alarm when a search engine is blocked", () => {
    const robots = robotsParser(
      ROBOTS_URL,
      ["User-agent: Googlebot", "Disallow: /products/"].join("\n"),
    );

    const impact = assessRobotsImpact(
      robots,
      ["https://example.com/products/a", "https://example.com/about"],
      "SEOConsoleBot",
    );

    assert.ok(impact.blocksSearchEngines);
    assert.ok(
      impact.recommendations.some((line) => /should rank|Disallow/.test(line)),
    );
  });

  it("reports nothing for a permissive robots.txt", () => {
    const robots = robotsParser(ROBOTS_URL, "User-agent: *\nAllow: /");
    const impact = assessRobotsImpact(robots, ["https://example.com/"], "SEOConsoleBot");

    assert.equal(impact.skipped.length, 0);
    assert.equal(impact.blocksSearchEngines, false);
    assert.deepEqual(impact.recommendations, []);
  });

  it("reports nothing when there is no robots.txt", () => {
    const impact = assessRobotsImpact(null, ["https://example.com/"], "SEOConsoleBot");
    assert.deepEqual(impact.skipped, []);
  });
});

describe("findDomainPosition", () => {
  const results = [
    { position: 1, url: "https://other.com/a", title: null, description: null, displayUrl: null },
    { position: 2, url: "https://www.example.com/page", title: null, description: null, displayUrl: null },
    { position: 3, url: "https://blog.example.com/x", title: null, description: null, displayUrl: null },
  ];

  it("finds the domain ignoring www", () => {
    const match = findDomainPosition(results, "https://example.com");
    assert.equal(match?.position, 2);
  });

  it("matches subdomains of the target", () => {
    const match = findDomainPosition(
      [results[0], results[2]],
      "example.com",
    );
    assert.equal(match?.position, 3);
  });

  it("returns null when absent, never position zero", () => {
    // null and 0 mean different things in keyword_rankings; 0 would be a lie.
    assert.equal(findDomainPosition(results, "missing.com"), null);
  });

  it("matches a domain stored with a trailing slash", () => {
    // Regression: a regex-stripped "https://example.com/" kept the slash and
    // matched nothing, so every keyword reported as not ranking.
    assert.equal(findDomainPosition(results, "https://example.com/")?.position, 2);
  });

  it("matches a domain stored with a port", () => {
    const local = [
      { position: 4, url: "http://localhost:3000/site-audit", title: null, description: null, displayUrl: null },
    ];
    assert.equal(findDomainPosition(local, "http://localhost:3000")?.position, 4);
  });

  it("matches a domain stored with a path", () => {
    assert.equal(
      findDomainPosition(results, "https://example.com/some/path")?.position,
      2,
    );
  });

  it("matches a bare domain with no protocol", () => {
    assert.equal(findDomainPosition(results, "example.com")?.position, 2);
  });

  it("does not match a domain that merely ends with the target", () => {
    const tricky = [
      { position: 1, url: "https://notexample.com/", title: null, description: null, displayUrl: null },
    ];
    assert.equal(findDomainPosition(tricky, "example.com"), null);
  });
});

describe("toHostname", () => {
  it("reduces every shape to a bare hostname", () => {
    for (const input of [
      "https://example.com",
      "https://example.com/",
      "https://www.example.com/path?q=1",
      "http://example.com:8080/x",
      "example.com",
    ]) {
      assert.equal(toHostname(input), "example.com", `failed for ${input}`);
    }
  });

  it("returns null for nonsense", () => {
    assert.equal(toHostname(""), null);
    assert.equal(toHostname("   "), null);
  });
});
