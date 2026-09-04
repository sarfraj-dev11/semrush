import { Bot, Globe2, Lock, Search, Smartphone, Zap } from "lucide-react";
import { Suspense } from "react";
import { resolveDomainInput } from "@/lib/domain-overview";
import { DomainReport } from "./domain-report";
import { DomainSearchForm } from "./domain-search-form";
import { ReportSkeleton } from "./report-skeleton";

export const dynamic = "force-dynamic";

const WHAT_IT_MEASURES = [
  {
    icon: <Globe2 className="size-4 text-sky-500" />,
    title: "Indexability & discovery",
    body: "robots.txt, declared sitemaps and how many URLs they actually list, llms.txt, canonical and indexing directives.",
  },
  {
    icon: <Lock className="size-4 text-emerald-500" />,
    title: "Security & delivery",
    body: "HTTPS, HSTS, the six standard security headers, the CDN in front of the site and its caching policy.",
  },
  {
    icon: <Smartphone className="size-4 text-teal-500" />,
    title: "Mobile vs desktop",
    body: "The homepage fetched as both a phone and a desktop browser, compared for title, canonical, indexing and content.",
  },
  {
    icon: <Bot className="size-4 text-violet-500" />,
    title: "AI crawler access",
    body: "Which AI and search crawlers robots.txt allows, evaluated per bot rather than as a single verdict.",
  },
  {
    icon: <Zap className="size-4 text-amber-500" />,
    title: "Markup & on-page",
    body: "Title, meta description, Open Graph, structured data, heading structure, image alt coverage and link counts.",
  },
  {
    icon: <Search className="size-4 text-blue-500" />,
    title: "Search visibility",
    body: "Optional. Where the domain ranks for its own name and which pages Google returns for it. Uses API credits.",
  },
];

export default async function DomainOverviewPage({
  searchParams,
}: PageProps<"/domain-overview">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";
  const country = typeof params.country === "string" ? params.country : "WW";
  const includeSearch = params.search === "1";

  const resolved = domain ? resolveDomainInput(domain) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20 pt-2 animate-in">
      <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-xs sm:p-10">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Domain Overview
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
          Enter any domain and it is fetched live — homepage, robots.txt, sitemaps and
          the mobile rendition — and analysed on the spot.
        </p>
        <div className="mt-7">
          <DomainSearchForm defaultDomain={domain} defaultCountry={country} />
        </div>
      </div>

      {domain && !resolved ? (
        <div className="rounded-2xl border border-critical/40 bg-surface p-6 shadow-xs">
          <p className="text-[14px] font-medium text-critical">
            &ldquo;{domain}&rdquo; is not a domain this can analyse.
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Try something like example.com or https://example.com/pricing.
          </p>
        </div>
      ) : null}

      {resolved ? (
        // Keyed on the query so a new search restarts the skeleton instead of
        // holding the previous report on screen while the next one loads.
        <Suspense
          key={`${domain}-${country}-${includeSearch}`}
          fallback={<ReportSkeleton host={resolved.host} />}
        >
          <DomainReport
            domain={domain}
            country={country}
            includeSearch={includeSearch}
          />
        </Suspense>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-xs">
          <h2 className="text-[15px] font-bold tracking-tight text-foreground">
            What gets measured
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Every figure comes from a request made when you press Search. Nothing is
            estimated or cached.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHAT_IT_MEASURES.map((item) => (
              <div key={item.title} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span className="text-[13px] font-bold text-foreground">
                    {item.title}
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-subtle-foreground">
            Traffic volume, authority scores and keyword counts are deliberately absent:
            they require a licensed search index, and estimating them would mean showing
            numbers that are not measured.
          </p>
        </div>
      )}
    </div>
  );
}
