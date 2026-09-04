import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_COUNTRIES } from "@/lib/countries";
import {
  detectGeoSignals,
  summarizeCoverage,
  type GeoSignals,
} from "./geo-targeting";
import { auditHreflang, parseHreflang, type HreflangPage } from "./hreflang-audit";
import { probeLocales } from "./locale-probe";

const REGIONS = new Set(
  ALL_COUNTRIES.map((c) => c.code).filter((code) => code !== "WW"),
);

function hpage(
  url: string,
  links: [code: string, href: string][],
  overrides: Partial<HreflangPage> = {},
): HreflangPage {
  return {
    url,
    links: links.map(([code, href]) => ({ code, href })),
    canonical: url,
    statusCode: 200,
    isNoindex: false,
    ...overrides,
  };
}

const codesOf = (pages: HreflangPage[]) =>
  auditHreflang(pages, REGIONS).problems.map((p) => p.code);

describe("parseHreflang", () => {
  it("splits language and region", () => {
    assert.deepEqual(parseHreflang("en-GB"), { language: "en", region: "GB" });
    assert.deepEqual(parseHreflang("fr"), { language: "fr", region: null });
    assert.deepEqual(parseHreflang("x-default"), {
      language: "x-default",
      region: null,
    });
  });

  it("rejects malformed values", () => {
    assert.equal(parseHreflang("english"), null);
    assert.equal(parseHreflang("en_GB"), null);
    assert.equal(parseHreflang(""), null);
  });
});

describe("auditHreflang", () => {
  const EN = "https://example.com/en";
  const FR = "https://example.com/fr";

  it("passes a correctly reciprocal pair", () => {
    const problems = codesOf([
      hpage(EN, [
        ["en", EN],
        ["fr", FR],
        ["x-default", EN],
      ]),
      hpage(FR, [
        ["en", EN],
        ["fr", FR],
        ["x-default", EN],
      ]),
    ]);
    assert.deepEqual(problems, []);
  });

  it("catches a missing return link", () => {
    const problems = codesOf([
      hpage(EN, [
        ["en", EN],
        ["fr", FR],
      ]),
      // FR never mentions EN.
      hpage(FR, [["fr", FR]]),
    ]);
    assert.ok(problems.includes("hreflang_no_return_link"));
  });

  it("catches a page that omits its own self-reference", () => {
    const problems = codesOf([hpage(EN, [["fr", FR]]), hpage(FR, [["fr", FR]])]);
    assert.ok(problems.includes("hreflang_missing_self"));
  });

  it("rejects a country code used as a language", () => {
    // "uk" is Ukrainian, not the United Kingdom — the classic hreflang bug.
    const problems = codesOf([hpage(EN, [["en-uk", EN]])]);
    assert.ok(problems.includes("hreflang_invalid_code"));
  });

  it("accepts en-GB, the correct form", () => {
    const report = auditHreflang([hpage(EN, [["en-GB", EN]])], REGIONS);
    assert.ok(!report.problems.some((p) => p.code === "hreflang_invalid_code"));
    assert.deepEqual(report.regions, ["GB"]);
  });

  it("flags an alternate that returns an error", () => {
    const problems = codesOf([
      hpage(EN, [
        ["en", EN],
        ["fr", FR],
      ]),
      hpage(FR, [["fr", FR]], { statusCode: 404 }),
    ]);
    assert.ok(problems.includes("hreflang_broken_target"));
  });

  it("flags an alternate that is noindex", () => {
    const problems = codesOf([
      hpage(EN, [
        ["en", EN],
        ["fr", FR],
      ]),
      hpage(FR, [["fr", FR]], { isNoindex: true }),
    ]);
    assert.ok(problems.includes("hreflang_broken_target"));
  });

  it("flags an alternate that canonicalises elsewhere", () => {
    const problems = codesOf([
      hpage(EN, [
        ["en", EN],
        ["fr", FR],
      ]),
      hpage(FR, [
        ["en", EN],
        ["fr", FR],
      ], { canonical: EN }),
    ]);
    assert.ok(problems.includes("hreflang_conflicts_canonical"));
  });

  it("flags a duplicated declaration", () => {
    const problems = codesOf([
      hpage(EN, [
        ["en", EN],
        ["en", FR],
      ]),
    ]);
    assert.ok(problems.includes("hreflang_duplicate"));
  });

  it("ignores pages with no hreflang at all", () => {
    const report = auditHreflang([hpage(EN, [])], REGIONS);
    assert.deepEqual(report.problems, []);
    assert.equal(report.participating, 0);
  });
});

describe("detectGeoSignals", () => {
  const empty = { geoRegion: null, schemaCountries: [], currencies: [] };

  it("reads a country ccTLD", () => {
    assert.equal(detectGeoSignals("https://shop.de/", empty, REGIONS).ccTld, "DE");
  });

  it("maps .uk to GB", () => {
    assert.equal(detectGeoSignals("https://shop.co.uk/", empty, REGIONS).ccTld, "GB");
  });

  it("does not treat generic ccTLDs as country targeting", () => {
    assert.equal(detectGeoSignals("https://app.io/", empty, REGIONS).ccTld, null);
    assert.equal(detectGeoSignals("https://brand.co/", empty, REGIONS).ccTld, null);
  });

  it("reads a locale from the URL path and subdomain", () => {
    const path = detectGeoSignals("https://example.com/fr-ca/pricing", empty, REGIONS);
    assert.equal(path.pathLocale, "fr-ca");

    const sub = detectGeoSignals("https://de.example.com/", empty, REGIONS);
    assert.equal(sub.subdomainLocale, "de");
  });

  it("ignores www as a locale subdomain", () => {
    const signals = detectGeoSignals("https://www.example.com/", empty, REGIONS);
    assert.equal(signals.subdomainLocale, null);
  });
});

describe("probeLocales", () => {
  const URL_UNDER_TEST = "https://example.com/";
  const LOCALES = [
    { acceptLanguage: "en-US,en;q=0.9", label: "United States" },
    { acceptLanguage: "de-DE,de;q=0.9", label: "Germany" },
  ];

  /** Swaps global fetch for a stub, restoring it afterwards. */
  async function withFetch(
    handler: (acceptLanguage: string) => { status: number; location?: string },
    run: () => Promise<void>,
  ) {
    const original = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const { status, location } = handler(headers["Accept-Language"] ?? "");
      return new Response(null, {
        status,
        headers: location ? { location } : {},
      });
    }) as typeof fetch;

    try {
      await run();
    } finally {
      globalThis.fetch = original;
    }
  }

  it("does not flag a plain redirect that every locale shares", async () => {
    // The classic false positive: "/" → "/home" for everyone is not geo logic.
    await withFetch(
      () => ({ status: 307, location: "https://example.com/home" }),
      async () => {
        const report = await probeLocales(URL_UNDER_TEST, { locales: LOCALES });
        assert.equal(report.forcesRedirect, false);
        assert.deepEqual(report.destinations, []);
      },
    );
  });

  it("flags a redirect that differs by locale", async () => {
    await withFetch(
      (lang) =>
        lang.startsWith("de")
          ? { status: 302, location: "https://example.com/de/" }
          : { status: 200 },
      async () => {
        const report = await probeLocales(URL_UNDER_TEST, { locales: LOCALES });
        assert.equal(report.forcesRedirect, true);
        assert.deepEqual(report.destinations, ["https://example.com/de/"]);
      },
    );
  });

  it("does not flag a site that serves everyone the same page", async () => {
    await withFetch(
      () => ({ status: 200 }),
      async () => {
        const report = await probeLocales(URL_UNDER_TEST, { locales: LOCALES });
        assert.equal(report.forcesRedirect, false);
        assert.equal(report.probes.length, 2);
      },
    );
  });
});

describe("summarizeCoverage", () => {
  const base: GeoSignals = {
    ccTld: null,
    pathLocale: null,
    subdomainLocale: null,
    geoRegion: null,
    schemaCountries: [],
    currencies: [],
  };

  it("merges every signal into one country list with its sources", () => {
    const coverage = summarizeCoverage(
      [
        { ...base, ccTld: "DE" },
        { ...base, pathLocale: "fr-fr" },
        { ...base, schemaCountries: ["US"] },
      ],
      ["GB"],
      REGIONS,
    );

    assert.deepEqual(coverage.countries, ["DE", "FR", "GB", "US"]);
    assert.deepEqual(coverage.sources.DE, ["ccTLD"]);
    assert.deepEqual(coverage.sources.GB, ["hreflang"]);
    assert.ok(!coverage.isSingleMarket);
  });

  it("calls a site with one or no country signal single-market", () => {
    assert.ok(summarizeCoverage([base], [], REGIONS).isSingleMarket);
    assert.ok(summarizeCoverage([{ ...base, ccTld: "DE" }], [], REGIONS).isSingleMarket);
  });

  it("discards codes that are not real countries", () => {
    const coverage = summarizeCoverage(
      [{ ...base, schemaCountries: ["ZZ", "XX"] }],
      [],
      REGIONS,
    );
    assert.deepEqual(coverage.countries, []);
  });
});
