/**
 * Crawl-trap detection.
 *
 * A crawl trap is a URL space with no natural end: a calendar that will happily
 * render the year 3000, a filter UI whose parameters multiply, a relative link
 * that resolves one level deeper every time. Search engines spend a finite
 * crawl budget per site, and a trap spends it on URLs nobody will ever search
 * for — the real pages then get crawled less often, or not at all.
 *
 * Pure: this reads the URL set the crawl already discovered. It deliberately
 * looks at *discovered* URLs rather than crawled ones, because a page limit
 * stops the crawler long before it stops the trap — the evidence is in what got
 * queued, not in what got fetched.
 */

export type TrapKind =
  | "parameter_explosion"
  | "facet_combination"
  | "session_parameter"
  | "calendar"
  | "repeating_path"
  | "excessive_depth";

export type TrapPattern = {
  kind: TrapKind;
  /** Human-readable summary of what was found. */
  detail: string;
  /** How many discovered URLs match this pattern. */
  urlCount: number;
  example: string;
};

export type TrapReport = {
  patterns: TrapPattern[];
  /** Distinct URLs implicated in at least one pattern. */
  affectedUrls: number;
};

export type TrapThresholds = {
  /** Distinct query strings under one path before it counts as an explosion. */
  parameterExplosion: number;
  /** Distinct 3+-parameter combinations under one path. */
  facetCombination: number;
  /** Date-like URLs before a calendar is assumed. */
  calendar: number;
  /** Path segments before the depth is considered pathological. */
  maxDepth: number;
};

export const DEFAULT_TRAP_THRESHOLDS: TrapThresholds = {
  parameterExplosion: 25,
  facetCombination: 20,
  calendar: 15,
  maxDepth: 8,
};

/**
 * Parameters that identify a visitor or a campaign rather than content. Every
 * distinct value mints a duplicate of the same page.
 */
const SESSION_PARAMS = new Set([
  "sid",
  "sessionid",
  "session_id",
  "phpsessid",
  "jsessionid",
  "aspsessionid",
  "cfid",
  "cftoken",
  "zenid",
  "oscsid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "_ga",
]);

/** Parameter names that read as "narrow this list", not "show this thing". */
const FACET_PARAMS = new Set([
  "color",
  "colour",
  "size",
  "brand",
  "price",
  "min",
  "max",
  "min_price",
  "max_price",
  "sort",
  "sortby",
  "sort_by",
  "order",
  "orderby",
  "filter",
  "filters",
  "category",
  "tag",
  "style",
  "material",
  "rating",
  "availability",
]);

const DATE_PARAMS = new Set([
  "date",
  "day",
  "month",
  "year",
  "week",
  "cal",
  "calendar",
  "from",
  "to",
  "start",
  "end",
  "start_date",
  "end_date",
]);

const DATE_VALUE = /^\d{4}(-\d{1,2}){0,2}$/;
const YEAR_SEGMENT = /^(19|20)\d{2}$/;
const MONTH_SEGMENT = /^(0?[1-9]|1[0-2])$/;

type ParsedUrl = {
  raw: string;
  path: string;
  params: [name: string, value: string][];
  segments: string[];
};

function parse(urls: string[]): ParsedUrl[] {
  const parsed: ParsedUrl[] = [];
  for (const raw of urls) {
    try {
      const url = new URL(raw);
      parsed.push({
        raw,
        path: `${url.origin}${url.pathname}`,
        params: [...url.searchParams.entries()].map(([name, value]) => [
          name.toLowerCase(),
          value,
        ]),
        segments: url.pathname.split("/").filter(Boolean),
      });
    } catch {
      // A URL the crawler could not parse cannot be classified either.
    }
  }
  return parsed;
}

/**
 * Finds a segment repeated three or more times, or a block of up to three
 * segments repeated back to back — the signature of a relative link that
 * resolves one level deeper on every hop.
 */
function repeatingSegments(segments: string[]): string | null {
  const counts = new Map<string, number>();
  for (const segment of segments) {
    counts.set(segment, (counts.get(segment) ?? 0) + 1);
  }
  for (const [segment, count] of counts) {
    if (count >= 3) return `"${segment}" repeats ${count} times`;
  }

  for (let size = 1; size <= 3; size++) {
    for (let start = 0; start + size * 2 <= segments.length; start++) {
      const first = segments.slice(start, start + size).join("/");
      const second = segments.slice(start + size, start + size * 2).join("/");
      if (first === second) return `"/${first}" repeats back to back`;
    }
  }

  return null;
}

function looksLikeDate(parsed: ParsedUrl): boolean {
  for (const [name, value] of parsed.params) {
    if (DATE_PARAMS.has(name) && DATE_VALUE.test(value)) return true;
  }
  // /2027/03/ style archives.
  for (let i = 0; i < parsed.segments.length - 1; i++) {
    if (
      YEAR_SEGMENT.test(parsed.segments[i]) &&
      MONTH_SEGMENT.test(parsed.segments[i + 1])
    ) {
      return true;
    }
  }
  return false;
}

export function detectCrawlTraps(
  urls: string[],
  thresholds: TrapThresholds = DEFAULT_TRAP_THRESHOLDS,
): TrapReport {
  const parsed = parse(urls);
  const patterns: TrapPattern[] = [];
  const affected = new Set<string>();

  const record = (pattern: TrapPattern, matches: string[]) => {
    patterns.push(pattern);
    for (const url of matches) affected.add(url);
  };

  /* -------------------------------------------- parameters per path -- */
  const queriesByPath = new Map<string, Set<string>>();
  const comboByPath = new Map<string, Set<string>>();
  const urlsByPath = new Map<string, string[]>();

  for (const item of parsed) {
    if (item.params.length === 0) continue;

    const query = item.params
      .map(([name, value]) => `${name}=${value}`)
      .sort()
      .join("&");
    const queries = queriesByPath.get(item.path);
    if (queries) queries.add(query);
    else queriesByPath.set(item.path, new Set([query]));

    const bucket = urlsByPath.get(item.path);
    if (bucket) bucket.push(item.raw);
    else urlsByPath.set(item.path, [item.raw]);

    // Three or more filters on one URL is the shape of a faceted listing. What
    // multiplies is the *values*, not the names — a shop uses the same
    // color/size/sort keys on every combination — so distinct query strings
    // under such a path are what measure the explosion.
    const facets = new Set(
      item.params.map(([name]) => name).filter((name) => FACET_PARAMS.has(name)),
    );
    if (facets.size >= 3) {
      const combos = comboByPath.get(item.path);
      if (combos) combos.add(query);
      else comboByPath.set(item.path, new Set([query]));
    }
  }

  for (const [path, queries] of queriesByPath) {
    if (queries.size < thresholds.parameterExplosion) continue;
    const matches = urlsByPath.get(path) ?? [];
    record(
      {
        kind: "parameter_explosion",
        detail: `${queries.size} distinct query strings under one path`,
        urlCount: matches.length,
        example: matches[0] ?? path,
      },
      matches,
    );
  }

  for (const [path, combos] of comboByPath) {
    if (combos.size < thresholds.facetCombination) continue;
    const matches = urlsByPath.get(path) ?? [];
    record(
      {
        kind: "facet_combination",
        detail: `${combos.size} distinct filter combinations under one path — facet URLs multiply`,
        urlCount: matches.length,
        example: matches[0] ?? path,
      },
      matches,
    );
  }

  /* ------------------------------------------------ session parameters -- */
  const sessionMatches: string[] = [];
  const sessionNames = new Set<string>();
  for (const item of parsed) {
    const found = item.params
      .map(([name]) => name)
      .filter((name) => SESSION_PARAMS.has(name));
    if (found.length === 0) continue;
    sessionMatches.push(item.raw);
    for (const name of found) sessionNames.add(name);
  }
  if (sessionMatches.length > 0) {
    record(
      {
        kind: "session_parameter",
        detail: `Tracking or session parameters in internal links: ${[...sessionNames].join(", ")}`,
        urlCount: sessionMatches.length,
        example: sessionMatches[0],
      },
      sessionMatches,
    );
  }

  /* ------------------------------------------------------------ calendar -- */
  const calendarMatches = parsed.filter(looksLikeDate).map((item) => item.raw);
  if (calendarMatches.length >= thresholds.calendar) {
    record(
      {
        kind: "calendar",
        detail: `${calendarMatches.length} date-based URLs — calendars generate an endless space`,
        urlCount: calendarMatches.length,
        example: calendarMatches[0],
      },
      calendarMatches,
    );
  }

  /* ------------------------------------------------------- repeating path -- */
  const repeatMatches: string[] = [];
  let repeatDetail: string | null = null;
  for (const item of parsed) {
    const repeat = repeatingSegments(item.segments);
    if (!repeat) continue;
    repeatMatches.push(item.raw);
    repeatDetail ??= repeat;
  }
  if (repeatMatches.length > 0) {
    record(
      {
        kind: "repeating_path",
        detail: `Repeating path segments (${repeatDetail}) — usually a relative link resolving deeper on each hop`,
        urlCount: repeatMatches.length,
        example: repeatMatches[0],
      },
      repeatMatches,
    );
  }

  /* -------------------------------------------------------- excessive depth -- */
  const deepMatches = parsed
    .filter((item) => item.segments.length > thresholds.maxDepth)
    .map((item) => item.raw);
  if (deepMatches.length > 0) {
    record(
      {
        kind: "excessive_depth",
        detail: `${deepMatches.length} URLs deeper than ${thresholds.maxDepth} segments`,
        urlCount: deepMatches.length,
        example: deepMatches[0],
      },
      deepMatches,
    );
  }

  patterns.sort((a, b) => b.urlCount - a.urlCount);
  return { patterns, affectedUrls: affected.size };
}
