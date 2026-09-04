/**
 * Geo-targeting detection.
 *
 * A site tells search engines which country it is for in several places at
 * once, and they routinely disagree — a .de domain serving English with USD
 * prices and an hreflang saying en-US is a real thing that happens. This
 * gathers every signal so the disagreement is visible instead of implied.
 *
 * Pure: no requests, everything comes from what the crawl already read.
 */

/**
 * ccTLDs that Google treats as generic rather than country-targeted. A .io or
 * .co domain says nothing about geography, so counting them as a country signal
 * would invent targeting that does not exist.
 */
const GENERIC_CCTLDS = new Set([
  "io", "co", "ai", "me", "tv", "cc", "fm", "am", "ly", "sh", "to", "gg", "im",
  "la", "ws", "nu", "ms", "st", "vc",
]);

/** ccTLDs whose country differs from the literal two letters. */
const CCTLD_OVERRIDES: Record<string, string> = { uk: "GB" };

export type GeoSignals = {
  /** Country implied by the domain suffix, or null for gTLDs. */
  ccTld: string | null;
  /** Locale segment in the path, e.g. /de/ or /en-gb/. */
  pathLocale: string | null;
  /** Locale in the subdomain, e.g. de.example.com. */
  subdomainLocale: string | null;
  geoRegion: string | null;
  schemaCountries: string[];
  currencies: string[];
};

export type GeoCoverage = {
  /** Every country code the site signals, however it signals it. */
  countries: string[];
  /** How each country was detected, for explaining the result. */
  sources: Record<string, string[]>;
  /** True when the site shows no country targeting at all. */
  isSingleMarket: boolean;
};

function localeToCountry(locale: string, validRegions: Set<string>): string | null {
  const region = locale.split("-")[1]?.toUpperCase();
  if (region && validRegions.has(region)) return region;

  // A bare "/de/" is a language segment; treat it as its country only when the
  // two letters are also a real country code, which is the common convention.
  const bare = locale.toUpperCase();
  return validRegions.has(bare) ? bare : null;
}

export function detectGeoSignals(
  url: string,
  page: {
    geoRegion: string | null;
    schemaCountries: string[];
    currencies: string[];
  },
  validRegions: Set<string>,
): GeoSignals {
  let ccTld: string | null = null;
  let pathLocale: string | null = null;
  let subdomainLocale: string | null = null;

  try {
    const parsed = new URL(url);
    const hostParts = parsed.hostname.toLowerCase().split(".");
    const suffix = hostParts[hostParts.length - 1];

    if (suffix.length === 2 && !GENERIC_CCTLDS.has(suffix)) {
      const mapped = (CCTLD_OVERRIDES[suffix] ?? suffix).toUpperCase();
      if (validRegions.has(mapped)) ccTld = mapped;
    }

    // de.example.com or en-gb.example.com
    const first = hostParts[0];
    if (first && first !== "www" && hostParts.length > 2) {
      if (/^[a-z]{2}(-[a-z]{2})?$/.test(first)) subdomainLocale = first;
    }

    // /de/, /en-gb/, /fr-ca/
    const firstSegment = parsed.pathname.split("/").filter(Boolean)[0];
    if (firstSegment && /^[a-z]{2}(-[a-z]{2})?$/i.test(firstSegment)) {
      pathLocale = firstSegment.toLowerCase();
    }
  } catch {
    // A URL we cannot parse simply carries no geo signal.
  }

  return {
    ccTld,
    pathLocale,
    subdomainLocale,
    geoRegion: page.geoRegion,
    schemaCountries: page.schemaCountries,
    currencies: page.currencies,
  };
}

/** Folds per-page signals into one picture of who the site is for. */
export function summarizeCoverage(
  signals: GeoSignals[],
  hreflangRegions: string[],
  validRegions: Set<string>,
): GeoCoverage {
  const sources: Record<string, Set<string>> = {};

  const add = (country: string | null, source: string) => {
    if (!country || !validRegions.has(country)) return;
    (sources[country] ??= new Set()).add(source);
  };

  for (const signal of signals) {
    add(signal.ccTld, "ccTLD");
    add(signal.geoRegion, "geo.region meta");
    if (signal.pathLocale) {
      add(localeToCountry(signal.pathLocale, validRegions), "URL path");
    }
    if (signal.subdomainLocale) {
      add(localeToCountry(signal.subdomainLocale, validRegions), "subdomain");
    }
    for (const country of signal.schemaCountries) {
      add(country, "structured data");
    }
  }

  for (const region of hreflangRegions) add(region, "hreflang");

  const countries = Object.keys(sources).sort();

  return {
    countries,
    sources: Object.fromEntries(
      countries.map((country) => [country, [...sources[country]].sort()]),
    ),
    isSingleMarket: countries.length <= 1,
  };
}
