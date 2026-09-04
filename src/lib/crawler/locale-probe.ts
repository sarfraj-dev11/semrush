import { DEFAULT_USER_AGENT } from "./fetcher";
import type { HostThrottle } from "./throttle";

/**
 * Locale probing.
 *
 * Requests one URL several times with different Accept-Language headers to see
 * whether the site changes its answer. This matters because the single most
 * damaging international-SEO mistake is an automatic redirect based on the
 * visitor's locale: Googlebot crawls predominantly from the US, so a site that
 * force-redirects every non-matching visitor gets only its US variant indexed
 * and the other language versions never appear at all.
 *
 * This is not the same as crawling from another country — that needs an exit
 * node in each country. It does catch header-driven redirects, which is the
 * majority of the problem and costs four extra requests.
 */

export type LocaleProbe = {
  acceptLanguage: string;
  label: string;
  statusCode: number | null;
  /** Location header when the site redirected. */
  redirectedTo: string | null;
  contentLanguage: string | null;
  error: string | null;
};

export type LocaleReport = {
  probes: LocaleProbe[];
  /** True when at least one locale was redirected somewhere different. */
  forcesRedirect: boolean;
  /** Distinct redirect destinations seen across locales. */
  destinations: string[];
  /** True when the site varied its response by language at all. */
  variesByLanguage: boolean;
};

/** A spread of major markets rather than an exhaustive list. */
const PROBE_LOCALES: { acceptLanguage: string; label: string }[] = [
  { acceptLanguage: "en-US,en;q=0.9", label: "United States" },
  { acceptLanguage: "en-GB,en;q=0.9", label: "United Kingdom" },
  { acceptLanguage: "de-DE,de;q=0.9", label: "Germany" },
  { acceptLanguage: "fr-FR,fr;q=0.9", label: "France" },
  { acceptLanguage: "hi-IN,hi;q=0.9,en;q=0.8", label: "India" },
];

export async function probeLocales(
  url: string,
  options: {
    userAgent?: string;
    timeoutMs?: number;
    throttle?: HostThrottle;
    locales?: { acceptLanguage: string; label: string }[];
  } = {},
): Promise<LocaleReport> {
  const {
    userAgent = DEFAULT_USER_AGENT,
    timeoutMs = 15_000,
    throttle,
    locales = PROBE_LOCALES,
  } = options;

  const probes: LocaleProbe[] = [];

  // Sequential on purpose: these all hit the same host, and five simultaneous
  // requests to one origin is exactly the burst the throttle exists to prevent.
  for (const locale of locales) {
    const request = async (): Promise<LocaleProbe> => {
      try {
        const response = await fetch(url, {
          // Manual, so the redirect itself is the observation.
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            "User-Agent": userAgent,
            "Accept-Language": locale.acceptLanguage,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
        await response.arrayBuffer().catch(() => undefined);

        const location = response.headers.get("location");
        const isRedirect = response.status >= 300 && response.status < 400;

        return {
          ...locale,
          statusCode: response.status,
          redirectedTo: isRedirect && location ? new URL(location, url).toString() : null,
          contentLanguage: response.headers.get("content-language"),
          error: null,
        };
      } catch (error) {
        return {
          ...locale,
          statusCode: null,
          redirectedTo: null,
          contentLanguage: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };

    const probe = throttle ? await throttle.run(url, request) : await request();
    throttle?.observe(url, probe.statusCode, null);
    probes.push(probe);
  }

  // The outcome per locale: where it landed, or "" for no redirect at all.
  // A site that sends every locale to the same place is doing a plain redirect
  // (root → default page, http → https, trailing slash), which says nothing
  // about geography. Only a difference *between* locales is locale behaviour.
  const outcomes = probes.map((probe) =>
    probe.redirectedTo && probe.redirectedTo !== url ? probe.redirectedTo : "",
  );

  const distinctOutcomes = new Set(outcomes);
  const forcesRedirect = distinctOutcomes.size > 1;

  const destinations = forcesRedirect
    ? [...distinctOutcomes].filter(Boolean)
    : [];

  const languages = new Set(
    probes.map((probe) => probe.contentLanguage ?? "").filter(Boolean),
  );

  return {
    probes,
    forcesRedirect,
    destinations,
    variesByLanguage: forcesRedirect || languages.size > 1,
  };
}
