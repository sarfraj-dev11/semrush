import { pool } from "./link-checker";
import { extractPage } from "./parser";
import type { Renderer } from "./renderer";
import type { HostThrottle } from "./throttle";

/**
 * Render gap.
 *
 * The crawl reads raw HTML, which is what a non-rendering crawler sees. This
 * measures the distance between that and the fully rendered page — the content
 * that exists only after JavaScript runs.
 *
 * That gap is worth a bot of its own because it is getting more expensive, not
 * less: Google renders, but most AI crawlers do not, so JS-only content is
 * invisible to exactly the class of crawler that is growing. A page can rank in
 * search and be blank to an assistant, and nothing in a normal audit says so.
 *
 * Only the rendered version is fetched. The raw numbers are already in the
 * crawl, so re-fetching them would double the cost to learn nothing new.
 */

export type RawSnapshot = {
  pageId: number;
  url: string;
  title: string | null;
  wordCount: number;
  internalLinkCount: number;
  h1Count: number;
  structuredDataTypes: string[];
};

export type RenderGapField =
  | "content"
  | "links"
  | "title"
  | "headings"
  | "structured_data";

export type RenderGapDifference = {
  field: RenderGapField;
  raw: string;
  rendered: string;
};

export type RenderGapResult = {
  gapsByPage: Map<number, RenderGapDifference[]>;
  /** Pages whose raw HTML carried essentially no content of their own. */
  jsOnlyPages: number[];
  checked: number;
  /** False when no JavaScript-capable renderer is configured. */
  available: boolean;
};

export type RenderGapThresholds = {
  /** Fraction of the rendered word count that may be missing from raw HTML. */
  contentGap: number;
  linkGap: number;
  /** At or below this many raw words, the page is a JS-only shell. */
  shellWordCount: number;
};

export const DEFAULT_RENDER_GAP_THRESHOLDS: RenderGapThresholds = {
  contentGap: 0.2,
  linkGap: 0.25,
  shellWordCount: 50,
};

/**
 * Only content the raw HTML is *missing* counts. A rendered page having less
 * text than the source — because a script removed a banner — is not a crawler
 * visibility problem, so the comparison is deliberately one-directional.
 */
function shortfall(raw: number, rendered: number): number {
  if (rendered <= 0) return 0;
  return Math.max(0, (rendered - raw) / rendered);
}

export function diffRenderGap(
  raw: RawSnapshot,
  rendered: Omit<RawSnapshot, "pageId" | "url">,
  thresholds: RenderGapThresholds = DEFAULT_RENDER_GAP_THRESHOLDS,
): RenderGapDifference[] {
  const differences: RenderGapDifference[] = [];

  if (shortfall(raw.wordCount, rendered.wordCount) > thresholds.contentGap) {
    differences.push({
      field: "content",
      raw: `${raw.wordCount} words`,
      rendered: `${rendered.wordCount} words`,
    });
  }

  if (
    shortfall(raw.internalLinkCount, rendered.internalLinkCount) >
    thresholds.linkGap
  ) {
    differences.push({
      field: "links",
      raw: `${raw.internalLinkCount} links`,
      rendered: `${rendered.internalLinkCount} links`,
    });
  }

  if ((raw.title ?? "") !== (rendered.title ?? "")) {
    differences.push({
      field: "title",
      raw: raw.title ?? "(none)",
      rendered: rendered.title ?? "(none)",
    });
  }

  if (raw.h1Count === 0 && rendered.h1Count > 0) {
    differences.push({
      field: "headings",
      raw: "no H1",
      rendered: `${rendered.h1Count} H1`,
    });
  }

  const rawTypes = new Set(raw.structuredDataTypes);
  const onlyRendered = rendered.structuredDataTypes.filter(
    (type) => !rawTypes.has(type),
  );
  if (onlyRendered.length > 0) {
    differences.push({
      field: "structured_data",
      raw: raw.structuredDataTypes.join(", ") || "none",
      rendered: onlyRendered.join(", "),
    });
  }

  return differences;
}

export function renderGapIssueCode(field: RenderGapField): string {
  switch (field) {
    case "content":
      return "render_gap_content";
    case "links":
      return "render_gap_links";
    case "title":
      return "render_gap_title";
    case "headings":
      return "render_gap_headings";
    case "structured_data":
      return "render_gap_structured_data";
  }
}

export type RenderGapOptions = {
  limit?: number;
  concurrency?: number;
  timeoutMs?: number;
  throttle?: HostThrottle;
  isCancelled?: () => boolean;
  thresholds?: RenderGapThresholds;
};

export async function checkRenderGap(
  snapshots: RawSnapshot[],
  renderer: Renderer,
  options: RenderGapOptions = {},
): Promise<RenderGapResult> {
  const {
    limit = 25,
    // Rendering is far heavier than a fetch, so this stays low regardless of
    // the crawl's own concurrency.
    concurrency = 2,
    timeoutMs = 30_000,
    throttle,
    isCancelled,
    thresholds = DEFAULT_RENDER_GAP_THRESHOLDS,
  } = options;

  const gapsByPage = new Map<number, RenderGapDifference[]>();
  const jsOnlyPages: number[] = [];

  if (!renderer.rendersJavaScript) {
    return { gapsByPage, jsOnlyPages, checked: 0, available: false };
  }

  // Shells first: a page with almost no raw text is the one most likely to
  // have a gap worth reporting, so it should survive the limit.
  const sample = [...snapshots]
    .sort((a, b) => a.wordCount - b.wordCount)
    .slice(0, limit);

  let checked = 0;

  await pool(sample, concurrency, async (snapshot) => {
    if (isCancelled?.()) return;

    const run = () =>
      renderer.render(snapshot.url, { timeoutMs });
    const result = throttle
      ? await throttle.run(snapshot.url, run)
      : await run();

    if (!result.html || result.error) return;

    checked++;
    const extracted = extractPage(result.html, result.finalUrl);
    const differences = diffRenderGap(
      snapshot,
      {
        title: extracted.title,
        wordCount: extracted.wordCount,
        internalLinkCount: extracted.links.filter((link) => link.isInternal)
          .length,
        h1Count: extracted.h1.length,
        structuredDataTypes: extracted.structuredDataTypes,
      },
      thresholds,
    );

    if (
      snapshot.wordCount <= thresholds.shellWordCount &&
      extracted.wordCount > thresholds.shellWordCount
    ) {
      jsOnlyPages.push(snapshot.pageId);
    }

    if (differences.length > 0) gapsByPage.set(snapshot.pageId, differences);
  });

  return { gapsByPage, jsOnlyPages, checked, available: true };
}
