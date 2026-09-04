import { AlertTriangle, ExternalLink, Globe2, Lock, Mail, Smartphone, Bot } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { analyzeDomain, resolveDomainInput, type DomainOverviewResult } from "@/lib/domain-overview";
import { formatNumber, hostnameOf } from "@/lib/utils";
import { CompareDomainsForm } from "./compare-form";

export const dynamic = "force-dynamic";

const MAX_DOMAINS = 5;

const WHAT_IT_MEASURES = [
  {
    icon: <Globe2 className="size-4 text-sky-500" />,
    title: "Indexability & discovery",
    body: "robots.txt, declared sitemaps and the URLs they list, llms.txt, canonical and indexing directives — side by side.",
  },
  {
    icon: <Lock className="size-4 text-emerald-500" />,
    title: "Security & delivery",
    body: "HTTPS, HSTS, the six standard security headers and homepage response time, measured for each domain.",
  },
  {
    icon: <Bot className="size-4 text-violet-500" />,
    title: "AI crawler access",
    body: "How many of the tracked AI and search crawlers each robots.txt allows.",
  },
  {
    icon: <Smartphone className="size-4 text-teal-500" />,
    title: "Mobile vs desktop",
    body: "Whether each homepage serves the same title, canonical and content to a phone and a desktop browser.",
  },
];

type Column =
  | { domain: string; state: "ok"; result: DomainOverviewResult }
  | { domain: string; state: "failed"; message: string };

const COLUMN_TONES = [
  "text-indigo-600 dark:text-indigo-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-amber-600 dark:text-amber-400",
  "text-purple-600 dark:text-purple-400",
  "text-pink-600 dark:text-pink-400",
];

async function analyze(domain: string, country: string): Promise<Column> {
  try {
    const result = await analyzeDomain(domain, { country });
    return { domain, state: "ok", result };
  } catch (error) {
    return {
      domain,
      state: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** A measured value per column, or a reason it could not be measured. */
type Cell = { text: string; tone?: "good" | "bad" | "muted" };

type Metric = {
  label: string;
  cell: (result: DomainOverviewResult) => Cell;
};

const yesNo = (value: boolean, goodWhen = true): Cell => ({
  text: value ? "Yes" : "No",
  tone: value === goodWhen ? "good" : "bad",
});

const METRICS: Metric[] = [
  {
    label: "Homepage",
    cell: (r) => {
      if (r.error) return { text: "Unreachable", tone: "bad" };
      if (r.blocked) return { text: "Blocked the crawler", tone: "bad" };
      const status = r.homepage?.statusCode;
      return {
        text: status ? `HTTP ${status}` : "No response",
        tone: status && status < 400 ? "good" : "bad",
      };
    },
  },
  {
    label: "HTTPS",
    cell: (r) => (r.homepage ? yesNo(r.homepage.isHttps) : { text: "—", tone: "muted" }),
  },
  {
    label: "HSTS",
    cell: (r) => (r.homepage ? yesNo(r.homepage.hasHsts) : { text: "—", tone: "muted" }),
  },
  {
    label: "Security headers",
    cell: (r) =>
      r.security
        ? {
            text: `${r.security.present} of ${r.security.total}`,
            tone: r.security.present >= 3 ? "good" : "bad",
          }
        : { text: "—", tone: "muted" },
  },
  {
    label: "Response time",
    cell: (r) => {
      if (r.responseTimeSamples.length === 0) return { text: "—", tone: "muted" };
      const min = Math.min(...r.responseTimeSamples);
      const max = Math.max(...r.responseTimeSamples);
      return {
        text: min === max ? `${min} ms` : `${min}–${max} ms`,
        tone: max <= 2000 ? "good" : "bad",
      };
    },
  },
  { label: "robots.txt", cell: (r) => yesNo(r.robotsTxtFound) },
  {
    label: "Sitemap URLs",
    cell: (r) =>
      r.declaredSitemaps > 0
        ? { text: `${formatNumber(r.sitemapUrlCount)} in ${r.declaredSitemaps}`, tone: "good" }
        : { text: "None declared", tone: "bad" },
  },
  { label: "llms.txt", cell: (r) => yesNo(r.llmsTxtFound) },
  {
    label: "AI crawlers allowed",
    cell: (r) => {
      const ai = r.botAccess.filter((bot) => bot.group === "ai");
      if (ai.length === 0) return { text: "—", tone: "muted" };
      const allowed = ai.filter((bot) => bot.allowed).length;
      return {
        text: `${allowed} of ${ai.length}`,
        tone: allowed === ai.length ? "good" : allowed === 0 ? "bad" : undefined,
      };
    },
  },
  {
    label: "Indexable",
    cell: (r) =>
      r.homepage ? yesNo(!r.homepage.isNoindex) : { text: "—", tone: "muted" },
  },
  {
    label: "Structured data",
    cell: (r) =>
      r.homepage
        ? r.homepage.structuredDataTypes.length > 0
          ? { text: r.homepage.structuredDataTypes.slice(0, 3).join(", "), tone: "good" }
          : { text: "None", tone: "bad" }
        : { text: "—", tone: "muted" },
  },
  {
    label: "Homepage words",
    cell: (r) =>
      r.homepage ? { text: formatNumber(r.homepage.wordCount) } : { text: "—", tone: "muted" },
  },
  {
    label: "Mobile vs desktop",
    cell: (r) =>
      !r.parityChecked
        ? { text: "Not checked", tone: "muted" }
        : r.parity.length === 0
          ? { text: "Match", tone: "good" }
          : { text: `${r.parity.length} differences`, tone: "bad" },
  },
  {
    label: "Issues found",
    cell: (r) => ({
      text: String(r.issues.length),
      tone: r.issues.length === 0 ? "good" : undefined,
    }),
  },
];

function CellValue({ cell }: { cell: Cell }) {
  const tone =
    cell.tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : cell.tone === "bad"
        ? "text-red-600 dark:text-red-400"
        : cell.tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return <span className={`text-[13px] font-semibold ${tone}`}>{cell.text}</span>;
}

export default async function CompareDomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ domains?: string; country?: string }>;
}) {
  const { domains: domainQuery = "", country = "US" } = await searchParams;

  const [firstProject] = await db
    .select({ domain: projects.domain })
    .from(projects)
    .orderBy(projects.name)
    .limit(1);

  const defaultDomain = firstProject
    ? hostnameOf(firstProject.domain) || firstProject.domain
    : "";

  const requested = domainQuery
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .slice(0, MAX_DOMAINS);

  const invalid = requested.filter((d) => !resolveDomainInput(d));
  const domains = requested.filter((d) => resolveDomainInput(d));

  // Each domain is a different host with its own politeness budget, so they
  // are analysed concurrently rather than one after another.
  const columns =
    domains.length > 0
      ? await Promise.all(domains.map((domain) => analyze(domain, country)))
      : [];

  const hasReport = columns.length > 0;

  return (
    <div className="space-y-6 pb-24 pt-1 text-foreground animate-in">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span>&gt;</span>
            <Link href="/" className="hover:text-foreground">
              SEO
            </Link>
            <span>&gt;</span>
            <Link href="/domain-overview" className="hover:text-foreground">
              Domain Overview
            </Link>
            <span>&gt;</span>
            <span className="font-semibold text-foreground">Compare Domains</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Compare Domains</h1>
          {hasReport ? (
            <p className="mt-1 text-[13px] text-muted-foreground">
              Each domain was fetched live just now. Nothing is estimated or cached.
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <button className="hidden items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:underline sm:inline-flex dark:text-blue-400">
            <Mail className="size-3.5" />
            Send feedback
          </button>
          {hasReport ? (
            <Button variant="secondary" size="sm" className="h-8 rounded-[6px] px-3 text-[12px]" asChild>
              <Link href="/compare-domains">New comparison</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs sm:p-8">
        <p className="mb-5 text-[13px] text-muted-foreground">
          Enter up to five domains. Each is fetched and analysed when you press Compare.
        </p>
        <CompareDomainsForm
          defaultDomain={defaultDomain}
          initialDomains={requested.length >= 2 ? requested : undefined}
          initialCountry={country}
        />
      </div>

      {invalid.length > 0 ? (
        <div className="rounded-2xl border border-critical/40 bg-surface p-5 shadow-xs">
          <p className="flex items-center gap-2 text-[13px] font-medium text-critical">
            <AlertTriangle className="size-4" />
            Skipped {invalid.map((d) => `“${d}”`).join(", ")} — not a domain this can analyse.
          </p>
        </div>
      ) : null}

      {hasReport ? (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60">
                    <th className="w-44 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Measured
                    </th>
                    {columns.map((column, index) => (
                      <th key={column.domain} className="px-4 py-3">
                        <a
                          href={`https://${column.domain.replace(/^https?:\/\//, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex items-center gap-1 text-[13px] font-bold hover:underline ${COLUMN_TONES[index]}`}
                        >
                          {column.state === "ok" ? column.result.host : column.domain}
                          <ExternalLink className="size-3 opacity-60" />
                        </a>
                        {column.state === "failed" ? (
                          <span className="mt-1 block text-[11px] font-normal text-critical">
                            {column.message}
                          </span>
                        ) : column.result.blocked ? (
                          <Badge tone="warning">Blocked the crawler</Badge>
                        ) : column.result.error ? (
                          <span className="mt-1 block text-[11px] font-normal text-critical">
                            {column.result.error}
                          </span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {METRICS.map((metric) => (
                    <tr key={metric.label} className="hover:bg-surface-muted/40">
                      <td className="px-4 py-3 text-[12px] font-medium text-muted-foreground">
                        {metric.label}
                      </td>
                      {columns.map((column) => (
                        <td key={column.domain} className="px-4 py-3">
                          {column.state === "ok" ? (
                            <CellValue cell={metric.cell(column.result)} />
                          ) : (
                            <CellValue cell={{ text: "—", tone: "muted" }} />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-subtle-foreground">
            Organic traffic, keyword counts, backlink totals and authority scores are absent
            because they require a licensed search index this tool does not have. Estimating
            them would mean showing numbers that are not measured.
          </p>
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-xs">
          <h2 className="text-[15px] font-bold tracking-tight text-foreground">What gets compared</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Every figure comes from requests made when you press Compare. Nothing is estimated or
            cached.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
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
            Organic traffic, keyword counts, backlink totals and authority scores are deliberately
            absent: they require a licensed search index, and estimating them would mean showing
            numbers that are not measured.
          </p>
        </div>
      )}
    </div>
  );
}
