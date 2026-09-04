/**
 * Fragment link validation.
 *
 * A link to `/docs#installation` is broken if that page has no element with
 * that id — but it returns a perfectly healthy 200, so every status-code-based
 * link checker calls it fine. The browser silently lands at the top of the page
 * instead, and nobody notices until a user follows the link.
 *
 * Pure: the ids were already collected while parsing each page, so this costs
 * no requests. Only fragments pointing at pages the crawl actually read can be
 * judged — an uncrawled target is unknown, not broken.
 */

export type FragmentPage = {
  pageId: number;
  url: string;
  /** Every id/name attribute found on the page. */
  elementIds: string[];
};

export type FragmentLink = {
  fromPageId: number;
  /** Target page URL, without the fragment. */
  toUrl: string;
  /** Fragment with the leading "#" removed, still percent-encoded. */
  fragment: string;
};

export type FragmentCheckResult = {
  /** Broken "url#fragment" strings keyed by the page containing the link. */
  brokenByPage: Map<number, string[]>;
  checked: number;
  broken: number;
  /** Fragments whose target page was never crawled, so nothing can be said. */
  unresolved: number;
};

/**
 * Fragments the browser handles itself. "#top" scrolls to the document top
 * with or without a matching element, and an empty fragment is a same-page
 * link, so neither can be broken.
 */
const BUILT_IN_FRAGMENTS = new Set(["", "top"]);

function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    // A malformed escape sequence is not a reason to drop the check.
    return fragment;
  }
}

export function checkFragments(
  pages: FragmentPage[],
  links: FragmentLink[],
): FragmentCheckResult {
  const idsByUrl = new Map<string, Set<string>>();
  for (const page of pages) {
    idsByUrl.set(page.url, new Set(page.elementIds));
  }

  const brokenByPage = new Map<number, string[]>();
  let checked = 0;
  let broken = 0;
  let unresolved = 0;

  for (const link of links) {
    const raw = link.fragment.replace(/^#/, "");
    if (BUILT_IN_FRAGMENTS.has(raw.toLowerCase())) continue;

    const ids = idsByUrl.get(link.toUrl);
    if (!ids) {
      unresolved++;
      continue;
    }

    checked++;
    const decoded = decodeFragment(raw);
    // Match either form: authors write the encoded version in href and the
    // decoded version in id, and browsers resolve both.
    if (ids.has(raw) || ids.has(decoded)) continue;

    broken++;
    const label = `${link.toUrl}#${raw}`;
    const list = brokenByPage.get(link.fromPageId);
    if (list) {
      if (!list.includes(label)) list.push(label);
    } else {
      brokenByPage.set(link.fromPageId, [label]);
    }
  }

  return { brokenByPage, checked, broken, unresolved };
}
