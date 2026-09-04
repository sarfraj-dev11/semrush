/**
 * A sitemap is a set of promises: every URL in it should be a live, indexable,
 * canonical page. This checks each promise against what the crawl actually
 * found, which is the only way to know whether the sitemap is telling the
 * truth.
 */

export type SitemapPageState = {
  statusCode: number | null;
  redirectChain: number;
  isNoindex: boolean;
  canonical: string | null;
  fetchError: string | null;
};

export type SitemapProblem = {
  url: string;
  reason: string;
};

export function validateSitemap(
  sitemapUrls: string[],
  states: Map<string, SitemapPageState>,
): SitemapProblem[] {
  const problems: SitemapProblem[] = [];

  for (const url of sitemapUrls) {
    const state = states.get(url);
    // Not crawled — depth limits, crawl caps or robots rules all land here, and
    // none of them are evidence the sitemap entry is wrong.
    if (!state) continue;

    if (state.fetchError) {
      problems.push({ url, reason: `Could not be fetched: ${state.fetchError}` });
      continue;
    }

    if (state.statusCode !== null && state.statusCode >= 400) {
      problems.push({
        url,
        reason: `Listed in the sitemap but returns ${state.statusCode}`,
      });
      continue;
    }

    if (state.redirectChain > 0) {
      problems.push({
        url,
        reason: "Listed in the sitemap but redirects instead of serving a page",
      });
      continue;
    }

    if (state.isNoindex) {
      problems.push({
        url,
        reason: "Listed in the sitemap but marked noindex",
      });
      continue;
    }

    if (state.canonical && state.canonical !== url) {
      problems.push({
        url,
        reason: `Listed in the sitemap but canonicalises to ${state.canonical}`,
      });
    }
  }

  return problems;
}
