import { ExternalLink, Layers, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { ALL_COUNTRIES } from "@/lib/countries";
import "@/lib/search/providers";
import { getSearchProvider } from "@/lib/search/registry";
import {
  InvalidCredentialsError,
  QuotaExhaustedError,
  RateLimitedError,
  type SearchResponse,
} from "@/lib/search/types";
import { formatNumber } from "@/lib/utils";
import { CountryFlag } from "../domain-overview/country-select";
import { KeywordSearchForm } from "./search-form";

export const dynamic = "force-dynamic";

const countryName = new Map(ALL_COUNTRIES.map((c) => [c.code, c.name]));

/** What a search here can and cannot tell you, stated up front. */
const WHAT_IT_MEASURES = [
  {
    icon: <Search className="size-4 text-blue-500" />,
    title: "Live top results",
    body: "The organic results Google returns for the keyword in the chosen country — position, page, title and snippet — fetched when you press Search.",
  },
  {
    icon: <Layers className="size-4 text-violet-500" />,
    title: "SERP features",
    body: "Which extras appear alongside the organic results: answer box, People Also Ask, knowledge panel, ads. Position 1 under three of those is not position 1.",
  },
  {
    icon: <Sparkles className="size-4 text-amber-500" />,
    title: "Result count",
    body: "How many results the engine reports for the query, when it reports one.",
  },
];

type Outcome =
  | { state: "ok"; response: SearchResponse; provider: string }
  | { state: "unconfigured" }
  | { state: "error"; message: string };

async function lookup(keyword: string, country: string): Promise<Outcome> {
  const provider = await getSearchProvider();
  if (!provider) return { state: "unconfigured" };

  try {
    const response = await provider.search(keyword, {
      country: country === "WW" ? "US" : country,
      device: "desktop",
      limit: 10,
    });
    return { state: "ok", response, provider: provider.label };
  } catch (error) {
    if (error instanceof QuotaExhaustedError) {
      return { state: "error", message: error.message };
    }
    if (error instanceof InvalidCredentialsError) {
      return { state: "error", message: `${provider.label} rejected the configured credentials.` };
    }
    if (error instanceof RateLimitedError) {
      return { state: "error", message: `${provider.label} is rate limiting requests. Try again in a moment.` };
    }
    return {
      state: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function featureLabel(feature: string): string {
  return feature.replace(/_/g, " ");
}

export default async function KeywordOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; country?: string }>;
}) {
  const { q = "", country = "US" } = await searchParams;
  const keyword = q.trim();
  const outcome = keyword ? await lookup(keyword, country) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24 pt-2 text-foreground animate-in">
      <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-xs sm:p-10">
        <span className="block text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Keyword Research
        </span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Keyword Overview
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
          See the actual search results page for a keyword in any country, fetched live.
        </p>
        <div className="mt-7 text-left">
          <KeywordSearchForm variant="hero" initialKeyword={q} initialCountry={country} />
        </div>
      </div>

      {outcome?.state === "unconfigured" ? (
        <Empty
          icon={Search}
          title="No search provider configured"
          description="Fetching results needs a search API. Set SEARCH_PROVIDER and its key — Serper, SerpApi or DataForSEO are supported — and this page will query it live."
          action={
            <Button variant="secondary" size="sm" className="rounded-[6px]" asChild>
              <Link href="/settings">Open settings</Link>
            </Button>
          }
        />
      ) : null}

      {outcome?.state === "error" ? (
        <div className="rounded-2xl border border-critical/40 bg-surface p-6 shadow-xs">
          <p className="text-[14px] font-medium text-critical">
            Could not fetch results for &ldquo;{keyword}&rdquo;
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">{outcome.message}</p>
        </div>
      ) : null}

      {outcome?.state === "ok" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
                <span>Results for</span>
                <span className="text-blue-600 dark:text-blue-400">&ldquo;{keyword}&rdquo;</span>
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CountryFlag code={country} />
                  {countryName.get(country) ?? country}
                </span>
                <span>Desktop · Google</span>
                <span>via {outcome.provider}</span>
                {outcome.response.totalResults !== null ? (
                  <span>{formatNumber(outcome.response.totalResults)} results reported</span>
                ) : null}
              </div>
            </div>
            {outcome.response.features.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  SERP features
                </span>
                {outcome.response.features.map((feature) => (
                  <Badge key={feature} tone="accent">
                    {featureLabel(feature)}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          {outcome.response.results.length === 0 ? (
            <Empty
              icon={Search}
              title="No organic results returned"
              description="The provider answered but returned no organic listings for this keyword and country."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="w-14 px-4 py-3 text-center">Pos</th>
                    <th className="px-4 py-3">Page</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {outcome.response.results.map((result) => (
                    <tr key={`${result.position}-${result.url}`} className="align-top hover:bg-surface-muted/40">
                      <td className="px-4 py-3.5 text-center text-[15px] font-extrabold tabular-nums text-foreground">
                        {result.position}
                      </td>
                      <td className="px-4 py-3.5">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-start gap-1.5 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <span>{result.title ?? result.url}</span>
                          <ExternalLink className="mt-1 size-3 shrink-0 opacity-60" />
                        </a>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {result.displayUrl ?? result.url}
                        </span>
                        {result.description ? (
                          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
                            {result.description}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-subtle-foreground">
            Search volume, keyword difficulty, CPC and trend are absent because they require a
            licensed keyword database this tool does not have. Every figure above comes from
            the request made when you pressed Search; each search spends one API credit.
          </p>
        </>
      ) : null}

      {!outcome ? (
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-xs">
          <h2 className="text-[15px] font-bold tracking-tight text-foreground">What gets measured</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Every figure comes from a request made when you press Search. Nothing is estimated
            or cached.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {WHAT_IT_MEASURES.map((item) => (
              <div key={item.title} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span className="text-[13px] font-bold text-foreground">{item.title}</span>
                </div>
                <p className="text-[12px] leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-subtle-foreground">
            Search volume, keyword difficulty, CPC and trend are deliberately absent: they
            require a licensed keyword database, and estimating them would mean showing numbers
            that are not measured.
          </p>
        </div>
      ) : null}
    </div>
  );
}
