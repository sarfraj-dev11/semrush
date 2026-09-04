import { desc, eq, ne, sql } from "drizzle-orm";
import {
  Activity,
  CheckSquare,
  ExternalLink,
  Gauge,
  Link2,
  Mail,
  Plus,
  RefreshCw,
  ScanSearch,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { backlinks, competitors, projects, psiRuns, tasks } from "@/db/schema";
import { features } from "@/lib/env";
import { summarizeKeywords } from "@/lib/keyword-stats";
import {
  getActiveProjectJob,
  getKeywordRows,
  getLatestCompletedCrawl,
} from "@/lib/queries";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";
import { formatDate, formatDateTime, formatNumber, hostnameOf } from "@/lib/utils";
import { DomainSwitcher } from "./domain-switcher";

export const dynamic = "force-dynamic";

/**
 * The project dashboard: one card per data source this tool actually has, each
 * showing what was measured and when. A source with nothing recorded says so
 * and links to the action that would fill it — it never shows a stand-in.
 */

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "bad"
          ? "text-red-600 dark:text-red-400"
          : "text-foreground";
  return (
    <div>
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <div className={`mt-1 text-[22px] font-extrabold leading-none tabular-nums ${toneClass}`}>
        {value}
      </div>
      {hint ? <p className="mt-1 text-[11px] text-subtle-foreground">{hint}</p> : null}
    </div>
  );
}

function SourceCard({
  icon,
  title,
  href,
  meta,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  href: string;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <Link
            href={href}
            className="flex items-center gap-2 text-[14px] font-bold text-foreground hover:text-blue-600 dark:hover:text-blue-400"
          >
            {icon}
            {title}
          </Link>
          {meta ? <p className="mt-0.5 text-[11px] text-muted-foreground">{meta}</p> : null}
        </div>
        {action}
      </div>
      <div className="flex-1 pt-4">{children}</div>
    </div>
  );
}

function scoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 90) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: slugOrId } = await params;
  const project = await findProjectBySlugOrId(slugOrId);
  if (!project) notFound();

  const domain = hostnameOf(project.domain) || project.domain;
  const slug = toProjectSlug(project.name);
  const projectId = project.id;

  const [
    allProjects,
    crawl,
    activeCrawl,
    keywordRows,
    [backlinkStats],
    competitorRows,
    [latestPsi],
    [taskStats],
  ] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, domain: projects.domain })
      .from(projects)
      .orderBy(projects.name),
    getLatestCompletedCrawl(projectId),
    getActiveProjectJob(projectId, "crawl"),
    getKeywordRows(projectId),
    db
      .select({
        total: sql<number>`count(*)`,
        follow: sql<number>`sum(case when ${backlinks.isFollow} then 1 else 0 end)`,
        domains: sql<number>`count(distinct ${backlinks.sourceDomain})`,
        lastSeen: sql<string | null>`max(${backlinks.lastSeen})`,
      })
      .from(backlinks)
      .where(eq(backlinks.projectId, projectId)),
    db
      .select({ id: competitors.id, name: competitors.name, domain: competitors.domain })
      .from(competitors)
      .where(eq(competitors.projectId, projectId))
      .orderBy(competitors.domain)
      .limit(6),
    db
      .select()
      .from(psiRuns)
      .where(eq(psiRuns.projectId, projectId))
      .orderBy(desc(psiRuns.createdAt))
      .limit(1),
    db
      .select({
        open: sql<number>`count(*)`,
        high: sql<number>`sum(case when ${tasks.priority} = 'high' then 1 else 0 end)`,
      })
      .from(tasks)
      .where(sql`${tasks.projectId} = ${projectId} and ${ne(tasks.status, "done")}`),
  ]);

  const keywords = summarizeKeywords(keywordRows);
  const latestCheck = keywordRows.reduce<string | null>(
    (max, row) => (row.date && (!max || row.date > max) ? row.date : max),
    null,
  );
  const health = crawl?.healthScore != null ? Math.round(crawl.healthScore) : null;

  return (
    <div className="space-y-6 pb-20 pt-1 text-foreground">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span>&gt;</span>
            <span className="font-semibold text-foreground">SEO</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              <span>SEO Dashboard:</span>
              <DomainSwitcher currentSlug={slug} currentDomain={domain} projects={allProjects} />
            </h1>
            <a
              href={project.domain}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-muted-foreground hover:text-foreground"
              aria-label="Open website in new tab"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="mr-2 hidden items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:underline sm:inline-flex dark:text-blue-400">
            <Mail className="size-3.5" />
            Send feedback
          </button>
          <Button
            variant="primary"
            size="sm"
            className="h-8.5 rounded-[6px] bg-zinc-950 px-3.5 font-bold text-white dark:bg-white dark:text-zinc-950"
            asChild
          >
            <Link href="/projects">
              <Plus className="mr-1 size-3.5" />
              Create SEO Project
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Site Audit — from the last completed crawl */}
        <SourceCard
          icon={<ScanSearch className="size-4 text-indigo-500" />}
          title="Site Audit"
          href={`/${slug}/audit`}
          meta={
            crawl
              ? `Last crawl ${formatDateTime(crawl.finishedAt)} · ${formatNumber(crawl.pagesCrawled)} pages`
              : "No crawl has completed yet"
          }
          action={
            activeCrawl ? (
              <Badge tone="accent">
                <RefreshCw className="mr-1 size-3 animate-spin" />
                Crawling
              </Badge>
            ) : null
          }
        >
          {crawl ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Site health"
                value={health === null ? "—" : `${health}%`}
                tone={health === null ? undefined : scoreTone(health)}
              />
              <Stat
                label="Errors"
                value={formatNumber(crawl.criticalCount)}
                tone={crawl.criticalCount > 0 ? "bad" : "good"}
              />
              <Stat
                label="Warnings"
                value={formatNumber(crawl.warningCount)}
                tone={crawl.warningCount > 0 ? "warn" : "good"}
              />
              <Stat label="Notices" value={formatNumber(crawl.noticeCount)} />
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Run the first audit to measure health, errors and warnings.{" "}
              <Link href={`/${slug}/audit`} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Start site audit
              </Link>
            </p>
          )}
        </SourceCard>

        {/* Position Tracking — from keyword_rankings */}
        <SourceCard
          icon={<TrendingUp className="size-4 text-emerald-500" />}
          title="Position Tracking"
          href={`/${slug}/rankings`}
          meta={
            keywords.total === 0
              ? "No keywords tracked"
              : latestCheck
                ? `Last check ${formatDate(latestCheck)} · ${formatNumber(keywords.total)} keywords`
                : `${formatNumber(keywords.total)} keywords · never checked`
          }
        >
          {keywords.total === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Add keywords or import a CSV to start tracking.{" "}
              <Link href={`/projects/${projectId}/keywords`} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Manage keywords
              </Link>
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Ranking"
                value={formatNumber(keywords.ranking)}
                hint={
                  keywords.unchecked > 0
                    ? `${formatNumber(keywords.unchecked)} unchecked`
                    : `${formatNumber(keywords.notRanking)} outside top 100`
                }
              />
              <Stat label="Top 10" value={formatNumber(keywords.top10)} />
              <Stat
                label="Improved"
                value={formatNumber(keywords.improved)}
                tone={keywords.improved > 0 ? "good" : undefined}
              />
              <Stat
                label="Declined"
                value={formatNumber(keywords.declined)}
                tone={keywords.declined > 0 ? "bad" : undefined}
              />
            </div>
          )}
        </SourceCard>

        {/* Backlinks — from imported rows */}
        <SourceCard
          icon={<Link2 className="size-4 text-purple-500" />}
          title="Backlinks"
          href={`/${slug}/backlinks`}
          meta={
            backlinkStats.total > 0
              ? backlinkStats.lastSeen
                ? `Last seen ${formatDate(backlinkStats.lastSeen)}`
                : "From CSV imports"
              : "No backlinks imported"
          }
        >
          {backlinkStats.total === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Backlinks come from your own exports — this tool has no link index.{" "}
              <Link href="/imports" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Import backlinks
              </Link>
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Backlinks" value={formatNumber(backlinkStats.total)} />
              <Stat label="Referring domains" value={formatNumber(backlinkStats.domains)} />
              <Stat
                label="Follow"
                value={`${Math.round(((backlinkStats.follow ?? 0) / backlinkStats.total) * 100)}%`}
                hint={`${formatNumber(backlinkStats.follow ?? 0)} of ${formatNumber(backlinkStats.total)}`}
              />
            </div>
          )}
        </SourceCard>

        {/* Performance — from PageSpeed Insights */}
        <SourceCard
          icon={<Gauge className="size-4 text-rose-500" />}
          title="Performance"
          href={`/${slug}/performance`}
          meta={
            latestPsi
              ? `${latestPsi.strategy} · ${formatDateTime(latestPsi.createdAt)}`
              : features.pagespeed
                ? "No PageSpeed run yet"
                : "PageSpeed API key not configured"
          }
        >
          {latestPsi ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Performance"
                value={latestPsi.performanceScore != null ? String(Math.round(latestPsi.performanceScore)) : "—"}
                tone={
                  latestPsi.performanceScore != null
                    ? scoreTone(latestPsi.performanceScore)
                    : undefined
                }
              />
              <Stat
                label="LCP"
                value={latestPsi.lcpMs != null ? `${(latestPsi.lcpMs / 1000).toFixed(2)}s` : "—"}
                tone={latestPsi.lcpMs != null ? (latestPsi.lcpMs <= 2500 ? "good" : "bad") : undefined}
              />
              <Stat
                label="CLS"
                value={latestPsi.cls != null ? latestPsi.cls.toFixed(2) : "—"}
                tone={latestPsi.cls != null ? (latestPsi.cls <= 0.1 ? "good" : "bad") : undefined}
              />
              <Stat
                label="INP"
                value={latestPsi.inpMs != null ? `${Math.round(latestPsi.inpMs)}ms` : "—"}
                tone={latestPsi.inpMs != null ? (latestPsi.inpMs <= 200 ? "good" : "bad") : undefined}
              />
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              {features.pagespeed
                ? "Run a PageSpeed check from the Performance tab."
                : "Set PAGESPEED_API_KEY to measure Core Web Vitals. Without it nothing here is estimated."}
            </p>
          )}
        </SourceCard>

        {/* Competitors — from the competitors table */}
        <SourceCard
          icon={<Users className="size-4 text-sky-500" />}
          title="Competitors"
          href={`/${slug}/competitors`}
          meta={
            competitorRows.length > 0
              ? `${formatNumber(competitorRows.length)} tracked`
              : "None added"
          }
        >
          {competitorRows.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Add the domains you compete with to compare them live.{" "}
              <Link href={`/${slug}/competitors`} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Add competitors
              </Link>
            </p>
          ) : (
            <ul className="space-y-1.5 text-[13px]">
              {competitorRows.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium text-foreground">{c.name ?? c.domain}</span>
                  <Link
                    href={`/compare-domains?domains=${encodeURIComponent(`${domain},${hostnameOf(c.domain) || c.domain}`)}&country=${project.targetCountry}`}
                    className="shrink-0 text-[12px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Compare
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SourceCard>

        {/* Tasks — from the tasks table */}
        <SourceCard
          icon={<CheckSquare className="size-4 text-amber-500" />}
          title="Tasks"
          href={`/${slug}/tasks`}
          meta={taskStats.open > 0 ? `${formatNumber(taskStats.open)} open` : "Nothing open"}
        >
          {taskStats.open === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Turn audit findings into tasks from the Site Audit tab.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Open" value={formatNumber(taskStats.open)} />
              <Stat
                label="High priority"
                value={formatNumber(taskStats.high ?? 0)}
                tone={(taskStats.high ?? 0) > 0 ? "warn" : undefined}
              />
            </div>
          )}
        </SourceCard>
      </div>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-subtle-foreground">
        <Activity className="mt-0.5 size-3.5 shrink-0" />
        Organic traffic, authority scores and share of voice are absent because they require a
        licensed search index this tool does not have. Every number above was recorded by a crawl,
        a rank check, a PageSpeed run or an import you made.
      </p>
    </div>
  );
}
