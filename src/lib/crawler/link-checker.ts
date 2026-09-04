import { probeUrl } from "./fetcher";
import type { HostThrottle } from "./throttle";

export type OutboundLink = {
  fromPageId: number;
  toUrl: string;
};

export type LinkCheckResult = {
  /** Broken destinations keyed by the page that links to them. */
  brokenByPage: Map<number, string[]>;
  /** Distinct URLs actually probed. */
  checked: number;
  /** Distinct URLs that came back broken. */
  broken: number;
};

export type LinkCheckOptions = {
  userAgent?: string;
  /** Upper bound on distinct URLs probed, so a link-heavy site stays bounded. */
  limit?: number;
  concurrency?: number;
  timeoutMs?: number;
  isCancelled?: () => boolean;
  /**
   * Shared politeness layer. Outbound links fan across many hosts, so the
   * throttle's per-host budget is what stops us hammering any single one while
   * still letting different hosts proceed in parallel.
   */
  throttle?: HostThrottle;
};

/**
 * A destination counts as broken on 4xx/5xx or on a transport failure. 429 is
 * deliberately excluded — being rate limited says something about our crawler,
 * not about the link.
 */
function isBroken(statusCode: number | null, error: string | null): boolean {
  if (error) return true;
  if (statusCode === null) return true;
  if (statusCode === 429) return false;
  return statusCode >= 400;
}

export async function pool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      for (;;) {
        const index = cursor++;
        if (index >= items.length) return;
        await worker(items[index]);
      }
    },
  );
  await Promise.all(runners);
}

/**
 * Probes outbound links once per distinct URL, then fans the verdict back out
 * to every page that linked to it. Sites link to the same handful of external
 * destinations from every page in the footer, so deduplicating first is the
 * difference between a few dozen requests and a few thousand.
 */
export async function checkExternalLinks(
  links: OutboundLink[],
  options: LinkCheckOptions = {},
): Promise<LinkCheckResult> {
  const {
    userAgent,
    limit = 300,
    concurrency = 8,
    timeoutMs = 10_000,
    isCancelled,
    throttle,
  } = options;

  const pagesByUrl = new Map<string, Set<number>>();
  for (const link of links) {
    if (!/^https?:\/\//i.test(link.toUrl)) continue;
    const bucket = pagesByUrl.get(link.toUrl);
    if (bucket) bucket.add(link.fromPageId);
    else pagesByUrl.set(link.toUrl, new Set([link.fromPageId]));
  }

  // Most-linked destinations first: if the limit bites, the URLs that would
  // affect the most pages are the ones already checked.
  const targets = [...pagesByUrl.keys()]
    .sort((a, b) => (pagesByUrl.get(b)?.size ?? 0) - (pagesByUrl.get(a)?.size ?? 0))
    .slice(0, limit);

  const brokenByPage = new Map<number, string[]>();
  let broken = 0;
  let checked = 0;

  await pool(targets, concurrency, async (url) => {
    if (isCancelled?.()) return;

    const probe = throttle
      ? await throttle.run(url, () => probeUrl(url, { userAgent, timeoutMs }))
      : await probeUrl(url, { userAgent, timeoutMs });

    throttle?.observe(url, probe.statusCode, probe.retryAfter);
    checked++;
    if (!isBroken(probe.statusCode, probe.error)) return;

    broken++;
    for (const pageId of pagesByUrl.get(url) ?? []) {
      const list = brokenByPage.get(pageId);
      if (list) list.push(url);
      else brokenByPage.set(pageId, [url]);
    }
  });

  return { brokenByPage, checked, broken };
}
