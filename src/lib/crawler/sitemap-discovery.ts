import { XMLParser } from "fast-xml-parser";
import { fetchText } from "./fetcher";
import { normalizeUrl } from "./parser";
import type { HostThrottle } from "./throttle";

/**
 * Sitemap discovery.
 *
 * Collects the URLs a site advertises, from robots.txt's Sitemap lines and the
 * conventional /sitemap.xml. Extracted from the crawl runner so anything that
 * needs "what does this site say it has" can ask without pulling in the whole
 * crawl machinery.
 *
 * Off-host entries are dropped: a sitemap may legitimately list another
 * property, but counting those would overstate this site's coverage.
 */
export async function discoverSitemapUrls(
  origin: string,
  robotsSitemaps: string[],
  userAgent: string,
  host: string,
  throttle?: HostThrottle,
): Promise<string[]> {
  const parser = new XMLParser({ ignoreAttributes: true });
  const candidates = new Set<string>([
    ...robotsSitemaps,
    new URL("/sitemap.xml", origin).toString(),
  ]);

  const found = new Set<string>();
  const seenSitemaps = new Set<string>();

  // One level of sitemap-index nesting is enough for almost every real site.
  for (let round = 0; round < 2 && candidates.size > 0; round++) {
    const batch = [...candidates].filter((url) => !seenSitemaps.has(url));
    candidates.clear();

    for (const sitemapUrl of batch.slice(0, 20)) {
      seenSitemaps.add(sitemapUrl);
      const request = () => fetchText(sitemapUrl, { userAgent });
      const { body } = throttle
        ? await throttle.run(sitemapUrl, request)
        : await request();
      if (!body) continue;

      let parsed: unknown;
      try {
        parsed = parser.parse(body);
      } catch {
        continue;
      }

      const doc = parsed as {
        urlset?: { url?: unknown };
        sitemapindex?: { sitemap?: unknown };
      };

      const asArray = (value: unknown) =>
        Array.isArray(value) ? value : value ? [value] : [];

      for (const entry of asArray(doc.urlset?.url)) {
        const loc = (entry as { loc?: unknown }).loc;
        if (typeof loc !== "string") continue;
        const url = normalizeUrl(loc);
        if (!url) continue;
        try {
          if (new URL(url).hostname.replace(/^www\./, "") !== host) continue;
        } catch {
          continue;
        }
        found.add(url);
      }

      for (const entry of asArray(doc.sitemapindex?.sitemap)) {
        const loc = (entry as { loc?: unknown }).loc;
        if (typeof loc === "string") candidates.add(loc);
      }
    }
  }

  return [...found];
}
