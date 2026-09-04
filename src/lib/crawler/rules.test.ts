import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPage } from "./parser";
import { auditPage, auditSite, healthScore, THRESHOLDS } from "./rules";
import type { PageFacts } from "./types";

const URL = "https://example.com/page";

function html(body: string, head = "") {
  return `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`;
}

/** A page that passes every check, so each test can break exactly one thing. */
function cleanHtml(overrides: { head?: string; body?: string } = {}) {
  const words = Array.from(
    { length: THRESHOLDS.thinContentWords + 50 },
    (_, i) => `word${i}`,
  ).join(" ");

  const head =
    overrides.head ??
    `<title>A perfectly reasonable title of adequate length</title>
     <meta name="description" content="${"A description that comfortably clears the seventy character minimum for snippets.".padEnd(100, " ok")}">
     <link rel="canonical" href="${URL}">
     <meta property="og:title" content="Title">
     <meta property="og:image" content="https://example.com/i.png">
     <script type="application/ld+json">{"@type":"Article"}</script>`;

  return html(
    overrides.body ??
      `<nav>Menu</nav><main><article><h1>Heading</h1><p>${words}</p></article></main>`,
    head,
  );
}

function factsFor(source: string, overrides: Partial<PageFacts> = {}): PageFacts {
  const extracted = extractPage(source, URL);
  return {
    url: URL,
    depth: 1,
    statusCode: 200,
    contentType: "text/html",
    redirectChain: 0,
    responseTimeMs: 200,
    sizeBytes: 5000,
    fetchError: null,
    isSelfCanonical: extracted.canonical === URL,
    isHttps: true,
    hasHsts: true,
    blockedForAiBots: false,
    securityHeaderCount: 6,
    extracted,
    ...overrides,
  };
}

/** Clean head, custom body — for checks that only depend on page content. */
const cleanFactsWithBody = (body: string) => factsFor(cleanHtml({ body }));

const codesOf = (facts: PageFacts) => auditPage(facts).map((issue) => issue.code);

describe("auditPage", () => {
  it("finds nothing wrong with a clean page", () => {
    assert.deepEqual(codesOf(factsFor(cleanHtml())), []);
  });

  it("short-circuits on a fetch failure", () => {
    const codes = codesOf(
      factsFor(cleanHtml(), { fetchError: "Timed out after 20s", statusCode: null }),
    );
    assert.deepEqual(codes, ["fetch_failed"]);
  });

  it("reports 4xx and nothing else", () => {
    assert.deepEqual(codesOf(factsFor(cleanHtml(), { statusCode: 404 })), [
      "not_found",
    ]);
  });

  it("reports 5xx and nothing else", () => {
    assert.deepEqual(codesOf(factsFor(cleanHtml(), { statusCode: 503 })), [
      "server_error",
    ]);
  });

  it("flags a missing title", () => {
    const codes = codesOf(
      factsFor(cleanHtml({ head: '<link rel="canonical" href="' + URL + '">' })),
    );
    assert.ok(codes.includes("missing_title"));
  });

  it("flags a title past the length limit", () => {
    const long = "x".repeat(THRESHOLDS.titleMax + 1);
    const codes = codesOf(factsFor(cleanHtml({ head: `<title>${long}</title>` })));
    assert.ok(codes.includes("title_too_long"));
    assert.ok(!codes.includes("title_too_short"));
  });

  it("flags a title below the length floor", () => {
    const codes = codesOf(factsFor(cleanHtml({ head: "<title>Short</title>" })));
    assert.ok(codes.includes("title_too_short"));
  });

  it("flags a missing H1 and multiple H1s separately", () => {
    const none = codesOf(factsFor(cleanHtml({ body: "<p>text</p>" })));
    assert.ok(none.includes("missing_h1"));

    const many = codesOf(
      factsFor(cleanHtml({ body: "<h1>One</h1><h1>Two</h1>" })),
    );
    assert.ok(many.includes("multiple_h1"));
    assert.ok(!many.includes("missing_h1"));
  });

  it("flags a page with no canonical", () => {
    assert.ok(
      codesOf(factsFor(cleanHtml({ head: "<title>t</title>" }))).includes(
        "missing_canonical",
      ),
    );
  });

  it("flags a canonical pointing at another URL", () => {
    const source = cleanHtml({
      head: `<title>A perfectly reasonable title of adequate length</title>
             <link rel="canonical" href="https://example.com/other">`,
    });
    const codes = codesOf(factsFor(source));
    assert.ok(codes.includes("non_self_canonical"));
    assert.ok(!codes.includes("missing_canonical"));
  });

  it("detects noindex from the robots meta tag", () => {
    const source = cleanHtml({
      head: `<title>A perfectly reasonable title of adequate length</title>
             <meta name="robots" content="noindex, nofollow">`,
    });
    assert.ok(codesOf(factsFor(source)).includes("noindex"));
  });

  it("flags thin content below the word threshold", () => {
    // Comfortably above the js-only floor so the two checks stay distinct.
    const words = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    const codes = codesOf(cleanFactsWithBody(`<h1>Hi</h1><p>${words}</p>`));
    assert.ok(codes.includes("thin_content"));
    assert.ok(!codes.includes("js_only_content"));
  });

  it("reports an almost-empty 200 as JavaScript-only, not thin", () => {
    const codes = codesOf(cleanFactsWithBody("<h1>Hi</h1><div id='root'></div>"));
    assert.ok(codes.includes("js_only_content"));
    assert.ok(!codes.includes("thin_content"));
  });

  it("flags an insecure page and skips the HSTS check", () => {
    const codes = codesOf(
      factsFor(cleanHtml(), { isHttps: false, hasHsts: false }),
    );
    assert.ok(codes.includes("no_https"));
    assert.ok(!codes.includes("no_hsts"));
  });

  it("flags a secure page with no HSTS header", () => {
    const codes = codesOf(factsFor(cleanHtml(), { hasHsts: false }));
    assert.ok(codes.includes("no_hsts"));
    assert.ok(!codes.includes("no_https"));
  });

  it("flags mixed content on a secure page", () => {
    const codes = codesOf(
      cleanFactsWithBody(
        '<h1>Hi</h1><img src="http://example.com/insecure.png">',
      ),
    );
    assert.ok(codes.includes("mixed_content"));
  });

  it("flags a page robots.txt hides from AI crawlers", () => {
    const codes = codesOf(factsFor(cleanHtml(), { blockedForAiBots: true }));
    assert.ok(codes.includes("blocked_from_ai_search"));
  });

  it("flags a page with too few HTML5 landmarks", () => {
    const codes = codesOf(cleanFactsWithBody("<h1>Hi</h1><div>content</div>"));
    assert.ok(codes.includes("low_semantic_html"));
  });

  it("only asks for x-default once hreflang is in use", () => {
    assert.ok(!codesOf(factsFor(cleanHtml())).includes("hreflang_missing_x_default"));

    const withHreflang = codesOf(
      factsFor(
        cleanHtml({
          head: `<title>A perfectly reasonable title of adequate length</title>
                 <link rel="alternate" hreflang="en" href="https://example.com/en">
                 <link rel="alternate" hreflang="fr" href="https://example.com/fr">`,
        }),
      ),
    );
    assert.ok(withHreflang.includes("hreflang_missing_x_default"));
  });

  it("counts images with no alt attribute but not decorative ones", () => {
    const withAlt = extractPage(
      cleanHtml({ body: '<h1>H</h1><img src="a.png" alt="described"><img src="b.png" alt="">' }),
      URL,
    );
    assert.equal(withAlt.imagesMissingAlt, 0);

    const missing = extractPage(
      cleanHtml({ body: '<h1>H</h1><img src="a.png">' }),
      URL,
    );
    assert.equal(missing.imagesMissingAlt, 1);
  });

  it("flags a slow response", () => {
    const codes = codesOf(
      factsFor(cleanHtml(), { responseTimeMs: THRESHOLDS.slowResponseMs + 1 }),
    );
    assert.ok(codes.includes("slow_response"));
  });

  it("flags a redirect chain but not a single redirect", () => {
    assert.ok(
      !codesOf(factsFor(cleanHtml(), { redirectChain: 1 })).includes(
        "redirect_chain",
      ),
    );
    assert.ok(
      codesOf(factsFor(cleanHtml(), { redirectChain: 2 })).includes(
        "redirect_chain",
      ),
    );
  });

  it("checks nothing beyond transport for non-HTML responses", () => {
    const codes = codesOf(
      factsFor(cleanHtml(), {
        extracted: null,
        contentType: "application/pdf",
        responseTimeMs: 100,
      }),
    );
    assert.deepEqual(codes, []);
  });
});

describe("extractPage", () => {
  it("detects a broken heading order", () => {
    const skipped = extractPage(html("<h2>A</h2><h4>B</h4>"), URL);
    assert.equal(skipped.headingOrderBroken, true);

    const ordered = extractPage(html("<h1>A</h1><h2>B</h2><h3>C</h3>"), URL);
    assert.equal(ordered.headingOrderBroken, false);
  });

  it("resolves relative links against the page URL and marks externals", () => {
    const page = extractPage(
      html('<a href="/about">About</a><a href="https://other.com/x">Out</a>'),
      URL,
    );
    assert.deepEqual(
      page.links.map((link) => [link.url, link.isInternal]),
      [
        ["https://example.com/about", true],
        ["https://other.com/x", false],
      ],
    );
  });

  it("honours a <base> tag when resolving links", () => {
    const page = extractPage(
      html('<a href="deep">Deep</a>', '<base href="https://example.com/docs/">'),
      URL,
    );
    assert.equal(page.links[0].url, "https://example.com/docs/deep");
  });

  it("strips fragments so one page is not counted twice", () => {
    const page = extractPage(
      html('<a href="/a#one">One</a><a href="/a#two">Two</a>'),
      URL,
    );
    assert.equal(page.links.length, 1);
  });

  it("collects structured data types including @graph entries", () => {
    const page = extractPage(
      html(
        "",
        '<script type="application/ld+json">{"@graph":[{"@type":"Organization"},{"@type":"WebSite"}]}</script>',
      ),
      URL,
    );
    assert.deepEqual(page.structuredDataTypes.sort(), ["Organization", "WebSite"]);
  });

  it("survives malformed JSON-LD", () => {
    const page = extractPage(
      html("", '<script type="application/ld+json">{ not json </script>'),
      URL,
    );
    assert.deepEqual(page.structuredDataTypes, []);
  });

  it("ignores script and style text in the word count", () => {
    const page = extractPage(
      html("<p>one two three</p><script>const a = 1;</script><style>.x{}</style>"),
      URL,
    );
    assert.equal(page.wordCount, 3);
  });
});

describe("auditSite", () => {
  const page = (over: Partial<Parameters<typeof auditSite>[0][number]>) => ({
    url: "https://example.com/a",
    statusCode: 200,
    title: "Title",
    metaDescription: "Description",
    inlinkCount: 1,
    isStartUrl: false,
    ...over,
  });

  const hasCode = (
    result: ReturnType<typeof auditSite>,
    url: string,
    code: string,
  ) => Boolean(result.get(url)?.some((issue) => issue.code === code));

  it("flags every page sharing a title", () => {
    const result = auditSite(
      [
        page({ url: "https://example.com/a", title: "Same", metaDescription: "A" }),
        page({ url: "https://example.com/b", title: "Same", metaDescription: "B" }),
        page({
          url: "https://example.com/c",
          title: "Different",
          metaDescription: "C",
        }),
      ],
      [],
    );

    assert.ok(hasCode(result, "https://example.com/a", "duplicate_title"));
    assert.ok(hasCode(result, "https://example.com/b", "duplicate_title"));
    assert.ok(!hasCode(result, "https://example.com/c", "duplicate_title"));
  });

  it("does not count broken pages toward duplication", () => {
    const result = auditSite(
      [
        page({ url: "https://example.com/a", title: "Same" }),
        page({ url: "https://example.com/b", title: "Same", statusCode: 404 }),
      ],
      [],
    );
    assert.equal(result.get("https://example.com/a"), undefined);
  });

  it("flags orphans but never the start URL", () => {
    const result = auditSite(
      [
        page({
          url: "https://example.com/",
          title: "Home",
          metaDescription: "Home page",
          inlinkCount: 0,
          isStartUrl: true,
        }),
        page({
          url: "https://example.com/lost",
          title: "Lost",
          metaDescription: "Lost page",
          inlinkCount: 0,
        }),
      ],
      [],
    );

    assert.ok(!hasCode(result, "https://example.com/", "orphan_page"));
    assert.ok(hasCode(result, "https://example.com/lost", "orphan_page"));
  });

  it("blames the linking page for a broken target", () => {
    const result = auditSite(
      [
        page({ url: "https://example.com/from" }),
        page({ url: "https://example.com/gone", statusCode: 404 }),
      ],
      [
        {
          fromUrl: "https://example.com/from",
          toUrl: "https://example.com/gone",
        },
      ],
    );

    const issue = result
      .get("https://example.com/from")
      ?.find((i) => i.code === "broken_internal_link");
    assert.ok(issue);
    assert.equal(issue.detail, "https://example.com/gone");
  });
});

describe("healthScore", () => {
  it("is 100 with no issues and no pages", () => {
    assert.equal(healthScore({ critical: 0, warning: 0, notice: 0 }, 0), 100);
    assert.equal(healthScore({ critical: 0, warning: 0, notice: 0 }, 50), 100);
  });

  it("does not penalise a large site more than a small one", () => {
    const small = healthScore({ critical: 1, warning: 2, notice: 4 }, 10);
    const large = healthScore({ critical: 10, warning: 20, notice: 40 }, 100);
    assert.equal(small, large);
  });

  it("bottoms out at zero rather than going negative", () => {
    assert.equal(healthScore({ critical: 100, warning: 0, notice: 0 }, 1), 0);
  });

  it("weighs critical issues above notices", () => {
    const critical = healthScore({ critical: 3, warning: 0, notice: 0 }, 10);
    const notices = healthScore({ critical: 0, warning: 0, notice: 3 }, 10);
    assert.ok(critical < notices);
  });
});
