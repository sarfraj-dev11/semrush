import type { HreflangLink } from "./types";

/**
 * hreflang validation.
 *
 * hreflang is the one part of technical SEO that cannot be checked a page at a
 * time: a declaration is only valid if the page it points at points back. That
 * makes it a graph problem, and it is why broken hreflang setups survive for
 * years — a per-page tool sees nothing wrong on either page.
 *
 * Pure: the whole crawl is passed in, no I/O.
 */

/** ISO 639-1 two-letter language codes. */
const ISO_639_1 = new Set(
  ("aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy " +
    "da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu " +
    "hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb " +
    "lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om " +
    "or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw " +
    "ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu"
  ).split(" "),
);

export type HreflangPage = {
  url: string;
  /** Alternates this page declares. */
  links: HreflangLink[];
  canonical: string | null;
  statusCode: number | null;
  isNoindex: boolean;
};

export type HreflangProblem = {
  url: string;
  code: string;
  detail: string;
};

export type HreflangReport = {
  problems: HreflangProblem[];
  /** Distinct region codes the site declares, e.g. ["GB", "DE"]. */
  regions: string[];
  /** Distinct language codes declared. */
  languages: string[];
  /** Pages that take part in the hreflang graph. */
  participating: number;
};

/**
 * Splits "en-GB" into its parts. Returns null when the shape itself is wrong,
 * which is a different failure from a well-shaped but unknown code.
 */
export function parseHreflang(
  code: string,
): { language: string; region: string | null } | null {
  if (code === "x-default") return { language: "x-default", region: null };

  const match = /^([a-z]{2,3})(?:-([a-z]{2}|[0-9]{3}))?$/i.exec(code.trim());
  if (!match) return null;

  return {
    language: match[1].toLowerCase(),
    region: match[2]?.toUpperCase() ?? null,
  };
}

export function auditHreflang(
  pages: HreflangPage[],
  validRegions: Set<string>,
): HreflangReport {
  const problems: HreflangProblem[] = [];
  const regions = new Set<string>();
  const languages = new Set<string>();

  const byUrl = new Map(pages.map((page) => [page.url, page]));
  const participants = pages.filter((page) => page.links.length > 0);

  for (const page of participants) {
    const seen = new Set<string>();
    let declaresSelf = false;

    for (const link of page.links) {
      /* -- duplicate declarations --------------------------------------- */
      if (seen.has(link.code)) {
        problems.push({
          url: page.url,
          code: "hreflang_duplicate",
          detail: `"${link.code}" is declared more than once`,
        });
        continue;
      }
      seen.add(link.code);

      /* -- code validity ------------------------------------------------- */
      const parsed = parseHreflang(link.code);
      if (!parsed) {
        problems.push({
          url: page.url,
          code: "hreflang_invalid_code",
          detail: `"${link.code}" is not a valid hreflang value`,
        });
        continue;
      }

      if (parsed.language !== "x-default") {
        if (!ISO_639_1.has(parsed.language)) {
          problems.push({
            url: page.url,
            code: "hreflang_invalid_code",
            detail: `"${parsed.language}" is not an ISO 639-1 language code`,
          });
          continue;
        }
        languages.add(parsed.language);

        // A very common mistake is a country used where a language belongs,
        // e.g. hreflang="uk" for the United Kingdom (uk is Ukrainian).
        if (parsed.region) {
          if (!validRegions.has(parsed.region)) {
            problems.push({
              url: page.url,
              code: "hreflang_invalid_code",
              detail: `"${parsed.region}" is not an ISO 3166-1 country code`,
            });
            continue;
          }
          regions.add(parsed.region);
        }
      }

      if (link.href === page.url) declaresSelf = true;

      /* -- target health ------------------------------------------------- */
      const target = byUrl.get(link.href);
      if (target) {
        if (target.statusCode !== null && target.statusCode >= 400) {
          problems.push({
            url: page.url,
            code: "hreflang_broken_target",
            detail: `"${link.code}" points at ${link.href}, which returns ${target.statusCode}`,
          });
          continue;
        }

        if (target.isNoindex) {
          problems.push({
            url: page.url,
            code: "hreflang_broken_target",
            detail: `"${link.code}" points at a noindex page: ${link.href}`,
          });
          continue;
        }

        /* -- return link (reciprocity) ---------------------------------- */
        // Skip x-default: it is a fallback pointer, not a mutual declaration.
        if (link.code !== "x-default" && link.href !== page.url) {
          const returns = target.links.some((back) => back.href === page.url);
          if (!returns) {
            problems.push({
              url: page.url,
              code: "hreflang_no_return_link",
              detail: `${link.href} is declared as the "${link.code}" alternate but does not link back`,
            });
          }
        }

        /* -- canonical conflict ----------------------------------------- */
        // An alternate that canonicalises somewhere else cancels the hreflang.
        if (
          target.canonical &&
          target.canonical !== link.href &&
          link.code !== "x-default"
        ) {
          problems.push({
            url: page.url,
            code: "hreflang_conflicts_canonical",
            detail: `The "${link.code}" alternate canonicalises to ${target.canonical}`,
          });
        }
      }
    }

    /* -- self reference -------------------------------------------------- */
    if (!declaresSelf) {
      problems.push({
        url: page.url,
        code: "hreflang_missing_self",
        detail: "The page does not list itself among its own alternates",
      });
    }
  }

  return {
    problems,
    regions: [...regions].sort(),
    languages: [...languages].sort(),
    participating: participants.length,
  };
}
