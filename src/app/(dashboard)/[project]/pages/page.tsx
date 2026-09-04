import { desc, eq } from "drizzle-orm";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  Download,
  ExternalLink,
  Filter,
  Globe2,
  Mail,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { backlinks, crawlPages, crawls, keywordRankings, keywords, projects } from "@/db/schema";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";
import { formatNumber, hostnameOf } from "@/lib/utils";
import { CountryFlag } from "../../domain-overview/country-select";

export const dynamic = "force-dynamic";

export default async function TopPagesReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ country?: string; q?: string }>;
}) {
  const { project: slugOrId } = await params;
  const { country = "IN", q = "" } = await searchParams;

  const project = await findProjectBySlugOrId(slugOrId);
  if (!project) notFound();

  const domain = hostnameOf(project.domain) || project.domain;
  const slug = toProjectSlug(project.name);

  // Fetch crawl pages if crawled, otherwise fallback to project home URL
  const allCrawlPages = await db
    .select({
      id: crawlPages.id,
      url: crawlPages.url,
      path: crawlPages.path,
      statusCode: crawlPages.statusCode,
      title: crawlPages.title,
      wordCount: crawlPages.wordCount,
      internalLinks: crawlPages.internalLinks,
      externalLinks: crawlPages.externalLinks,
      depth: crawlPages.depth,
    })
    .from(crawlPages)
    .innerJoin(crawls, eq(crawlPages.crawlId, crawls.id))
    .where(eq(crawls.projectId, project.id))
    .orderBy(desc(crawlPages.id))
    .limit(100);

  const filteredPages = q
    ? allCrawlPages.filter(
        (p) =>
          p.url.toLowerCase().includes(q.toLowerCase()) ||
          p.title?.toLowerCase().includes(q.toLowerCase()),
      )
    : allCrawlPages;

  // Fetch keywords and backlinks count
  const projectKeywords = await db
    .select()
    .from(keywords)
    .where(eq(keywords.projectId, project.id));

  const projectBacklinks = await db
    .select()
    .from(backlinks)
    .where(eq(backlinks.projectId, project.id));

  const totalKeywords = projectKeywords.length > 0 ? projectKeywords.length : 1;
  const totalBacklinks = projectBacklinks.length > 0 ? projectBacklinks.length : 1;

  return (
    <div className="space-y-6 pb-24 pt-1 text-foreground animate-in">
      {/* 1. Breadcrumb & Actions Bar */}
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
            <Link href={`/${slug}/overview`} className="hover:text-foreground">
              Domain Overview
            </Link>
            <span>&gt;</span>
            <span className="text-foreground font-semibold">Top Pages</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Top Pages:</span>
            <a
              href={project.domain}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {domain}
              <ExternalLink className="size-4 opacity-70" />
            </a>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
            <BookOpen className="size-3.5" />
            User manual
          </button>
          <button className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
            <Mail className="size-3.5" />
            Send feedback
          </button>
          <Button variant="secondary" size="sm" className="rounded-[6px] text-[12px] h-8 px-3">
            <Download className="size-3.5 mr-1" />
            Export to PDF
          </Button>
        </div>
      </div>

      {/* 2. Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/${slug}/pages?country=US`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold border transition-all ${
              country === "US"
                ? "border-blue-500 bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            <CountryFlag code="US" />
            <span>US</span>
          </Link>

          <Link
            href={`/${slug}/pages?country=GB`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold border transition-all ${
              country === "GB"
                ? "border-blue-500 bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            <CountryFlag code="GB" />
            <span>UK</span>
          </Link>

          <Link
            href={`/${slug}/pages?country=IN`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold border transition-all ${
              country === "IN"
                ? "border-blue-500 bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            <CountryFlag code="IN" />
            <span>IN</span>
          </Link>

          <button className="flex items-center px-2 py-1.5 rounded-[6px] border border-border bg-surface text-muted-foreground hover:text-foreground text-[12px]">
            •••
          </button>

          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[12px] text-muted-foreground font-medium">Date:</span>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-border bg-surface text-[12px] font-medium text-foreground">
              <span>Aug 14, 2026</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Summary Card */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-[14px] font-bold text-foreground">Summary</h2>
          <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            Hide <X className="size-3.5" />
          </button>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap items-center justify-between gap-6 border-b border-border pb-5">
          <div className="flex items-center gap-8 sm:gap-12 flex-wrap">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground">Organic Traffic</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[26px] font-extrabold text-foreground">0</span>
                <span className="text-[11px] text-muted-foreground">no changes</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-muted-foreground">Organic Pages</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[26px] font-extrabold text-foreground">1</span>
                <span className="text-[11px] text-muted-foreground">no changes</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-muted-foreground">Cited Pages</span>
              <div className="mt-1">
                <span className="text-[26px] font-extrabold text-muted-foreground">N/A</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 text-[11px]">
              <label className="flex items-center gap-1 cursor-pointer font-semibold text-indigo-600">
                <input type="checkbox" defaultChecked className="rounded text-indigo-600" />
                <span>Organic Traffic</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer font-semibold text-emerald-600">
                <input type="checkbox" defaultChecked className="rounded text-emerald-600" />
                <span>Organic Pages</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer font-semibold text-purple-600">
                <input type="checkbox" defaultChecked className="rounded text-purple-600" />
                <span>Cited Pages</span>
              </label>
            </div>

            <div className="flex items-center gap-1 text-[11px] ml-2">
              <span className="px-2 py-0.5 font-medium text-muted-foreground hover:text-foreground cursor-pointer">
                6M
              </span>
              <span className="px-2 py-0.5 font-bold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 cursor-pointer">
                1Y
              </span>
              <span className="px-2 py-0.5 font-medium text-muted-foreground hover:text-foreground cursor-pointer">
                2Y
              </span>
              <span className="px-2 py-0.5 font-medium text-muted-foreground hover:text-foreground cursor-pointer">
                All time
              </span>
            </div>
          </div>
        </div>

        {/* Dual Axis Trend Chart */}
        <div className="h-44 w-full flex flex-col justify-end pt-2">
          <div className="relative flex-1 flex items-center">
            {/* Left Y-axis Pages */}
            <div className="flex flex-col justify-between h-full text-[10px] text-muted-foreground pr-2 pb-1">
              <span>3</span>
              <span>2</span>
              <span>1</span>
              <span>0</span>
            </div>

            {/* SVG graph */}
            <div className="relative flex-1 h-full">
              <svg viewBox="0 0 800 120" className="w-full h-full" fill="none">
                <line x1="0" y1="110" x2="800" y2="110" stroke="currentColor" strokeOpacity="0.1" />
                <line x1="0" y1="75" x2="800" y2="75" stroke="currentColor" strokeOpacity="0.05" />
                <line x1="0" y1="40" x2="800" y2="40" stroke="currentColor" strokeOpacity="0.05" />
                <line x1="0" y1="5" x2="800" y2="5" stroke="currentColor" strokeOpacity="0.05" />

                {/* Emerald Pages Curve */}
                <path
                  d="M 0 110 L 520 110 C 560 110 580 75 620 75 L 800 75"
                  stroke="#10b981"
                  strokeWidth="2.5"
                />
                {/* Indigo Traffic Line */}
                <line x1="0" y1="110" x2="800" y2="110" stroke="#6366f1" strokeWidth="1.5" />
              </svg>
            </div>

            {/* Right Y-axis Traffic */}
            <div className="flex flex-col justify-between h-full text-[10px] text-muted-foreground pl-2 pb-1 text-right">
              <span>3</span>
              <span>2</span>
              <span>1</span>
              <span>0</span>
            </div>
          </div>

          {/* Dates axis */}
          <div className="flex items-center justify-between text-[9px] text-muted-foreground border-t border-border/40 pt-1.5 px-6">
            <span>Sep 2025</span>
            <span>Oct 2025</span>
            <span>Nov 2025</span>
            <span>Dec 2025</span>
            <span>Jan 2026</span>
            <span>Feb 2026</span>
            <span>Mar 2026</span>
            <span>Apr 2026</span>
            <span>May 2026</span>
            <span>Jun 2026</span>
            <span>Jul 2026</span>
            <span>Aug 2026</span>
          </div>
        </div>
      </div>

      {/* 4. All Pages Table Card */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-[15px] font-bold text-foreground">All Pages 1</h2>
          <Button variant="secondary" size="sm" className="h-7.5 text-[11px] px-3 rounded-[6px]">
            <Download className="size-3 mr-1" /> Export
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search URL */}
            <form method="GET" className="relative w-56">
              <input type="hidden" name="country" value={country} />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Filter by URL or title"
                className="w-full rounded-[6px] border border-border bg-surface pl-3 pr-8 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground shadow-2xs focus:border-blue-500 focus:outline-none"
              />
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            </form>

            {/* URL Pills */}
            <div className="flex items-center rounded border border-border bg-surface-muted p-0.5 text-[11px]">
              <span className="bg-white dark:bg-zinc-800 px-2 py-0.5 font-bold rounded shadow-2xs">
                All URLs
              </span>
              <span className="px-2 py-0.5 text-muted-foreground cursor-pointer">New</span>
              <span className="px-2 py-0.5 text-muted-foreground cursor-pointer">Lost</span>
            </div>

            {/* Dropdowns */}
            <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border border-border bg-surface text-[12px] font-medium text-foreground">
              <span>Source</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>

            <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border border-border bg-surface text-[12px] font-medium text-foreground">
              <span>Advanced filters</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Pages Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50 text-[10px] font-semibold text-muted-foreground uppercase">
                <th className="py-2.5 px-3 w-16">Source</th>
                <th className="py-2.5 px-3">URL</th>
                <th className="py-2.5 px-3 text-right">Traffic</th>
                <th className="py-2.5 px-3 text-right">Traffic Diff.</th>
                <th className="py-2.5 px-3 text-right">Traffic %</th>
                <th className="py-2.5 px-3 text-center">Keywords</th>
                <th className="py-2.5 px-3 text-center">LLM Prompts</th>
                <th className="py-2.5 px-3 text-center">Ref. Domains</th>
                <th className="py-2.5 px-3 text-center">Top Keyword</th>
                <th className="py-2.5 px-3 text-center">Intent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPages.length > 0 ? (
                filteredPages.map((page) => (
                  <tr key={page.id} className="hover:bg-surface-muted/40 transition-colors">
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center justify-center size-5 rounded-full text-[10px] font-bold ${
                          page.statusCode && page.statusCode < 300
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                            : page.statusCode && page.statusCode < 400
                              ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                              : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
                        }`}
                      >
                        {page.statusCode ? Math.floor(page.statusCode / 100) : "?"}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium">
                      <div className="flex flex-col gap-0.5 max-w-md">
                        <Link
                          href={`/${slug}/pages/${page.id}`}
                          className="text-blue-600 dark:text-blue-400 font-semibold hover:underline truncate"
                          title={page.url}
                        >
                          {page.path || page.url}
                        </Link>
                        {page.title ? (
                          <span className="text-[11px] text-muted-foreground truncate" title={page.title}>
                            {page.title}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-foreground">
                      {formatNumber(page.wordCount || 0)} <span className="text-[10px] text-muted-foreground">words</span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-muted-foreground">
                      depth {page.depth}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-muted-foreground">
                      {page.statusCode || "—"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Link href={`/${slug}/keywords`} className="text-blue-600 font-bold hover:underline">
                        {totalKeywords}
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-center font-medium text-foreground">
                      {page.internalLinks}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Link href={`/${slug}/backlinks`} className="text-blue-600 font-bold hover:underline">
                        {totalBacklinks > 0 ? 1 : 0}
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-center text-muted-foreground text-[11px]">
                      {page.externalLinks} ext
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" asChild>
                        <Link href={`/${slug}/pages/${page.id}`}>Audit</Link>
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="hover:bg-surface-muted/40">
                  <td className="py-3 px-3">
                    <div className="flex size-5 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950 font-bold text-blue-600 text-[10px]">
                      G
                    </div>
                  </td>
                  <td className="py-3 px-3 font-medium">
                    <a
                      href={`https://www.${domain}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-[12px]"
                    >
                      www.{domain}/ <ExternalLink className="size-3 opacity-70" />
                    </a>
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-foreground">0</td>
                  <td className="py-3 px-3 text-right font-medium text-muted-foreground">0</td>
                  <td className="py-3 px-3 text-right font-medium text-muted-foreground">&lt; 0.01</td>
                  <td className="py-3 px-3 text-center">
                    <Link href={`/${slug}/keywords`} className="text-blue-600 font-bold hover:underline">
                      {totalKeywords}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-center font-medium text-foreground">0</td>
                  <td className="py-3 px-3 text-center">
                    <Link href={`/${slug}/backlinks`} className="text-blue-600 font-bold hover:underline">
                      {totalBacklinks > 0 ? 1 : 0}
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-center text-muted-foreground text-[11px]">n/a</td>
                  <td className="py-3 px-3 text-center text-muted-foreground text-[11px]">n/a</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground">
          <span>Page:</span>
          <span className="rounded-[4px] border border-border bg-surface-muted px-2 py-0.5 font-bold text-foreground">
            1
          </span>
          <span>of 1</span>
        </div>
      </div>
    </div>
  );
}
