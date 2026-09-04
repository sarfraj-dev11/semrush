import type { ConsoleEntry, FailedRequest } from "./renderer";
import type { DetectedIssue } from "./types";

/**
 * JavaScript execution health.
 *
 * A page can return 200, contain all the right markup, and still be broken:
 * a script throws halfway through, the content that was going to be injected
 * never appears, and the crawl records a perfectly healthy page. Console errors
 * and failed subresource requests are the evidence.
 *
 * Pure: everything comes from the diagnostics the browser probe already
 * collected. Third-party failures are separated from first-party ones, because
 * a blocked analytics beacon is not the site's bug and reporting the two
 * together is how this kind of check becomes noise nobody reads.
 */

export type ConsoleSummary = {
  errorCount: number;
  warningCount: number;
  /** Deduplicated error texts, most recent order preserved. */
  uniqueErrors: string[];
  /** Failed requests to the site's own host. */
  firstPartyFailures: FailedRequest[];
  /** Failed requests to other hosts. */
  thirdPartyFailures: FailedRequest[];
};

/**
 * Messages that say nothing about the site's own health. Browser extensions
 * and blocked trackers produce these constantly.
 */
const IGNORED_PATTERNS = [
  /ERR_BLOCKED_BY_CLIENT/i,
  /chrome-extension:/i,
  /moz-extension:/i,
  /Failed to load resource: net::ERR_BLOCKED/i,
];

function isNoise(text: string): boolean {
  return IGNORED_PATTERNS.some((pattern) => pattern.test(text));
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function summarizeConsole(
  entries: ConsoleEntry[],
  failedRequests: FailedRequest[],
  pageUrl: string,
): ConsoleSummary {
  const pageHost = hostOf(pageUrl);

  const meaningful = entries.filter((entry) => !isNoise(entry.text));
  const errors = meaningful.filter((entry) => entry.level === "error");

  const uniqueErrors: string[] = [];
  for (const error of errors) {
    if (!uniqueErrors.includes(error.text)) uniqueErrors.push(error.text);
  }

  const firstPartyFailures: FailedRequest[] = [];
  const thirdPartyFailures: FailedRequest[] = [];

  for (const request of failedRequests) {
    if (request.reason && isNoise(request.reason)) continue;
    const host = hostOf(request.url);
    if (host && pageHost && host === pageHost) firstPartyFailures.push(request);
    else thirdPartyFailures.push(request);
  }

  return {
    errorCount: errors.length,
    warningCount: meaningful.length - errors.length,
    uniqueErrors,
    firstPartyFailures,
    thirdPartyFailures,
  };
}

export function consoleIssues(summary: ConsoleSummary): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  if (summary.uniqueErrors.length > 0) {
    const [first] = summary.uniqueErrors;
    issues.push({
      code: "js_error",
      detail:
        summary.uniqueErrors.length === 1
          ? first
          : `${summary.uniqueErrors.length} distinct errors, first: ${first}`,
    });
  }

  if (summary.firstPartyFailures.length > 0) {
    const [first] = summary.firstPartyFailures;
    issues.push({
      code: "failed_subresource",
      detail:
        summary.firstPartyFailures.length === 1
          ? `${first.url}${first.status ? ` (${first.status})` : ""}`
          : `${summary.firstPartyFailures.length} resources failed, including ${first.url}`,
    });
  }

  if (summary.thirdPartyFailures.length > 0) {
    const [first] = summary.thirdPartyFailures;
    issues.push({
      code: "failed_third_party_resource",
      detail:
        summary.thirdPartyFailures.length === 1
          ? `${first.url}${first.status ? ` (${first.status})` : ""}`
          : `${summary.thirdPartyFailures.length} third-party resources failed, including ${first.url}`,
    });
  }

  return issues;
}
