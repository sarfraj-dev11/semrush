import type { DetectedIssue } from "./types";

/**
 * Cache and CDN analysis.
 *
 * Like security-headers.ts, this costs nothing: the headers were already
 * captured when the page was fetched, so the whole read-out adds zero requests.
 *
 * The judgements here are deliberately narrow. How long a page *should* be
 * cached is a product decision this tool has no way to know — a news homepage
 * and a documentation page have opposite correct answers. So the checks are
 * limited to the cases that are wrong regardless of intent: no caching story at
 * all, no way to revalidate, and the `Vary: User-Agent` mistake.
 */

export type CacheReport = {
  cacheControl: string | null;
  /** Effective shared-cache lifetime: s-maxage wins over max-age. */
  maxAgeSeconds: number | null;
  isNoStore: boolean;
  isNoCache: boolean;
  isPrivate: boolean;
  mustRevalidate: boolean;
  hasEtag: boolean;
  hasLastModified: boolean;
  varyOn: string[];
  /** Vary: User-Agent — the adaptive-serving footgun. */
  variesOnUserAgent: boolean;
  ageSeconds: number | null;
  /** CDN inferred from vendor headers, null when nothing identifies one. */
  cdn: string | null;
  /** Whether the CDN reported a hit, when it says so at all. */
  cdnHit: boolean | null;
  /** A shared cache is permitted to store this response. */
  publiclyCacheable: boolean;
  /** Some form of revalidation token is present. */
  revalidatable: boolean;
};

/**
 * Vendor fingerprints, most specific first. Each entry is a header that only
 * that CDN sets, or a value match on a shared header.
 */
const CDN_SIGNATURES: {
  cdn: string;
  header: string;
  valuePattern?: RegExp;
}[] = [
  { cdn: "Cloudflare", header: "cf-ray" },
  { cdn: "Fastly", header: "x-fastly-request-id" },
  { cdn: "Vercel", header: "x-vercel-id" },
  { cdn: "Netlify", header: "x-nf-request-id" },
  { cdn: "CloudFront", header: "x-amz-cf-id" },
  { cdn: "Akamai", header: "x-akamai-transformed" },
  { cdn: "Sucuri", header: "x-sucuri-id" },
  { cdn: "Cloudflare", header: "server", valuePattern: /cloudflare/i },
  { cdn: "CloudFront", header: "via", valuePattern: /cloudfront/i },
  { cdn: "Fastly", header: "via", valuePattern: /fastly/i },
  { cdn: "Akamai", header: "server", valuePattern: /akamai/i },
  { cdn: "Varnish", header: "via", valuePattern: /varnish/i },
  { cdn: "Varnish", header: "x-varnish" },
];

function detectCdn(headers: Record<string, string>): string | null {
  for (const { cdn, header, valuePattern } of CDN_SIGNATURES) {
    const value = headers[header];
    if (value === undefined) continue;
    if (valuePattern && !valuePattern.test(value)) continue;
    return cdn;
  }
  return null;
}

/** Reads a hit/miss verdict out of whichever header the CDN used. */
function detectCdnHit(headers: Record<string, string>): boolean | null {
  const candidates = ["cf-cache-status", "x-cache", "x-vercel-cache", "x-nf-cache"];
  for (const header of candidates) {
    const value = headers[header];
    if (!value) continue;
    if (/hit/i.test(value)) return true;
    if (/miss|expired|bypass|dynamic|revalidated/i.test(value)) return false;
  }
  return null;
}

function directiveSeconds(cacheControl: string, name: string): number | null {
  const match = cacheControl.match(new RegExp(`(?:^|[,\\s])${name}\\s*=\\s*"?(\\d+)`, "i"));
  return match ? Number(match[1]) : null;
}

export function analyzeCacheHeaders(
  headers: Record<string, string>,
): CacheReport {
  const cacheControl = headers["cache-control"] ?? null;
  const directives = cacheControl?.toLowerCase() ?? "";

  const isNoStore = /(?:^|[,\s])no-store/.test(directives);
  const isNoCache = /(?:^|[,\s])no-cache/.test(directives);
  const isPrivate = /(?:^|[,\s])private/.test(directives);
  const mustRevalidate = /(?:^|[,\s])must-revalidate/.test(directives);

  // A shared cache honours s-maxage ahead of max-age, so that is the number
  // that actually describes CDN behaviour.
  const sharedMaxAge = cacheControl
    ? directiveSeconds(cacheControl, "s-maxage")
    : null;
  const maxAge = cacheControl ? directiveSeconds(cacheControl, "max-age") : null;
  const maxAgeSeconds = sharedMaxAge ?? maxAge;

  const varyOn = (headers["vary"] ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const hasEtag = Boolean(headers["etag"]);
  const hasLastModified = Boolean(headers["last-modified"]);
  const ageHeader = headers["age"];

  return {
    cacheControl,
    maxAgeSeconds,
    isNoStore,
    isNoCache,
    isPrivate,
    mustRevalidate,
    hasEtag,
    hasLastModified,
    varyOn,
    variesOnUserAgent: varyOn.includes("user-agent"),
    ageSeconds: ageHeader ? Number(ageHeader) : null,
    cdn: detectCdn(headers),
    cdnHit: detectCdnHit(headers),
    publiclyCacheable:
      !isNoStore && !isPrivate && (maxAgeSeconds ?? 0) > 0,
    revalidatable: hasEtag || hasLastModified,
  };
}

/**
 * Only raised for HTML pages that actually returned content — caching
 * directives on a redirect or an error response are not worth reporting.
 */
export function cacheIssues(report: CacheReport): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  if (report.variesOnUserAgent) {
    issues.push({
      code: "vary_user_agent",
      detail: `Vary: ${report.varyOn.join(", ")}`,
    });
  }

  if (report.isNoStore) {
    issues.push({
      code: "cache_no_store",
      detail: report.cacheControl ?? undefined,
    });
    // no-store makes every other caching question moot.
    return issues;
  }

  if (!report.cacheControl && !report.revalidatable) {
    issues.push({ code: "no_cache_policy" });
    return issues;
  }

  if (!report.revalidatable) {
    issues.push({
      code: "no_revalidation_token",
      detail: report.cacheControl ?? undefined,
    });
  }

  return issues;
}
