import type { ThrottleOptions } from "./throttle";

/**
 * Crawl profiles.
 *
 * One speed does not fit every site. Crawling your own staging box as slowly as
 * you would crawl a WAF-protected enterprise site wastes hours; crawling that
 * enterprise site as fast as your staging box gets your IP banned. Each profile
 * is a coherent set of limits for a class of target, and the runner can drop to
 * a slower one mid-crawl when the site starts pushing back.
 */

export type CrawlProfileId = "cautious" | "polite" | "balanced" | "fast";

export type CrawlProfile = {
  id: CrawlProfileId;
  label: string;
  description: string;
  throttle: ThrottleOptions;
  /** Page fetch timeout. Slow, protected sites need longer. */
  timeoutMs: number;
  /** Distinct outbound URLs to verify. */
  externalLinkLimit: number;
  externalLinkConcurrency: number;
  /** Distinct images to probe. */
  imageLimit: number;
  imageConcurrency: number;
};

export const CRAWL_PROFILES: Record<CrawlProfileId, CrawlProfile> = {
  /** WAF-protected, rate-limiting, or previously hostile sites. */
  cautious: {
    id: "cautious",
    label: "Cautious",
    description:
      "One request at a time, three seconds apart. For sites behind a WAF or that have already rate-limited us.",
    throttle: {
      maxConcurrentPerHost: 1,
      minIntervalMs: 3000,
      jitterMs: 1500,
      maxIntervalMs: 60_000,
    },
    timeoutMs: 30_000,
    externalLinkLimit: 100,
    externalLinkConcurrency: 2,
    imageLimit: 50,
    imageConcurrency: 2,
  },

  /** The safe default for any third-party site. */
  polite: {
    id: "polite",
    label: "Polite",
    description:
      "Two in flight, one second apart. Safe for any site you do not control.",
    throttle: {
      maxConcurrentPerHost: 2,
      minIntervalMs: 1000,
      jitterMs: 500,
      maxIntervalMs: 30_000,
    },
    timeoutMs: 20_000,
    externalLinkLimit: 200,
    externalLinkConcurrency: 4,
    imageLimit: 150,
    imageConcurrency: 4,
  },

  /** Sites you own, on real hosting. */
  balanced: {
    id: "balanced",
    label: "Balanced",
    description:
      "Four in flight, a third of a second apart. For sites you own on production hosting.",
    throttle: {
      maxConcurrentPerHost: 4,
      minIntervalMs: 300,
      jitterMs: 150,
      maxIntervalMs: 20_000,
    },
    timeoutMs: 20_000,
    externalLinkLimit: 300,
    externalLinkConcurrency: 8,
    imageLimit: 300,
    imageConcurrency: 8,
  },

  /** Staging, local, or a site you are certain can take it. */
  fast: {
    id: "fast",
    label: "Fast",
    description:
      "Eight in flight, minimal delay. Only for staging or infrastructure you control.",
    throttle: {
      maxConcurrentPerHost: 8,
      minIntervalMs: 100,
      jitterMs: 50,
      maxIntervalMs: 10_000,
    },
    timeoutMs: 15_000,
    externalLinkLimit: 500,
    externalLinkConcurrency: 12,
    imageLimit: 500,
    imageConcurrency: 12,
  },
};

/** Slowest first, so "step down one" is a simple index walk. */
const PROFILE_ORDER: CrawlProfileId[] = ["cautious", "polite", "balanced", "fast"];

export function profileFor(id: string | null | undefined): CrawlProfile {
  if (id && id in CRAWL_PROFILES) return CRAWL_PROFILES[id as CrawlProfileId];
  return CRAWL_PROFILES.polite;
}

/** The next slower profile, or the same one if already at the floor. */
export function slower(profile: CrawlProfile): CrawlProfile {
  const index = PROFILE_ORDER.indexOf(profile.id);
  if (index <= 0) return profile;
  return CRAWL_PROFILES[PROFILE_ORDER[index - 1]];
}

/**
 * Maps a project's concurrency setting onto a profile, so the existing
 * per-project control keeps working without a second knob to configure.
 */
export function profileForConcurrency(concurrency: number): CrawlProfile {
  if (concurrency <= 1) return CRAWL_PROFILES.cautious;
  if (concurrency <= 2) return CRAWL_PROFILES.polite;
  if (concurrency <= 5) return CRAWL_PROFILES.balanced;
  return CRAWL_PROFILES.fast;
}

/**
 * Edge providers and WAFs, spotted from response headers. Their presence is not
 * a problem in itself — but it does mean aggressive crawling is far more likely
 * to end in a challenge page or a ban, so the crawl starts one notch slower.
 */
const PROTECTION_SIGNATURES: [label: string, test: (h: Record<string, string>) => boolean][] = [
  ["Cloudflare", (h) => /cloudflare/i.test(h["server"] ?? "") || "cf-ray" in h],
  ["Akamai", (h) => /akamai/i.test(h["server"] ?? "") || "x-akamai-transformed" in h],
  ["Sucuri", (h) => "x-sucuri-id" in h],
  ["Imperva", (h) => "x-iinfo" in h || /incap/i.test(h["set-cookie"] ?? "")],
  ["Fastly", (h) => /fastly/i.test(h["x-served-by"] ?? "") || "fastly-debug-digest" in h],
  ["AWS WAF", (h) => /awselb/i.test(h["server"] ?? "") || "x-amzn-waf-action" in h],
];

export function detectProtection(
  headers: Record<string, string>,
): string | null {
  for (const [label, test] of PROTECTION_SIGNATURES) {
    if (test(headers)) return label;
  }
  return null;
}
