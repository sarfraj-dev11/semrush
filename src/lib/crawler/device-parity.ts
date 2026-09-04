import { fetchPage } from "./fetcher";
import { pickIdentity } from "./identity";
import { pool } from "./link-checker";
import { extractPage } from "./parser";
import type { HostThrottle } from "./throttle";

/**
 * Device parity.
 *
 * Google indexes the mobile rendition. If a site serves different markup to
 * phones — a separate template, a redirect to an m. subdomain, a trimmed-down
 * page — then the desktop version most audits look at is not the version that
 * ranks, and the difference is invisible to any crawler that only fetches once.
 *
 * So each sampled URL is fetched twice, as a phone and as a desktop browser,
 * and the two renditions are compared. The comparison itself is pure, which is
 * where the judgement lives; the fetching around it is deliberately thin.
 *
 * The two failures worth the whole check: a canonical that differs between
 * renditions, and a `noindex` present on only one of them. Both quietly
 * de-index pages that look perfectly healthy in a desktop crawl.
 */

export type Rendition = {
  statusCode: number | null;
  finalUrl: string;
  title: string | null;
  canonical: string | null;
  metaRobots: string | null;
  isNoindex: boolean;
  wordCount: number;
  internalLinkCount: number;
  error: string | null;
};

export type ParityField =
  | "status"
  | "redirect"
  | "canonical"
  | "robots"
  | "title"
  | "content"
  | "links";

export type ParityDifference = {
  field: ParityField;
  desktop: string;
  mobile: string;
};

export type ParityResult = {
  differencesByPage: Map<number, ParityDifference[]>;
  checked: number;
  differing: number;
};

export type ParityTarget = {
  pageId: number;
  url: string;
};

export type ParityThresholds = {
  /** Fractional word-count gap tolerated before it counts as a content gap. */
  contentGap: number;
  /** Fractional internal-link gap tolerated. */
  linkGap: number;
};

export const DEFAULT_PARITY_THRESHOLDS: ParityThresholds = {
  contentGap: 0.1,
  linkGap: 0.2,
};

/** Relative difference between two counts, using the larger as the base. */
function gap(a: number, b: number): number {
  const largest = Math.max(a, b);
  if (largest === 0) return 0;
  return Math.abs(a - b) / largest;
}

const describe = (value: string | null) => value ?? "(none)";

/**
 * Pure comparison of two renditions of the same URL. Returns one entry per
 * field that genuinely disagrees.
 */
export function diffRenditions(
  desktop: Rendition,
  mobile: Rendition,
  thresholds: ParityThresholds = DEFAULT_PARITY_THRESHOLDS,
): ParityDifference[] {
  // If either fetch failed there is nothing to compare — a transport failure
  // is a different finding, not a parity difference.
  if (desktop.error || mobile.error) return [];

  const differences: ParityDifference[] = [];

  if (desktop.statusCode !== mobile.statusCode) {
    differences.push({
      field: "status",
      desktop: String(desktop.statusCode ?? "error"),
      mobile: String(mobile.statusCode ?? "error"),
    });
    // Different status codes make every content comparison meaningless.
    return differences;
  }

  if (desktop.finalUrl !== mobile.finalUrl) {
    differences.push({
      field: "redirect",
      desktop: desktop.finalUrl,
      mobile: mobile.finalUrl,
    });
  }

  if (desktop.canonical !== mobile.canonical) {
    differences.push({
      field: "canonical",
      desktop: describe(desktop.canonical),
      mobile: describe(mobile.canonical),
    });
  }

  if (desktop.isNoindex !== mobile.isNoindex) {
    differences.push({
      field: "robots",
      desktop: describe(desktop.metaRobots),
      mobile: describe(mobile.metaRobots),
    });
  }

  if ((desktop.title ?? "") !== (mobile.title ?? "")) {
    differences.push({
      field: "title",
      desktop: describe(desktop.title),
      mobile: describe(mobile.title),
    });
  }

  if (gap(desktop.wordCount, mobile.wordCount) > thresholds.contentGap) {
    differences.push({
      field: "content",
      desktop: `${desktop.wordCount} words`,
      mobile: `${mobile.wordCount} words`,
    });
  }

  if (
    gap(desktop.internalLinkCount, mobile.internalLinkCount) > thresholds.linkGap
  ) {
    differences.push({
      field: "links",
      desktop: `${desktop.internalLinkCount} links`,
      mobile: `${mobile.internalLinkCount} links`,
    });
  }

  return differences;
}

/** Maps a difference onto the issue code the catalog defines for it. */
export function parityIssueCode(field: ParityField): string {
  switch (field) {
    case "status":
      return "parity_status";
    case "redirect":
      return "parity_redirect";
    case "canonical":
      return "parity_canonical";
    case "robots":
      return "parity_robots";
    case "title":
      return "parity_title";
    case "content":
      return "parity_content";
    case "links":
      return "parity_links";
  }
}

async function fetchAs(
  url: string,
  device: "mobile" | "desktop",
  options: { timeoutMs?: number; throttle?: HostThrottle },
): Promise<Rendition> {
  const identity = pickIdentity({ device });
  const run = () =>
    fetchPage(url, {
      timeoutMs: options.timeoutMs,
      context: { identity },
    });

  const outcome = options.throttle
    ? await options.throttle.run(url, run)
    : await run();

  options.throttle?.observe(url, outcome.statusCode, null);

  const extracted =
    outcome.html && outcome.statusCode && outcome.statusCode < 400
      ? extractPage(outcome.html, outcome.finalUrl)
      : null;

  return {
    statusCode: outcome.statusCode,
    finalUrl: outcome.finalUrl,
    title: extracted?.title ?? null,
    canonical: extracted?.canonical ?? null,
    metaRobots: extracted?.metaRobots ?? null,
    isNoindex: extracted?.isNoindex ?? false,
    wordCount: extracted?.wordCount ?? 0,
    internalLinkCount:
      extracted?.links.filter((link) => link.isInternal).length ?? 0,
    error: outcome.error,
  };
}

export type ParityOptions = {
  /** Upper bound on URLs sampled — this bot doubles the cost of each one. */
  limit?: number;
  concurrency?: number;
  timeoutMs?: number;
  throttle?: HostThrottle;
  isCancelled?: () => boolean;
  thresholds?: ParityThresholds;
};

export async function checkDeviceParity(
  targets: ParityTarget[],
  options: ParityOptions = {},
): Promise<ParityResult> {
  const {
    limit = 50,
    concurrency = 3,
    timeoutMs,
    throttle,
    isCancelled,
    thresholds = DEFAULT_PARITY_THRESHOLDS,
  } = options;

  const sample = targets.slice(0, limit);
  const differencesByPage = new Map<number, ParityDifference[]>();
  let checked = 0;
  let differing = 0;

  await pool(sample, concurrency, async (target) => {
    if (isCancelled?.()) return;

    // Sequential per URL on purpose: the two requests hit the same host, and
    // firing them together is the burst the throttle exists to prevent.
    const desktop = await fetchAs(target.url, "desktop", { timeoutMs, throttle });
    if (isCancelled?.()) return;
    const mobile = await fetchAs(target.url, "mobile", { timeoutMs, throttle });

    checked++;
    const differences = diffRenditions(desktop, mobile, thresholds);
    if (differences.length === 0) return;

    differing++;
    differencesByPage.set(target.pageId, differences);
  });

  return { differencesByPage, checked, differing };
}
