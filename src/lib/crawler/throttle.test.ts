import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlainTextBody } from "./fetcher";
import { analyzeSecurityHeaders } from "./security-headers";
import { detectProtection, profileForConcurrency, slower } from "./profiles";
import { HostThrottle, parseRetryAfter } from "./throttle";

describe("HostThrottle", () => {
  it("keeps requests to one host at least minIntervalMs apart", async () => {
    const throttle = new HostThrottle({
      maxConcurrentPerHost: 1,
      minIntervalMs: 60,
      jitterMs: 0,
      maxIntervalMs: 1000,
    });

    const stamps: number[] = [];
    const record = () => {
      stamps.push(Date.now());
      return Promise.resolve();
    };

    await Promise.all([
      throttle.run("https://a.test/1", record),
      throttle.run("https://a.test/2", record),
      throttle.run("https://a.test/3", record),
    ]);

    assert.equal(stamps.length, 3);
    stamps.sort((x, y) => x - y);
    // Timers overshoot rather than undershoot, so allow a small tolerance.
    assert.ok(stamps[1] - stamps[0] >= 50, `gap was ${stamps[1] - stamps[0]}ms`);
    assert.ok(stamps[2] - stamps[1] >= 50, `gap was ${stamps[2] - stamps[1]}ms`);
  });

  it("does not make one host wait behind another", async () => {
    const throttle = new HostThrottle({
      maxConcurrentPerHost: 1,
      minIntervalMs: 200,
      jitterMs: 0,
      maxIntervalMs: 1000,
    });

    const startedAt = Date.now();
    await Promise.all([
      throttle.run("https://a.test/", () => Promise.resolve()),
      throttle.run("https://b.test/", () => Promise.resolve()),
      throttle.run("https://c.test/", () => Promise.resolve()),
    ]);

    // Three different hosts should all go immediately, not serially.
    assert.ok(Date.now() - startedAt < 150);
  });

  it("respects the per-host concurrency ceiling", async () => {
    const throttle = new HostThrottle({
      maxConcurrentPerHost: 2,
      minIntervalMs: 0,
      jitterMs: 0,
      maxIntervalMs: 1000,
    });

    let active = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 8 }, () =>
        throttle.run("https://a.test/", async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 20));
          active--;
        }),
      ),
    );

    assert.ok(peak <= 2, `peak concurrency was ${peak}`);
  });

  it("slows a host down after a 429 and marks it struggling", () => {
    const throttle = new HostThrottle({
      maxConcurrentPerHost: 2,
      minIntervalMs: 100,
      jitterMs: 0,
      maxIntervalMs: 10_000,
    });

    const url = "https://a.test/";
    const before = throttle.stats();
    assert.equal(before.length, 0);

    for (let i = 0; i < 3; i++) throttle.observe(url, 429, null);

    const [state] = throttle.stats();
    assert.ok(state.intervalMs > 100, "interval should have grown");
    assert.equal(state.penalties, 3);
    assert.ok(throttle.isStruggling(url));
  });

  it("raises the floor when robots.txt asks for a crawl delay", () => {
    const throttle = new HostThrottle({
      maxConcurrentPerHost: 4,
      minIntervalMs: 100,
      jitterMs: 0,
      maxIntervalMs: 60_000,
    });

    throttle.setCrawlDelay("https://slow.test/", 5);
    throttle.observe("https://slow.test/", 200, null);

    const [state] = throttle.stats();
    assert.equal(state.intervalMs, 5000);
  });

  it("never lets a failing task wedge a host", async () => {
    const throttle = new HostThrottle({
      maxConcurrentPerHost: 1,
      minIntervalMs: 0,
      jitterMs: 0,
      maxIntervalMs: 1000,
    });

    await assert.rejects(
      throttle.run("https://a.test/", () => Promise.reject(new Error("boom"))),
    );

    // The slot must have been released despite the throw.
    await throttle.run("https://a.test/", () => Promise.resolve("ok"));
  });
});

describe("parseRetryAfter", () => {
  it("reads delta-seconds", () => {
    assert.equal(parseRetryAfter("120"), 120_000);
  });

  it("reads an HTTP date", () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    const parsed = parseRetryAfter(future);
    assert.ok(parsed !== null && parsed > 50_000 && parsed <= 60_000);
  });

  it("returns null for nonsense", () => {
    assert.equal(parseRetryAfter("soon"), null);
    assert.equal(parseRetryAfter(null), null);
  });
});

describe("crawl profiles", () => {
  it("maps a project's concurrency onto a profile", () => {
    assert.equal(profileForConcurrency(1).id, "cautious");
    assert.equal(profileForConcurrency(2).id, "polite");
    assert.equal(profileForConcurrency(4).id, "balanced");
    assert.equal(profileForConcurrency(10).id, "fast");
  });

  it("steps down one notch and stops at the floor", () => {
    assert.equal(slower(profileForConcurrency(10)).id, "balanced");
    assert.equal(slower(profileForConcurrency(1)).id, "cautious");
  });

  it("spots Cloudflare from response headers", () => {
    assert.equal(detectProtection({ "cf-ray": "abc" }), "Cloudflare");
    assert.equal(detectProtection({ server: "cloudflare" }), "Cloudflare");
    assert.equal(detectProtection({ server: "nginx" }), null);
  });
});

describe("isPlainTextBody", () => {
  it("accepts a real robots.txt", () => {
    assert.ok(
      isPlainTextBody("User-agent: *\nDisallow: /admin\n", "text/plain; charset=utf-8"),
    );
  });

  it("rejects an HTML soft-404 served with a 200", () => {
    const html = '<!DOCTYPE html><html lang="en"><head><title>Not found</title>';
    assert.ok(!isPlainTextBody(html, "text/html; charset=utf-8"));
    // Rejected on the body shape even when the content type lies.
    assert.ok(!isPlainTextBody(html, "text/plain"));
  });

  it("rejects an empty or whitespace-only body", () => {
    assert.ok(!isPlainTextBody("", "text/plain"));
    assert.ok(!isPlainTextBody("   \n ", "text/plain"));
    assert.ok(!isPlainTextBody(null, "text/plain"));
  });

  it("accepts text when the server sends no content type", () => {
    assert.ok(isPlainTextBody("# llms.txt\n\n- /docs", null));
  });
});

describe("analyzeSecurityHeaders", () => {
  it("counts present headers and names the missing ones", () => {
    const report = analyzeSecurityHeaders({
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
    });

    assert.equal(report.present, 2);
    assert.equal(report.total, 6);
    assert.ok(report.hsts);
    assert.ok(report.xContentTypeOptions);
    assert.ok(!report.contentSecurityPolicy);
    assert.ok(report.missing.includes("Content-Security-Policy"));
  });

  it("treats an empty header value as absent", () => {
    const report = analyzeSecurityHeaders({ "referrer-policy": "   " });
    assert.equal(report.present, 0);
  });
});
