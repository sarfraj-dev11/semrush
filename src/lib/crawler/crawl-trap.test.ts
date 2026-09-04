import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectCrawlTraps, DEFAULT_TRAP_THRESHOLDS } from "./crawl-trap";

const kinds = (urls: string[]) =>
  detectCrawlTraps(urls).patterns.map((pattern) => pattern.kind);

describe("detectCrawlTraps", () => {
  it("finds nothing in an ordinary set of URLs", () => {
    assert.deepEqual(
      kinds([
        "https://example.com/",
        "https://example.com/about",
        "https://example.com/blog/hello",
        "https://example.com/contact?ref=nav",
      ]).filter((kind) => kind !== "session_parameter"),
      [],
    );
  });

  it("flags a path with too many distinct query strings", () => {
    const urls = Array.from(
      { length: DEFAULT_TRAP_THRESHOLDS.parameterExplosion },
      (_, i) => `https://example.com/search?q=term${i}`,
    );
    assert.ok(kinds(urls).includes("parameter_explosion"));
  });

  it("does not flag a path just under the threshold", () => {
    const urls = Array.from(
      { length: DEFAULT_TRAP_THRESHOLDS.parameterExplosion - 1 },
      (_, i) => `https://example.com/search?q=term${i}`,
    );
    assert.ok(!kinds(urls).includes("parameter_explosion"));
  });

  it("flags multiplying facet combinations", () => {
    const colors = ["red", "blue", "green", "black", "white"];
    const sizes = ["s", "m", "l", "xl"];
    const urls: string[] = [];
    for (const color of colors) {
      for (const size of sizes) {
        urls.push(
          `https://example.com/shop?color=${color}&size=${size}&sort=price&brand=acme`,
        );
      }
    }
    // 20 URLs — under the generic parameter-explosion threshold. What catches
    // this is three-plus filters co-occurring, which is the faceted shape.
    assert.equal(urls.length, 20);
    const found = kinds(urls);
    assert.ok(found.includes("facet_combination"));
    assert.ok(!found.includes("parameter_explosion"));
  });

  it("leaves a path with only one or two filters alone", () => {
    const urls = Array.from(
      { length: 22 },
      (_, i) => `https://example.com/shop?color=c${i}&size=s${i}`,
    );
    assert.ok(!kinds(urls).includes("facet_combination"));
  });

  it("flags session and tracking parameters in internal links", () => {
    const report = detectCrawlTraps([
      "https://example.com/a?PHPSESSID=abc",
      "https://example.com/b?utm_source=news",
    ]);
    const pattern = report.patterns.find(
      (entry) => entry.kind === "session_parameter",
    );
    assert.ok(pattern);
    assert.equal(pattern.urlCount, 2);
    assert.match(pattern.detail, /phpsessid|utm_source/);
  });

  it("flags a calendar once enough date URLs appear", () => {
    const urls = Array.from(
      { length: DEFAULT_TRAP_THRESHOLDS.calendar },
      (_, i) => `https://example.com/events?date=2027-${String((i % 12) + 1).padStart(2, "0")}`,
    );
    assert.ok(kinds(urls).includes("calendar"));
  });

  it("recognises /year/month/ archive paths as a calendar", () => {
    const urls = Array.from(
      { length: DEFAULT_TRAP_THRESHOLDS.calendar },
      (_, i) => `https://example.com/2027/${String((i % 12) + 1)}/post-${i}`,
    );
    assert.ok(kinds(urls).includes("calendar"));
  });

  it("flags a path that repeats a segment back to back", () => {
    assert.ok(
      kinds(["https://example.com/shop/page/shop/page/item"]).includes(
        "repeating_path",
      ),
    );
  });

  it("flags a segment appearing three or more times", () => {
    assert.ok(
      kinds(["https://example.com/a/x/a/y/a"]).includes("repeating_path"),
    );
  });

  it("leaves a legitimately repeated word alone when it appears twice", () => {
    assert.ok(
      !kinds(["https://example.com/blog/blog-post-title"]).includes(
        "repeating_path",
      ),
    );
  });

  it("flags pathologically deep URLs", () => {
    const deep = `https://example.com/${Array.from({ length: 10 }, (_, i) => `s${i}`).join("/")}`;
    assert.ok(kinds([deep]).includes("excessive_depth"));
  });

  it("counts each implicated URL once across patterns", () => {
    const report = detectCrawlTraps([
      "https://example.com/a/a/a?PHPSESSID=1",
      "https://example.com/plain",
    ]);
    assert.equal(report.affectedUrls, 1);
  });

  it("ignores URLs it cannot parse instead of throwing", () => {
    assert.doesNotThrow(() => detectCrawlTraps(["not a url", "://broken"]));
  });

  it("orders patterns by how many URLs they affect", () => {
    const urls = [
      ...Array.from({ length: 30 }, (_, i) => `https://example.com/s?q=${i}`),
      "https://example.com/a/a/a",
    ];
    const report = detectCrawlTraps(urls);
    assert.ok(report.patterns[0].urlCount >= report.patterns.at(-1)!.urlCount);
  });
});
