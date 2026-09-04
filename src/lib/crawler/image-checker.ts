import { probeUrl } from "./fetcher";
import { pool } from "./link-checker";
import type { HostThrottle } from "./throttle";

/**
 * Image auditing.
 *
 * Broken and oversized images are the classic "minor" findings that never show
 * up in a page-level crawl, because a page returns a perfectly healthy 200
 * while every illustration on it 404s. Images are probed with HEAD wherever
 * possible, so the crawl learns the size without downloading the bytes.
 */

/** Past this an image is heavy enough to hurt LCP on a mobile connection. */
export const OVERSIZED_IMAGE_BYTES = 500_000;

export type PageImage = {
  pageId: number;
  url: string;
};

export type ImageCheckResult = {
  brokenByPage: Map<number, string[]>;
  oversizedByPage: Map<number, { url: string; bytes: number }[]>;
  checked: number;
  broken: number;
  oversized: number;
  /** Total bytes across every image whose size we learned. */
  totalBytes: number;
};

export type ImageCheckOptions = {
  userAgent?: string;
  limit?: number;
  concurrency?: number;
  timeoutMs?: number;
  isCancelled?: () => boolean;
  throttle?: HostThrottle;
};

export async function checkImages(
  images: PageImage[],
  options: ImageCheckOptions = {},
): Promise<ImageCheckResult> {
  const {
    userAgent,
    limit = 300,
    concurrency = 6,
    timeoutMs = 10_000,
    isCancelled,
    throttle,
  } = options;

  // One probe per distinct image, however many pages embed it.
  const pagesByUrl = new Map<string, Set<number>>();
  for (const image of images) {
    if (!/^https?:\/\//i.test(image.url)) continue;
    const bucket = pagesByUrl.get(image.url);
    if (bucket) bucket.add(image.pageId);
    else pagesByUrl.set(image.url, new Set([image.pageId]));
  }

  const targets = [...pagesByUrl.keys()]
    .sort((a, b) => (pagesByUrl.get(b)?.size ?? 0) - (pagesByUrl.get(a)?.size ?? 0))
    .slice(0, limit);

  const brokenByPage = new Map<number, string[]>();
  const oversizedByPage = new Map<number, { url: string; bytes: number }[]>();
  let checked = 0;
  let broken = 0;
  let oversized = 0;
  let totalBytes = 0;

  await pool(targets, concurrency, async (url) => {
    if (isCancelled?.()) return;

    const probe = throttle
      ? await throttle.run(url, () => probeUrl(url, { userAgent, timeoutMs }))
      : await probeUrl(url, { userAgent, timeoutMs });

    throttle?.observe(url, probe.statusCode, probe.retryAfter);
    checked++;

    const pages = pagesByUrl.get(url) ?? new Set<number>();

    const isBroken =
      Boolean(probe.error) ||
      probe.statusCode === null ||
      (probe.statusCode >= 400 && probe.statusCode !== 429);

    if (isBroken) {
      broken++;
      for (const pageId of pages) {
        const list = brokenByPage.get(pageId);
        if (list) list.push(url);
        else brokenByPage.set(pageId, [url]);
      }
      return;
    }

    if (probe.contentLength !== null) {
      totalBytes += probe.contentLength;

      if (probe.contentLength > OVERSIZED_IMAGE_BYTES) {
        oversized++;
        for (const pageId of pages) {
          const entry = { url, bytes: probe.contentLength };
          const list = oversizedByPage.get(pageId);
          if (list) list.push(entry);
          else oversizedByPage.set(pageId, [entry]);
        }
      }
    }
  });

  return {
    brokenByPage,
    oversizedByPage,
    checked,
    broken,
    oversized,
    totalBytes,
  };
}
