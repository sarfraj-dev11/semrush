export type HreflangLink = {
  /** Lowercased hreflang value, e.g. "en-gb" or "x-default". */
  code: string;
  /** Absolute, normalized target URL. */
  href: string;
};

export type ExtractedLink = {
  /** Absolute, fragment-stripped URL. */
  url: string;
  anchorText: string | null;
  rel: string | null;
  isInternal: boolean;
};

/** A link that pointed at a specific anchor within a page. */
export type FragmentTarget = {
  /** Target page URL, fragment removed. */
  url: string;
  /** Fragment without the leading "#", as written in the href. */
  fragment: string;
};

export type ExtractedPage = {
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2Count: number;
  headingOrderBroken: boolean;
  canonical: string | null;
  metaRobots: string | null;
  isNoindex: boolean;
  isNofollow: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  lang: string | null;
  hreflangCount: number;
  /** Declared hreflang codes, lowercased. "x-default" counts as a code. */
  hreflangs: string[];
  /** The full alternate declarations, needed to verify return links. */
  hreflangLinks: HreflangLink[];
  /** Country/language signals read straight off the page. */
  geoRegion: string | null;
  schemaCountries: string[];
  currencies: string[];
  structuredDataTypes: string[];
  wordCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  /** Absolute URLs of the images on the page, deduplicated. */
  imageUrls: string[];
  /**
   * Distinct HTML5 landmark elements present (main, article, nav, …). AI
   * crawlers lean on these to work out which part of the page is the answer.
   */
  semanticTagCount: number;
  /** Sub-resources and links loaded over http:// from an https:// page. */
  mixedContentCount: number;
  links: ExtractedLink[];
  /** id/name attributes on this page — what an incoming #fragment resolves to. */
  elementIds: string[];
  /** Outgoing links that carried a #fragment. */
  fragmentLinks: FragmentTarget[];
};

export type FetchOutcome = {
  /** URL as it was queued. */
  requestedUrl: string;
  /** URL after following redirects. */
  finalUrl: string;
  statusCode: number | null;
  contentType: string | null;
  html: string | null;
  redirectChain: number;
  redirectTo: string | null;
  responseTimeMs: number;
  sizeBytes: number | null;
  /** Lowercased response headers of the final response. */
  headers: Record<string, string>;
  error: string | null;
};

/**
 * Everything the page-level rules are allowed to look at. Deliberately plain
 * data so rules stay pure and testable without a network or database.
 */
export type PageFacts = {
  url: string;
  depth: number;
  statusCode: number | null;
  contentType: string | null;
  redirectChain: number;
  responseTimeMs: number | null;
  sizeBytes: number | null;
  fetchError: string | null;
  isSelfCanonical: boolean | null;
  isHttps: boolean;
  hasHsts: boolean;
  /** True when robots.txt blocks at least one major AI crawler for this URL. */
  blockedForAiBots: boolean;
  /** How many of the six checked security headers the response carried. */
  securityHeaderCount: number;
  extracted: ExtractedPage | null;
};

export type DetectedIssue = {
  code: string;
  detail?: string;
};
