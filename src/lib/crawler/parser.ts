import * as cheerio from "cheerio";
import type {
  ExtractedLink,
  ExtractedPage,
  FragmentTarget,
  HreflangLink,
} from "./types";

/**
 * Caps on the anchor data kept per page. A generated documentation page can
 * carry thousands of ids, and storing all of them would bloat every row to
 * answer a question a few hundred already answers.
 */
const MAX_ELEMENT_IDS = 500;
const MAX_FRAGMENT_LINKS = 200;

/** Strips the fragment and normalizes the trailing empty query. */
export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const url = base ? new URL(raw, base) : new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    if (url.search === "?") url.search = "";
    // A bare origin and the same origin with "/" are the same page.
    if (url.pathname === "") url.pathname = "/";
    return url.toString();
  } catch {
    return null;
  }
}

function collectStructuredDataTypes(json: unknown, into: Set<string>) {
  if (Array.isArray(json)) {
    for (const entry of json) collectStructuredDataTypes(entry, into);
    return;
  }
  if (!json || typeof json !== "object") return;

  const record = json as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string") into.add(type);
  else if (Array.isArray(type)) {
    for (const entry of type) if (typeof entry === "string") into.add(entry);
  }

  if (Array.isArray(record["@graph"])) {
    collectStructuredDataTypes(record["@graph"], into);
  }
}

/**
 * HTML5 landmarks. Their presence is what lets an extractive reader tell the
 * article from the navigation, so AI-search readiness leans on this heavily.
 */
const SEMANTIC_TAGS = [
  "main",
  "article",
  "section",
  "nav",
  "header",
  "footer",
  "aside",
  "figure",
  "time",
] as const;

/** Attributes that pull a sub-resource onto the page. */
const RESOURCE_ATTRS: [selector: string, attr: string][] = [
  ["img[src]", "src"],
  ["script[src]", "src"],
  ["link[href]", "href"],
  ["iframe[src]", "src"],
  ["video[src]", "src"],
  ["audio[src]", "src"],
  ["source[src]", "src"],
];

/**
 * Walks JSON-LD for country and currency signals. `addressCountry` says where a
 * business is, `areaServed` says who it serves, and `priceCurrency` is often the
 * only country signal an otherwise language-neutral shop page carries.
 */
function collectGeoSignals(
  json: unknown,
  countries: Set<string>,
  currencies: Set<string>,
) {
  if (Array.isArray(json)) {
    for (const entry of json) collectGeoSignals(entry, countries, currencies);
    return;
  }
  if (!json || typeof json !== "object") return;

  const record = json as Record<string, unknown>;

  for (const key of ["addressCountry", "areaServed", "countryOfOrigin"]) {
    const value = record[key];
    if (typeof value === "string" && value.length <= 3) {
      countries.add(value.toUpperCase());
    } else if (value && typeof value === "object") {
      const name = (value as Record<string, unknown>).name;
      if (typeof name === "string" && name.length <= 3) {
        countries.add(name.toUpperCase());
      }
    }
  }

  const currency = record["priceCurrency"];
  if (typeof currency === "string") currencies.add(currency.toUpperCase());

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      collectGeoSignals(value, countries, currencies);
    }
  }
}

export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  // <base href> changes how every relative link on the page resolves.
  const baseHref = $("base[href]").first().attr("href");
  const resolveBase = baseHref
    ? (normalizeUrl(baseHref, pageUrl) ?? pageUrl)
    : pageUrl;

  const pageHost = (() => {
    try {
      return new URL(pageUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  const pageIsHttps = (() => {
    try {
      return new URL(pageUrl).protocol === "https:";
    } catch {
      return false;
    }
  })();

  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').first().attr("content")?.trim() || null;

  const h1 = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const headingLevels = $("h1, h2, h3, h4, h5, h6")
    .map((_, el) => Number((el as { tagName: string }).tagName.slice(1)))
    .get();

  let headingOrderBroken = false;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      headingOrderBroken = true;
      break;
    }
  }

  const canonicalRaw = $('link[rel="canonical"]').first().attr("href");
  const canonical = canonicalRaw
    ? normalizeUrl(canonicalRaw, resolveBase)
    : null;

  const metaRobots =
    $('meta[name="robots"]').first().attr("content")?.trim().toLowerCase() ||
    null;

  const structuredData = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    try {
      collectStructuredDataTypes(JSON.parse(raw), structuredData);
    } catch {
      // Malformed JSON-LD is common; it simply contributes no types.
    }
  });

  const images = $("img");
  const imagesMissingAlt = images.filter((_, el) => {
    const alt = $(el).attr("alt");
    // An explicit empty alt marks a decorative image and is correct.
    return alt === undefined;
  }).length;

  const imageUrls = [
    ...new Set(
      images
        .map((_, el) => {
          const src = $(el).attr("src");
          // srcset entries are "url descriptor" pairs; the first URL is enough
          // to tell whether the asset exists at all.
          const fallback = $(el).attr("srcset")?.split(",")[0]?.trim().split(/\s+/)[0];
          return normalizeUrl(src || fallback || "", resolveBase) ?? "";
        })
        .get()
        .filter(Boolean),
    ),
  ];

  const body = $("body").clone();
  body.find("script, style, noscript, template").remove();
  const wordCount = body
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

  const semanticTagCount = SEMANTIC_TAGS.filter((tag) => $(tag).length > 0).length;

  // Only https pages can have mixed content; an http page is insecure outright
  // and is reported as such instead.
  let mixedContentCount = 0;
  if (pageIsHttps) {
    for (const [selector, attr] of RESOURCE_ATTRS) {
      $(selector).each((_, el) => {
        const value = $(el).attr(attr);
        if (!value) return;
        const resolved = normalizeUrl(value, resolveBase);
        if (resolved?.startsWith("http://")) mixedContentCount++;
      });
    }
  }

  const hreflangLinks: HreflangLink[] = [];
  $("link[rel='alternate'][hreflang]").each((_, el) => {
    const code = $(el).attr("hreflang")?.trim().toLowerCase();
    const href = $(el).attr("href")?.trim();
    if (!code || !href) return;
    const resolved = normalizeUrl(href, resolveBase);
    if (!resolved) return;
    hreflangLinks.push({ code, href: resolved });
  });

  const hreflangs = hreflangLinks.map((link) => link.code);

  // geo.region is a legacy signal, but plenty of CMSes still emit it and it is
  // the site telling us which country it thinks it is for.
  const geoRegion =
    $('meta[name="geo.region"]').first().attr("content")?.trim().toUpperCase() ||
    null;

  // Country and currency signals hiding inside JSON-LD.
  const schemaCountries = new Set<string>();
  const currencies = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    try {
      collectGeoSignals(JSON.parse(raw), schemaCountries, currencies);
    } catch {
      // Malformed JSON-LD contributes nothing, same as for @type collection.
    }
  });

  // Anchor targets a #fragment can legitimately point at. `name` is the legacy
  // form and browsers still honour it, so both count.
  const elementIds = [
    ...new Set([
      ...$("[id]")
        .map((_, el) => $(el).attr("id"))
        .get(),
      ...$("a[name]")
        .map((_, el) => $(el).attr("name"))
        .get(),
    ]),
  ]
    .filter((id): id is string => Boolean(id))
    .slice(0, MAX_ELEMENT_IDS);

  const seenLinks = new Set<string>();
  const seenFragments = new Set<string>();
  const links: ExtractedLink[] = [];
  const fragmentLinks: FragmentTarget[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const url = normalizeUrl(href, resolveBase);

    // Captured before the fragment is stripped: `links` deliberately holds
    // fragment-free URLs so the frontier never queues one page twice.
    if (url) {
      try {
        const withFragment = new URL(href, resolveBase);
        if (withFragment.hash.length > 1) {
          const fragment = withFragment.hash.slice(1);
          const key = `${url}#${fragment}`;
          if (!seenFragments.has(key) && fragmentLinks.length < MAX_FRAGMENT_LINKS) {
            seenFragments.add(key);
            fragmentLinks.push({ url, fragment });
          }
        }
      } catch {
        // An unparseable href yields no fragment to check.
      }
    }

    if (!url || seenLinks.has(url)) return;
    seenLinks.add(url);

    let isInternal = false;
    try {
      isInternal = new URL(url).hostname.replace(/^www\./, "") === pageHost;
    } catch {
      return;
    }

    links.push({
      url,
      anchorText: $(el).text().trim().slice(0, 300) || null,
      rel: $(el).attr("rel")?.trim() || null,
      isInternal,
    });
  });

  return {
    title,
    metaDescription,
    h1,
    h2Count: $("h2").length,
    headingOrderBroken,
    canonical,
    metaRobots,
    isNoindex: Boolean(metaRobots?.includes("noindex")),
    isNofollow: Boolean(metaRobots?.includes("nofollow")),
    ogTitle: $('meta[property="og:title"]').first().attr("content")?.trim() || null,
    ogDescription:
      $('meta[property="og:description"]').first().attr("content")?.trim() ||
      null,
    ogImage: $('meta[property="og:image"]').first().attr("content")?.trim() || null,
    twitterCard:
      $('meta[name="twitter:card"]').first().attr("content")?.trim() || null,
    lang: $("html").attr("lang")?.trim() || null,
    hreflangCount: hreflangs.length,
    hreflangs,
    hreflangLinks,
    geoRegion,
    schemaCountries: [...schemaCountries],
    currencies: [...currencies],
    structuredDataTypes: [...structuredData],
    wordCount,
    imageCount: images.length,
    imagesMissingAlt,
    imageUrls,
    semanticTagCount,
    mixedContentCount,
    links,
    elementIds,
    fragmentLinks,
  };
}
