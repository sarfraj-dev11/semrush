import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeCacheHeaders, cacheIssues } from "./cache-headers";

const codesFor = (headers: Record<string, string>) =>
  cacheIssues(analyzeCacheHeaders(headers)).map((issue) => issue.code);

describe("analyzeCacheHeaders", () => {
  it("reads max-age and revalidation tokens", () => {
    const report = analyzeCacheHeaders({
      "cache-control": "public, max-age=3600",
      etag: 'W/"abc"',
    });

    assert.equal(report.maxAgeSeconds, 3600);
    assert.equal(report.hasEtag, true);
    assert.equal(report.publiclyCacheable, true);
    assert.equal(report.revalidatable, true);
  });

  it("prefers s-maxage, which is what a shared cache actually honours", () => {
    const report = analyzeCacheHeaders({
      "cache-control": "max-age=60, s-maxage=86400",
    });
    assert.equal(report.maxAgeSeconds, 86400);
  });

  it("does not mistake max-age inside s-maxage for its own directive", () => {
    const report = analyzeCacheHeaders({ "cache-control": "s-maxage=99" });
    assert.equal(report.maxAgeSeconds, 99);
  });

  it("treats private and no-store as not publicly cacheable", () => {
    assert.equal(
      analyzeCacheHeaders({ "cache-control": "private, max-age=600" })
        .publiclyCacheable,
      false,
    );
    assert.equal(
      analyzeCacheHeaders({ "cache-control": "no-store" }).publiclyCacheable,
      false,
    );
  });

  it("parses Vary into a list and flags User-Agent", () => {
    const report = analyzeCacheHeaders({
      vary: "Accept-Encoding, User-Agent",
    });
    assert.deepEqual(report.varyOn, ["accept-encoding", "user-agent"]);
    assert.equal(report.variesOnUserAgent, true);
  });

  it("identifies a CDN from its own header", () => {
    assert.equal(analyzeCacheHeaders({ "cf-ray": "abc" }).cdn, "Cloudflare");
    assert.equal(analyzeCacheHeaders({ "x-vercel-id": "iad1" }).cdn, "Vercel");
    assert.equal(
      analyzeCacheHeaders({ via: "1.1 varnish" }).cdn,
      "Varnish",
    );
    assert.equal(analyzeCacheHeaders({ server: "nginx" }).cdn, null);
  });

  it("reads a hit/miss verdict from whichever header carries it", () => {
    assert.equal(analyzeCacheHeaders({ "cf-cache-status": "HIT" }).cdnHit, true);
    assert.equal(analyzeCacheHeaders({ "x-cache": "Miss from cloudfront" }).cdnHit, false);
    assert.equal(analyzeCacheHeaders({}).cdnHit, null);
  });
});

describe("cacheIssues", () => {
  it("is silent on a well-configured response", () => {
    assert.deepEqual(
      codesFor({ "cache-control": "public, max-age=3600", etag: 'W/"x"' }),
      [],
    );
  });

  it("flags a response with no policy and no revalidation token", () => {
    assert.deepEqual(codesFor({}), ["no_cache_policy"]);
  });

  it("stops after no-store, since the rest is moot", () => {
    assert.deepEqual(codesFor({ "cache-control": "no-store" }), [
      "cache_no_store",
    ]);
  });

  it("still reports Vary: User-Agent alongside no-store", () => {
    const codes = codesFor({ "cache-control": "no-store", vary: "User-Agent" });
    assert.deepEqual(codes, ["vary_user_agent", "cache_no_store"]);
  });

  it("flags a cacheable response with nothing to revalidate against", () => {
    assert.deepEqual(codesFor({ "cache-control": "public, max-age=600" }), [
      "no_revalidation_token",
    ]);
  });

  it("accepts Last-Modified as a revalidation token", () => {
    assert.deepEqual(
      codesFor({
        "cache-control": "public, max-age=600",
        "last-modified": "Wed, 21 Oct 2026 07:28:00 GMT",
      }),
      [],
    );
  });
});
