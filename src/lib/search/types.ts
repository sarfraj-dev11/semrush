/**
 * Search providers.
 *
 * Rank tracking needs results from a real search engine, targeted to a country
 * and device. There are two honest ways to get that:
 *
 *   - A licensed SERP API (DataForSEO, SerpApi, Oxylabs SERP). They are built
 *     for this, they carry the compliance and infrastructure burden, and their
 *     country/device targeting is a parameter rather than a proxy trick.
 *   - An official engine API (Bing Web Search; Google's Custom Search JSON API,
 *     with the caveat that it queries a custom index and its ordering is NOT
 *     google.com's ranking, which limits its use for rank tracking).
 *
 * Scraping google.com directly is the third option, and it is the one this
 * interface deliberately has no implementation for. It breaks Google's terms,
 * and it only works with fingerprint spoofing and CAPTCHA solving — at which
 * point the failure mode is not "a query fails" but "every IP you own is
 * burned". A provider is a line in a config file; a burned ASN is not.
 *
 * Everything below is provider-agnostic, so adding one is a new file and a
 * credential, with no change to callers.
 */

export type SearchDevice = "desktop" | "mobile";

export type SearchOptions = {
  /** ISO 3166-1 alpha-2, e.g. "GB". */
  country: string;
  device: SearchDevice;
  /** ISO 639-1, e.g. "en". Defaults to the country's usual language. */
  language?: string;
  /** City or region name, for providers that support local results. */
  location?: string;
  /** How many results to request. */
  limit?: number;
};

export type SearchResult = {
  /** 1-based position in the organic results. */
  position: number;
  url: string;
  title: string | null;
  description: string | null;
  displayUrl: string | null;
};

export type SearchResponse = {
  keyword: string;
  results: SearchResult[];
  /** SERP features present, e.g. ["featured_snippet", "people_also_ask"]. */
  features: string[];
  /** Total results the engine claims, when reported. */
  totalResults: number | null;
  /** Provider id that produced this, stored on the ranking row. */
  source: string;
  fetchedAt: Date;
};

export interface SearchProvider {
  readonly id: string;
  readonly label: string;
  /** Countries the provider can target, or null when it supports all. */
  readonly countries: string[] | null;
  /**
   * Whether `options.device` is honoured. Providers that cannot target a
   * device declare it here rather than returning desktop results labelled as
   * mobile — a ranking attributed to the wrong device is worse than none.
   */
  readonly supportsDevice?: boolean;
  /** Whether credentials are present and the provider is usable. */
  isConfigured(): Promise<boolean>;
  search(keyword: string, options: SearchOptions): Promise<SearchResponse>;
}

/** Thrown when a lookup is attempted with nothing configured. */
export class NoSearchProviderError extends Error {
  constructor() {
    super(
      "No search provider configured. Set SEARCH_PROVIDER and its credentials, " +
        "or keep importing rankings from CSV.",
    );
    this.name = "NoSearchProviderError";
  }
}

/**
 * The provider's allowance is gone.
 *
 * This is separated from an ordinary failure because the correct response is
 * the opposite one. A failed keyword is worth retrying and moving past; an
 * exhausted quota means every remaining keyword will fail too, and continuing
 * would turn one clear error into hundreds of useless ones — and, worse, would
 * write "not ranking" against keywords that were never actually checked.
 */
export class QuotaExhaustedError extends Error {
  readonly provider: string;
  readonly status: number | null;

  constructor(provider: string, detail: string, status: number | null = null) {
    super(`${provider} API limit exhausted — ${detail}`);
    this.name = "QuotaExhaustedError";
    this.provider = provider;
    this.status = status;
  }
}

/** Credentials are present but the provider rejected them. */
export class InvalidCredentialsError extends Error {
  constructor(provider: string, detail: string) {
    super(`${provider} rejected the API key — ${detail}`);
    this.name = "InvalidCredentialsError";
  }
}

/** Provider is up but asking us to slow down; the same key will work later. */
export class RateLimitedError extends Error {
  readonly retryAfterMs: number | null;

  constructor(provider: string, retryAfterMs: number | null = null) {
    super(
      `${provider} rate limit hit${
        retryAfterMs ? ` — retry in ${Math.ceil(retryAfterMs / 1000)}s` : ""
      }`,
    );
    this.name = "RateLimitedError";
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Reduces anything domain-shaped to a bare hostname.
 *
 * Both sides of the comparison must go through this. Stripping the protocol
 * with a regex is not enough: it leaves the port and any path behind, so
 * "https://example.com/" becomes "example.com/" and never matches the
 * "example.com" that URL.hostname yields — every keyword silently reports as
 * not ranking.
 */
export function toHostname(value: string): string | null {
  if (!value) return null;

  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
      ? value
      : `https://${value}`;
    const hostname = new URL(withProtocol).hostname.toLowerCase();
    return hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * Finds where a domain ranks in a result set. Returns null for "not in the
 * tracked range", which is a different fact from "position 0" and is stored
 * as null in keyword_rankings for exactly that reason.
 */
export function findDomainPosition(
  results: SearchResult[],
  domain: string,
): { position: number; url: string } | null {
  const target = toHostname(domain);
  if (!target) return null;

  for (const result of results) {
    const host = toHostname(result.url);
    if (!host) continue;

    // Subdomains of the target count: blog.example.com is still the site.
    if (host === target || host.endsWith(`.${target}`)) {
      return { position: result.position, url: result.url };
    }
  }

  return null;
}
