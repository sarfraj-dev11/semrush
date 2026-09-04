import { desc } from "drizzle-orm";
import { ChevronDown, Mail, Plus, Search, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { crawls, projects, type Crawl } from "@/db/schema";
import { toProjectSlug } from "@/lib/slug-utils";
import { formatRelative, hostnameOf } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** A measured value plus its movement since the previous completed crawl. */
type Metric = {
  value: number | null;
  previous: number | null;
  /** Percentages render with a % sign; counts do not. */
  kind: "percent" | "count";
  /** For counts, fewer is better; for scores, more is better. */
  lowerIsBetter?: boolean;
  /** Shown instead of a number when the metric could not be measured. */
  emptyLabel?: string;
};

function MetricCell({ metric }: { metric: Metric }) {
  const { value, previous, kind, lowerIsBetter = false } = metric;

  if (value === null) {
    return (
      <td className="py-3 px-3 text-center text-[11px] text-muted-foreground">
        {metric.emptyLabel ?? "—"}
      </td>
    );
  }

  const rounded = Math.round(value);
  const delta = previous === null ? null : rounded - Math.round(previous);
  const improved = delta === null || delta === 0 ? null : lowerIsBetter ? delta < 0 : delta > 0;

  return (
    <td className="py-3 px-3 text-center">
      <div className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
        {rounded}
        {kind === "percent" ? "%" : ""}
      </div>
      <div
        className={`text-[10px] tabular-nums ${
          improved === null
            ? "text-muted-foreground"
            : improved
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
        }`}
      >
        {delta === null
          ? "—"
          : `${delta > 0 ? "+" : ""}${delta}${kind === "percent" ? "%" : ""}`}
      </div>
    </td>
  );
}

export default async function SiteAuditDirectoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";

  const [rawProjects, allCrawls] = await Promise.all([
    db.select().from(projects).orderBy(projects.name),
    db.select().from(crawls).orderBy(desc(crawls.finishedAt)),
  ]);

  const allProjects = q
    ? rawProjects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.domain.toLowerCase().includes(q) ||
          hostnameOf(p.domain).toLowerCase().includes(q),
      )
    : rawProjects;

  // Newest first, so the first completed crawl seen per project is the latest
  // and the second is what we compare it against.
  const latestByProject = new Map<number, Crawl>();
  const previousByProject = new Map<number, Crawl>();

  for (const crawl of allCrawls) {
    if (crawl.status !== "completed") continue;
    if (!latestByProject.has(crawl.projectId)) {
      latestByProject.set(crawl.projectId, crawl);
    } else if (!previousByProject.has(crawl.projectId)) {
      previousByProject.set(crawl.projectId, crawl);
    }
  }

  return (
    <div className="space-y-6 pb-20 pt-1 text-foreground animate-in">
      {/* 1. Breadcrumb & Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span>&gt;</span>
            <Link href="/" className="hover:text-foreground">
              SEO
            </Link>
            <span>&gt;</span>
            <span className="text-foreground font-semibold">Site Audit</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Site Audit
          </h1>
        </div>

        <button className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
          <Mail className="size-3.5" />
          Send feedback
        </button>
      </div>

      {/* 2. Search Box & Action Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <form method="GET" action="/site-audit" className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Project name or domain"
            className="w-full rounded-[6px] border border-border bg-surface pl-9 pr-4 py-2 text-[13px] text-foreground placeholder:text-muted-foreground shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </form>

        <Button
          variant="primary"
          size="sm"
          className="rounded-[6px] bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold h-8.5 px-4 shadow-sm w-full sm:w-auto"
          asChild
        >
          <Link href="/projects">
            <Plus className="size-3.5 mr-1" />
            Create SEO project
          </Link>
        </Button>
      </div>

      {/* 3. Projects Audit Matrix Table */}
      <div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4 w-52">Project</th>
                <th className="py-3 px-3 text-left">
                  <span className="flex items-center gap-1 cursor-pointer">
                    Last Update <ChevronDown className="size-3" />
                  </span>
                </th>
                <th className="py-3 px-3 text-center">Pages Crawled</th>
                <th className="py-3 px-3 text-center">Site Health</th>
                <th className="py-3 px-3 text-center text-purple-600 dark:text-purple-400">
                  <span className="flex items-center justify-center gap-1">
                    <Sparkles className="size-3" /> AI Search Health
                  </span>
                </th>
                <th className="py-3 px-3 text-center">Errors</th>
                <th className="py-3 px-3 text-center">Warnings</th>
                <th className="py-3 px-3 text-center">Crawlability</th>
                <th className="py-3 px-3 text-center">HTTPS</th>
                <th className="py-3 px-3 text-center">Int. SEO</th>
                <th className="py-3 px-3 text-center">Site Performance</th>
                <th className="py-3 px-3 text-center">Internal Linking</th>
                <th className="py-3 px-3 text-center">Markups</th>
                <th className="py-3 px-3 text-center">Core Web Vitals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allProjects.length > 0 ? (
                allProjects.map((p) => {
                  const crawl = latestByProject.get(p.id) ?? null;
                  const prev = previousByProject.get(p.id) ?? null;
                  const slug = toProjectSlug(p.name);
                  const pDomain = hostnameOf(p.domain) || p.domain;

                  const metrics: Metric[] = [
                    {
                      value: crawl?.healthScore ?? null,
                      previous: prev?.healthScore ?? null,
                      kind: "percent",
                    },
                    {
                      value: crawl?.aiSearchScore ?? null,
                      previous: prev?.aiSearchScore ?? null,
                      kind: "percent",
                    },
                    {
                      value: crawl ? crawl.criticalCount : null,
                      previous: prev ? prev.criticalCount : null,
                      kind: "count",
                      lowerIsBetter: true,
                    },
                    {
                      value: crawl ? crawl.warningCount : null,
                      previous: prev ? prev.warningCount : null,
                      kind: "count",
                      lowerIsBetter: true,
                    },
                    {
                      value: crawl?.crawlabilityScore ?? null,
                      previous: prev?.crawlabilityScore ?? null,
                      kind: "percent",
                    },
                    {
                      value: crawl?.httpsScore ?? null,
                      previous: prev?.httpsScore ?? null,
                      kind: "percent",
                    },
                    {
                      value: crawl?.intlSeoScore ?? null,
                      previous: prev?.intlSeoScore ?? null,
                      kind: "percent",
                      emptyLabel: crawl ? "Not in use" : "—",
                    },
                    {
                      value: crawl?.performanceScore ?? null,
                      previous: prev?.performanceScore ?? null,
                      kind: "percent",
                    },
                    {
                      value: crawl?.internalLinkingScore ?? null,
                      previous: prev?.internalLinkingScore ?? null,
                      kind: "percent",
                    },
                    {
                      value: crawl?.markupScore ?? null,
                      previous: prev?.markupScore ?? null,
                      kind: "percent",
                    },
                    {
                      value: crawl?.cwvScore ?? null,
                      previous: prev?.cwvScore ?? null,
                      kind: "percent",
                      emptyLabel: crawl ? "No PSI key" : "—",
                    },
                  ];

                  return (
                    <tr key={p.id} className="hover:bg-surface-muted/40 transition-colors">
                      {/* Project Name & Domain */}
                      <td className="py-3 px-4">
                        <Link
                          href={`/${slug}/audit`}
                          className="font-bold text-blue-600 dark:text-blue-400 hover:underline block truncate text-[13px]"
                        >
                          {p.name}
                        </Link>
                        <span className="text-[11px] text-muted-foreground block truncate mt-0.5">
                          {pDomain}
                        </span>
                        <Link
                          href={`/site-audit/settings?project=${slug}`}
                          className="mt-1 text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer p-0.5"
                          title="Site Audit Settings"
                        >
                          <Settings className="size-3" />
                        </Link>
                      </td>

                      {/* Last Update */}
                      <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                        {crawl?.finishedAt ? formatRelative(crawl.finishedAt) : "Never"}
                      </td>

                      {/* Pages Crawled */}
                      <td className="py-3 px-3 text-center font-semibold tabular-nums text-foreground">
                        {crawl?.pagesCrawled ?? 0}/{p.crawlLimit}
                      </td>

                      {metrics.map((metric, index) => (
                        <MetricCell key={index} metric={metric} />
                      ))}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-muted-foreground">
                    No projects found. Click &quot;Create SEO project&quot; above to add your first domain.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Pagination Bar */}
        <div className="flex items-center gap-3 border-t border-border px-4 py-3 text-[12px] text-muted-foreground bg-surface">
          <span>Page:</span>
          <span className="rounded-[4px] border border-border bg-surface-muted px-2 py-0.5 font-bold text-foreground">
            1
          </span>
          <span>of 1</span>
          <div className="flex items-center gap-1 ml-2 rounded-[4px] border border-border bg-surface-muted px-2 py-0.5 font-medium text-foreground cursor-pointer">
            <span>10</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}
