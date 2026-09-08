import { eq, sql } from "drizzle-orm";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  FileCode,
  Gauge,
  Globe,
  Info,
  Link as LinkIcon,
  Lock,
  Monitor,
  Play,
  Plus,
  Radar,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { SubmitButton } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { db } from "@/db";
import { pageIssues } from "@/db/schema";
import { ALL_COUNTRIES } from "@/lib/countries";
import {
  AI_SEARCH_CODES,
  ISSUE_BY_CODE,
  SEVERITY_ORDER,
  THEMATIC_ISSUE_CODES,
  type IssueSeverity,
} from "@/lib/crawler/issue-catalog";
import {
  getActiveProjectJob,
  getCrawlHistory,
  getLatestCompletedCrawl,
  getPreviousCompletedCrawl,
} from "@/lib/queries";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";
import { formatDateTime, formatNumber, formatRelative, hostnameOf } from "@/lib/utils";
import { startCrawlAction } from "@/app/(dashboard)/projects/[id]/audit/actions";
import { cancelJobAction } from "@/app/(dashboard)/jobs/actions";
import { TaskDialog } from "@/app/(dashboard)/projects/[id]/tasks/task-dialog";
import {
  SiteHealthInfoModal,
  ErrorsInfoModal,
  WarningsInfoModal,
  NoticesInfoModal,
  CrawledPagesInfoModal,
  AISearchInfoModal,
  RobotsTxtInfoModal,
} from "./site-health-info-modal";
import { LlmsTxtCard } from "./llms-txt-card";

export const dynamic = "force-dynamic";

const severityTone = {
  critical: "critical",
  warning: "warning",
  notice: "notice",
} as const;

async function issueCounts(crawlId: number) {
  const rows = await db
    .select({
      code: pageIssues.code,
      pages: sql<number>`count(distinct ${pageIssues.pageId})`,
    })
    .from(pageIssues)
    .where(eq(pageIssues.crawlId, crawlId))
    .groupBy(pageIssues.code);

  return new Map(rows.map((row) => [row.code, row.pages]));
}

/**
 * One recorded detail per issue code.
 *
 * The list above counts affected pages, which answers "how much" but never
 * "what". For a crawl that could not fetch the site at all, the reason was
 * being written to the database and shown nowhere — the audit said "Page could
 * not be fetched" and left the actual cause a click away, or invisible.
 */
async function issueSampleDetails(crawlId: number) {
  const rows = await db
    .select({
      code: pageIssues.code,
      detail: sql<string | null>`max(${pageIssues.detail})`,
    })
    .from(pageIssues)
    .where(eq(pageIssues.crawlId, crawlId))
    .groupBy(pageIssues.code);

  return new Map(rows.map((row) => [row.code, row.detail]));
}

type ThematicReport = {
  label: string;
  hint: string;
  icon: ReactNode;
  /** null means the check could not apply to this site. */
  score: number | null;
  emptyLabel?: string;
  /** Issue codes this card drills into. */
  codes: string[];
};

/**
 * Run-over-run trend. Oldest point on the left, newest on the right, drawn from
 * whatever history exists — one crawl gets a flat line rather than nothing.
 */
function Sparkline({
  values,
  tone,
}: {
  values: number[];
  tone: "critical" | "warning";
}) {
  if (values.length === 0) return null;

  const max = Math.max(...values, 1);
  const width = 120;
  const height = 34;
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : index * step;
    const y = height - (value / max) * (height - 6) - 3;
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];
  const stroke = tone === "critical" ? "text-red-500" : "text-amber-500";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-3 h-8 w-full overflow-visible"
      aria-hidden="true"
    >
      <polyline
        points={line}
        fill="none"
        strokeWidth="1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${stroke} opacity-70`}
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill="currentColor" className={stroke} />
    </svg>
  );
}

/** Proportional bar mirroring the Healthy/Broken/Issues/Redirects/Blocked split. */
function BreakdownBar({
  buckets,
}: {
  buckets: { label: string; value: number; bar: string }[];
}) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
  if (total === 0) return null;

  return (
    <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
      {buckets
        .filter((bucket) => bucket.value > 0)
        .map((bucket) => (
          <div
            key={bucket.label}
            className={bucket.bar}
            style={{ width: `${(bucket.value / total) * 100}%` }}
            title={`${bucket.label}: ${bucket.value}`}
          />
        ))}
    </div>
  );
}

function scoreTone(score: number) {
  if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function ScoreCard({
  report,
  hasCrawl,
  slug,
  issuePages,
}: {
  report: ThematicReport;
  hasCrawl: boolean;
  slug: string;
  issuePages: Map<string, number>;
}) {
  const score = report.score === null ? null : Math.round(report.score);

  // Only offer the drill-down when there is something on the other side of it.
  const affected = report.codes.reduce(
    (total, code) => total + (issuePages.get(code) ?? 0),
    0,
  );

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-xs flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            {report.icon}
            <span className="text-[13px] font-bold text-foreground">{report.label}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{report.hint}</p>
        </div>
        <div className="text-right shrink-0">
          {score === null ? (
            <span className="text-[11px] text-muted-foreground max-w-32 block leading-snug">
              {hasCrawl ? (report.emptyLabel ?? "Not measured") : "Run an audit"}
            </span>
          ) : (
            <>
              <span className={`text-[18px] font-extrabold ${scoreTone(score)}`}>
                {score}%
              </span>
              <span className="text-[10px] text-muted-foreground block">
                {score >= 90 ? "Good" : score >= 70 ? "Needs work" : "Poor"}
              </span>
            </>
          )}
        </div>
      </div>

      {affected > 0 ? (
        <Link
          href={`/${slug}/audit?report=${encodeURIComponent(report.label)}`}
          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          View details ({affected} {affected === 1 ? "page" : "pages"})
        </Link>
      ) : null}
    </div>
  );
}

function Delta({ value, invert = true }: { value: number; invert?: boolean }) {
  if (value === 0) return null;
  const good = invert ? value < 0 : value > 0;
  return (
    <span
      className={`text-[12px] font-semibold tabular-nums ${good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
    >
      {value > 0 ? "+" : ""}
      {value}
    </span>
  );
}

export default async function ProjectAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ report?: string }>;
}) {
  const { project: slugOrId } = await params;
  const { report: activeReport } = await searchParams;
  const project = await findProjectBySlugOrId(slugOrId);
  if (!project) notFound();

  const projectId = project.id;
  const slug = toProjectSlug(project.name);
  const domain = hostnameOf(project.domain) || project.domain || "Unknown website";
  // findProjectBySlugOrId can hand back a synthetic project that has no crawl
  // settings, so read them defensively rather than assuming a full row.
  const targetDevice = "targetDevice" in project ? project.targetDevice : "mobile";
  const targetCountry = "targetCountry" in project ? project.targetCountry : "US";

  const [activeJob, crawl, history] = await Promise.all([
    getActiveProjectJob(projectId, "crawl"),
    getLatestCompletedCrawl(projectId),
    getCrawlHistory(projectId),
  ]);

  const previous = crawl ? await getPreviousCompletedCrawl(projectId, crawl.id) : null;
  const counts = crawl ? await issueCounts(crawl.id) : new Map<string, number>();
  const previousCounts = previous ? await issueCounts(previous.id) : new Map<string, number>();
  const issueSamples = crawl
    ? await issueSampleDetails(crawl.id)
    : new Map<string, string | null>();

  // "View details" narrows the issue list rather than navigating away, so a
  // score and the issues behind it stay on screen together.
  const filterCodes =
    activeReport && THEMATIC_ISSUE_CODES[activeReport]
      ? new Set(THEMATIC_ISSUE_CODES[activeReport])
      : null;

  const grouped = new Map<IssueSeverity, { code: string; pages: number }[]>([
    ["critical", []],
    ["warning", []],
    ["notice", []],
  ]);

  for (const [code, pages] of counts) {
    const definition = ISSUE_BY_CODE.get(code);
    if (!definition) continue;
    if (filterCodes && !filterCodes.has(code)) continue;
    grouped.get(definition.severity)!.push({ code, pages });
  }

  const visibleIssueTypes = [...grouped.values()].reduce(
    (total, list) => total + list.length,
    0,
  );

  for (const list of grouped.values()) list.sort((a, b) => b.pages - a.pages);

  const healthScore = crawl?.healthScore != null ? Math.round(crawl.healthScore) : 0;
  const pagesCrawled = crawl?.pagesCrawled ?? 0;
  const criticalCount = crawl?.criticalCount ?? 0;
  const warningCount = crawl?.warningCount ?? 0;
  const noticeCount = crawl?.noticeCount ?? 0;

  const pageBreakdown = [
    {
      label: "Healthy",
      value: crawl?.healthyPages ?? 0,
      tone: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500",
    },
    {
      label: "Broken",
      value: crawl?.brokenPages ?? 0,
      tone: "text-red-600 dark:text-red-400",
      bar: "bg-red-500",
    },
    {
      label: "Have issues",
      value: crawl?.pagesWithIssues ?? 0,
      tone: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
    },
    {
      label: "Redirects",
      value: crawl?.redirectPages ?? 0,
      tone: "text-blue-600 dark:text-blue-400",
      bar: "bg-blue-500",
    },
    {
      label: "Blocked",
      value: crawl?.blockedPages ?? 0,
      tone: "text-zinc-500",
      bar: "bg-zinc-400",
    },
  ];

  // Oldest to newest so the sparkline reads left to right.
  const completedHistory = [...history]
    .filter((entry) => entry.status === "completed")
    .sort(
      (a, b) =>
        (a.finishedAt?.getTime() ?? 0) - (b.finishedAt?.getTime() ?? 0),
    )
    .slice(-12);

  const errorTrend = completedHistory.map((entry) => entry.criticalCount);
  const warningTrend = completedHistory.map((entry) => entry.warningCount);

  const countriesTargeted = crawl?.countriesTargeted ?? [];
  const countrySources = crawl?.countrySources ?? {};
  const countryName = new Map(ALL_COUNTRIES.map((c) => [c.code, c.name]));

  const aiScore = crawl?.aiSearchScore != null ? Math.round(crawl.aiSearchScore) : null;
  const botAccess = crawl?.botAccess ?? [];
  const aiBots = botAccess.filter((bot) => bot.group === "ai");
  const searchBots = botAccess.filter((bot) => bot.group === "search");
  const blockedBots = botAccess.filter((bot) => !bot.allowed);

  const aiIssueCount = [...counts.entries()]
    .filter(([code]) => AI_SEARCH_CODES.has(code))
    .reduce((total, [, pages]) => total + pages, 0);

  // Both scores are derived here rather than stored: they fall straight out of
  // counts the crawl already recorded, so a column would only be a second copy
  // that can disagree with the first.
  const parityScore =
    crawl && crawl.parityChecked > 0
      ? Math.round(
          ((crawl.parityChecked - crawl.parityDiffering) / crawl.parityChecked) *
            100,
        )
      : null;

  // Max, not sum: one page can carry critical, serious and minor at once, and
  // adding them would report more affected pages than were ever inspected.
  const accessibilityPagesAffected = THEMATIC_ISSUE_CODES.Accessibility.reduce(
    (worst, code) => Math.max(worst, counts.get(code) ?? 0),
    0,
  );
  const accessibilityScore =
    crawl && crawl.browserProbeChecked > 0
      ? Math.round(
          ((crawl.browserProbeChecked - accessibilityPagesAffected) /
            crawl.browserProbeChecked) *
            100,
        )
      : null;

  const trapPatterns = crawl?.trapPatterns ?? [];

  const botCoverage = crawl
    ? [
        {
          label: "Mobile vs desktop",
          value:
            crawl.parityChecked > 0
              ? `${formatNumber(crawl.parityChecked)} pages compared`
              : "Not run",
          note:
            crawl.parityChecked > 0
              ? `${formatNumber(crawl.parityDiffering)} differ`
              : null,
        },
        {
          label: "Fragment links",
          value:
            crawl.fragmentsChecked > 0
              ? `${formatNumber(crawl.fragmentsChecked)} checked`
              : "None found",
          note:
            crawl.fragmentsChecked > 0
              ? `${formatNumber(crawl.fragmentsBroken)} broken`
              : null,
        },
        {
          label: "Render gap",
          value:
            crawl.renderGapChecked > 0
              ? `${formatNumber(crawl.renderGapChecked)} pages rendered`
              : "Not run",
          note:
            crawl.jsOnlyPages > 0
              ? `${formatNumber(crawl.jsOnlyPages)} JS-only`
              : null,
        },
        {
          label: "Browser probe",
          value:
            crawl.browserProbeChecked > 0
              ? `${formatNumber(crawl.browserProbeChecked)} pages inspected`
              : "Not run",
          note: crawl.browserProbeUnavailable,
        },
      ]
    : [];

  const thematicReports: ThematicReport[] = [
    {
      label: "Crawlability",
      hint: "Status codes, canonicals, indexability & sitemap accuracy",
      icon: <Radar className="size-4 text-indigo-500" />,
      score: crawl?.crawlabilityScore ?? null,
      codes: THEMATIC_ISSUE_CODES.Crawlability,
    },
    {
      label: "HTTPS",
      hint: "Certificate coverage, mixed content & HSTS",
      icon: <Lock className="size-4 text-emerald-500" />,
      score: crawl?.httpsScore ?? null,
      codes: THEMATIC_ISSUE_CODES.HTTPS,
    },
    {
      label: "Site Performance",
      hint:
        crawl?.avgResponseMs != null
          ? `${formatNumber(crawl.avgResponseMs)} ms average server response`
          : "Server response times & document weight",
      icon: <Zap className="size-4 text-amber-500" />,
      score: crawl?.performanceScore ?? null,
      codes: THEMATIC_ISSUE_CODES["Site Performance"],
    },
    {
      label: "Internal Linking",
      hint: "Inlinks, crawl depth, orphans & broken outbound links",
      icon: <LinkIcon className="size-4 text-purple-500" />,
      score: crawl?.internalLinkingScore ?? null,
      codes: THEMATIC_ISSUE_CODES["Internal Linking"],
    },
    {
      label: "Markup",
      hint: "Schema.org JSON-LD, OpenGraph & Twitter cards",
      icon: <FileCode className="size-4 text-blue-500" />,
      score: crawl?.markupScore ?? null,
      codes: THEMATIC_ISSUE_CODES.Markup,
    },
    {
      label: "International SEO",
      hint:
        countriesTargeted.length > 0
          ? `Targeting ${countriesTargeted.length} ${countriesTargeted.length === 1 ? "country" : "countries"} · ${crawl?.hreflangPages ?? 0} pages with hreflang`
          : "hreflang alternates, return links & country targeting",
      icon: <Globe className="size-4 text-sky-500" />,
      score: crawl?.intlSeoScore ?? null,
      emptyLabel: "Not implemented on this site",
      codes: THEMATIC_ISSUE_CODES["International SEO"],
    },
    {
      label: "Device Parity",
      hint:
        crawl && crawl.parityChecked > 0
          ? `${formatNumber(crawl.parityChecked)} pages compared on mobile and desktop`
          : "Mobile and desktop renditions of the same URL",
      icon: <Smartphone className="size-4 text-teal-500" />,
      score: parityScore,
      emptyLabel: "No pages compared",
      codes: THEMATIC_ISSUE_CODES["Device Parity"],
    },
    {
      label: "Accessibility",
      hint:
        crawl && crawl.browserProbeChecked > 0
          ? `axe-core run on ${formatNumber(crawl.browserProbeChecked)} pages`
          : "axe-core violations in the rendered page",
      icon: <ShieldCheck className="size-4 text-lime-600" />,
      score: accessibilityScore,
      emptyLabel: "Needs a browser service",
      codes: THEMATIC_ISSUE_CODES.Accessibility,
    },
    {
      label: "Core Web Vitals",
      hint: "LCP, INP & CLS from PageSpeed Insights",
      icon: <Gauge className="size-4 text-rose-500" />,
      score: crawl?.cwvScore ?? null,
      emptyLabel: "Add a PageSpeed API key in Settings",
      codes: [],
    },
  ];


  const runButton = (
    <form action={startCrawlAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <SubmitButton variant="primary" className="rounded-[6px] font-bold text-[13px] h-9 px-4">
        <Play className="size-3.5 mr-1.5 fill-current" />
        {crawl ? "Rerun audit" : "Start site audit"}
      </SubmitButton>
    </form>
  );

  return (
    <div className="space-y-6 pb-16 pt-1 text-foreground animate-in">
      {/* Active Job Tracker */}
      {activeJob ? (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 shadow-xs">
          <AutoRefresh enabled />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="size-4 animate-spin text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-[14px] font-bold text-foreground">
                Crawl in progress for {domain}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-600/10 dark:bg-indigo-400/10 px-2 py-0.5 text-[12px] font-extrabold font-mono text-indigo-600 dark:text-indigo-400 tabular-nums border border-indigo-600/20 dark:border-indigo-400/20">
                {activeJob.progress}%
              </span>
              <Badge tone="accent" className="capitalize">
                {activeJob.status}
              </Badge>
              <form action={cancelJobAction}>
                <input type="hidden" name="id" value={activeJob.id} />
                <button
                  type="submit"
                  className="text-[11px] font-semibold text-muted-foreground hover:text-red-500 transition-colors ml-1 px-2 py-0.5 rounded border border-border hover:border-red-500/30 hover:bg-red-500/10 cursor-pointer"
                  title="Cancel this crawl"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
          <div className="mt-3 h-2.5 w-full rounded-full bg-indigo-100 dark:bg-zinc-800 overflow-hidden relative">
            <div
              className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 animate-stripes transition-all duration-500 ease-out"
              style={{
                width: `${Math.max(activeJob.status === "queued" ? 4 : 2, Math.min(100, activeJob.progress))}%`,
              }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[12px] text-muted-foreground">
            <span>
              {activeJob.progressLabel ??
                (activeJob.status === "queued"
                  ? "Queued in worker — initializing crawl..."
                  : "Analyzing pages and discovering links...")}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground tabular-nums">
                {activeJob.progress}% completed
              </span>
              <span>·</span>
              <span>Started {formatRelative(activeJob.createdAt)}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Site Audit:</span>
            <span className="text-blue-600 dark:text-blue-400">{domain}</span>
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span>{domain}</span>
            <span>
              {crawl ? `Updated ${formatDateTime(crawl.finishedAt)}` : "Never crawled"}
            </span>
            <span className="flex items-center gap-1 capitalize">
              {targetDevice === "desktop" ? (
                <Monitor className="size-3.5" />
              ) : (
                <Smartphone className="size-3.5" />
              )}
              {targetDevice}
            </span>
            {/* The crawler fetches raw HTML and never runs a browser engine. */}
            <span>JS rendering: Disabled</span>
            <span>
              Pages crawled: {formatNumber(pagesCrawled)}/{formatNumber(project.crawlLimit)}
            </span>
            {crawl?.crawlProfile ? (
              <span className="capitalize">Profile: {crawl.crawlProfile}</span>
            ) : null}
            {crawl?.protectionDetected ? (
              <Badge tone="warning">{crawl.protectionDetected}</Badge>
            ) : null}
          </div>
        </div>
        <div>{runButton}</div>
      </div>

      {/* 1. Main Site Health & Issue Summary Grid */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Site Health Score Gauge */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-surface p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[12px] text-muted-foreground font-semibold uppercase tracking-wider">
              <span>Site Health</span>
              <SiteHealthInfoModal
                healthScore={healthScore}
                pagesCrawled={pagesCrawled}
                criticalCount={criticalCount}
                warningCount={warningCount}
                noticeCount={noticeCount}
                slug={slug}
              />
            </div>

            <div className="mt-6 flex flex-col items-center justify-center text-center">
              <div className="relative flex size-36 items-center justify-center">
                <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                  <path
                    className="text-zinc-100 dark:text-zinc-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={
                      healthScore >= 80
                        ? "text-emerald-500"
                        : healthScore >= 50
                          ? "text-amber-500"
                          : healthScore > 0
                            ? "text-red-500"
                            : "text-zinc-300 dark:text-zinc-700"
                    }
                    strokeDasharray={`${healthScore}, 100`}
                    strokeLinecap="round"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground font-display">
                    {crawl ? `${healthScore}%` : "0%"}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    {crawl ? (healthScore >= 80 ? "Good" : healthScore >= 50 ? "Fair" : "Poor") : "Unknown"}
                  </span>
                </div>
              </div>

              <div className="mt-4 text-[12px] text-muted-foreground">
                {previous?.healthScore != null ? (
                  <div className="flex items-center gap-1">
                    <span>Change:</span>
                    <Delta value={healthScore - Math.round(previous.healthScore)} invert={false} />
                  </div>
                ) : (
                  <span>{crawl ? "No previous crawl comparison" : "0 score (crawl required)"}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Crawled Pages Breakdown & Issue Metrics */}
        <div className="lg:col-span-8 grid gap-4 sm:grid-cols-3">
          {/* Critical Errors */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-red-500" />
                <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                  Errors
                </span>
              </div>
              <ErrorsInfoModal criticalCount={criticalCount} />
            </div>
            <div className="mt-4">
              <div className="text-[32px] font-extrabold text-red-600 dark:text-red-400 font-display leading-none">
                {criticalCount}
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                {criticalCount > 0 ? "Critical issues to fix" : "0 critical errors"}
              </p>
              <Sparkline values={errorTrend} tone="critical" />
            </div>
          </div>

          {/* Warnings */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-xs flex flex-col justify-between hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-amber-500" />
                <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                  Warnings
                </span>
              </div>
              <div className="flex items-center gap-1">
                <WarningsInfoModal warningCount={warningCount} slug={slug} />
                <Link
                  href={`/${slug}/audit/warnings`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full p-1 text-muted-foreground hover:text-amber-500 hover:bg-surface-muted transition-colors cursor-pointer"
                  title="Open all warnings in a new verbose page"
                >
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href={`/${slug}/audit/warnings`}
                target="_blank"
                rel="noopener noreferrer"
                className="group/num inline-block"
                title="Click to view all warnings"
              >
                <div className="text-[32px] font-extrabold text-amber-500 font-display leading-none group-hover/num:scale-105 transition-transform origin-left">
                  {warningCount}
                </div>
              </Link>
              <div className="mt-2 text-[12px] text-muted-foreground flex items-center justify-between">
                <span>{warningCount > 0 ? "Medium priority issues" : "0 warnings"}</span>
                <Link
                  href={`/${slug}/audit/warnings`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
                >
                  View full verbose ↗
                </Link>
              </div>
              <Sparkline values={warningTrend} tone="warning" />
            </div>
          </div>

          {/* Notices */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-blue-500" />
                <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                  Notices
                </span>
              </div>
              <NoticesInfoModal noticeCount={noticeCount} />
            </div>
            <div className="mt-4">
              <div className="text-[32px] font-extrabold text-blue-600 dark:text-blue-400 font-display leading-none">
                {noticeCount}
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                {noticeCount > 0 ? "Minor recommendations" : "0 notices"}
              </p>
            </div>
          </div>

          {/* Crawled Pages Counter & Breakdown */}
          <div className="sm:col-span-3 rounded-xl border border-border bg-surface p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-foreground">Crawled Pages</span>
                <span className="text-[12px] text-muted-foreground">({pagesCrawled} / {project.crawlLimit} max)</span>
                <CrawledPagesInfoModal pagesCrawled={pagesCrawled} crawlLimit={project.crawlLimit} />
              </div>
              <div className="text-[12px] text-muted-foreground">
                Domain: <span className="font-semibold text-foreground">{domain}</span>
              </div>
            </div>

            <BreakdownBar buckets={pageBreakdown} />

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              {pageBreakdown.map((bucket) => (
                <div key={bucket.label} className="rounded-lg bg-surface-muted p-2.5">
                  <span className="text-[11px] text-muted-foreground block">
                    {bucket.label}
                  </span>
                  <span
                    className={`text-[16px] font-bold mt-0.5 block ${bucket.tone}`}
                  >
                    {formatNumber(bucket.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. AI Search readiness */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* AI Search Health */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-purple-500" />
              <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                AI Search Health
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AISearchInfoModal />
              <Badge tone="accent">beta</Badge>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-6">
            <div className="relative flex size-28 shrink-0 items-center justify-center">
              <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                <path
                  className="text-zinc-100 dark:text-zinc-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={
                    aiScore === null
                      ? "text-zinc-300 dark:text-zinc-700"
                      : aiScore >= 80
                        ? "text-emerald-500"
                        : aiScore >= 50
                          ? "text-amber-500"
                          : "text-red-500"
                  }
                  strokeDasharray={`${aiScore ?? 0}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-2xl font-extrabold tracking-tight text-foreground font-display">
                {aiScore === null ? "—" : `${aiScore}%`}
              </span>
            </div>

            <div className="min-w-0 space-y-2">
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                {aiScore === null
                  ? "Run an audit to measure how readable this site is for AI assistants."
                  : aiScore >= 80
                    ? "Website is well optimized for AI search engines."
                    : "AI assistants will struggle to read or cite parts of this site."}
              </p>
              <div className="flex flex-wrap gap-3 text-[12px] text-muted-foreground">
                <span>
                  llms.txt:{" "}
                  <span className="font-semibold text-foreground">
                    {crawl?.llmsTxtFound == null
                      ? "—"
                      : crawl.llmsTxtFound
                        ? "Found"
                        : "Not found"}
                  </span>
                </span>
                {crawl ? (
                  <Link
                    href={`/${slug}/pages`}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {aiIssueCount} {aiIssueCount === 1 ? "issue" : "issues"}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Blocked from AI Search */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Blocked from AI Search
            </span>
            <span className="text-[12px] text-muted-foreground">
              Pages crawled: {formatNumber(pagesCrawled)}
            </span>
          </div>

          {botAccess.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">
              Run an audit to read this site&apos;s robots.txt rules.
            </p>
          ) : (
            <>
              <ul className="mt-4 space-y-2">
                {[...aiBots, ...searchBots].slice(0, 6).map((bot) => (
                  <li
                    key={bot.bot}
                    className="flex items-center justify-between gap-3 text-[13px]"
                  >
                    <span className="font-medium text-foreground truncate">
                      {bot.label}
                    </span>
                    {bot.allowed ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="size-3.5" /> All good
                      </span>
                    ) : (
                      <span
                        className="flex items-center gap-1 text-red-600 dark:text-red-400 shrink-0"
                        title={bot.blockedSample.join(", ")}
                      >
                        <AlertCircle className="size-3.5" />
                        {bot.blockedSample.length} blocked
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
                {blockedBots.length === 0
                  ? "Every tracked crawler can reach the pages we found."
                  : `${blockedBots.length} of ${botAccess.length} tracked crawlers are disallowed somewhere in robots.txt.`}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Country targeting */}
      {crawl ? (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-sky-500" />
              <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                Country Targeting
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
              <span>
                Project target:{" "}
                <span className="font-semibold text-foreground">
                  {countryName.get(targetCountry) ?? targetCountry}
                </span>
              </span>
              {crawl.hreflangProblems > 0 ? (
                <Badge tone="warning">
                  {crawl.hreflangProblems} hreflang{" "}
                  {crawl.hreflangProblems === 1 ? "problem" : "problems"}
                </Badge>
              ) : null}
              {crawl.localeForcesRedirect ? (
                <Badge tone="critical">Forces locale redirect</Badge>
              ) : null}
            </div>
          </div>

          {countriesTargeted.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">
              No country targeting signals found — no ccTLD, locale URLs, hreflang,
              or country data in structured data. The site reads as single-market.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {countriesTargeted.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-[12px]"
                    title={(countrySources[code] ?? []).join(", ")}
                  >
                    <span className="font-semibold text-foreground">{code}</span>
                    <span className="text-muted-foreground">
                      {countryName.get(code) ?? "Unknown"}
                    </span>
                    <span className="text-[10px] text-subtle-foreground">
                      {(countrySources[code] ?? []).join(" · ")}
                    </span>
                  </span>
                ))}
              </div>

              {!countriesTargeted.includes(targetCountry) ? (
                <p className="mt-3 border-t border-border pt-3 text-[12px] text-amber-600 dark:text-amber-400">
                  This project targets{" "}
                  {countryName.get(targetCountry) ?? targetCountry}, but the crawl
                  found no signal targeting that country.
                </p>
              ) : null}
            </>
          )}

          {crawl.hreflangLanguages && crawl.hreflangLanguages.length > 0 ? (
            <p className="mt-3 text-[12px] text-muted-foreground">
              Languages declared: {crawl.hreflangLanguages.join(", ")} across{" "}
              {formatNumber(crawl.hreflangPages)}{" "}
              {crawl.hreflangPages === 1 ? "page" : "pages"}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* 3. Thematic Reports Matrix */}
      <div className="space-y-3">
        <h3 className="text-[16px] font-bold tracking-tight text-foreground">
          Thematic Reports
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* robots.txt is a yes/no fact, not a percentage */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-xs flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-zinc-500" />
                <span className="text-[13px] font-bold text-foreground">Robots.txt</span>
                <RobotsTxtInfoModal sitemapUrls={crawl?.sitemapUrls} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {crawl?.sitemapUrls
                  ? `${formatNumber(crawl.sitemapUrls)} sitemap URLs discovered`
                  : "Crawl directives & sitemap discovery"}
              </p>
            </div>
            <div className="text-right shrink-0">
              {crawl ? (
                <>
                  <span
                    className={`text-[13px] font-extrabold ${crawl.robotsTxtFound ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                  >
                    {crawl.robotsTxtFound ? "Found" : "Missing"}
                  </span>
                  <a
                    href={new URL("/robots.txt", project.domain).toString()}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Open file <ArrowUpRight className="size-3" />
                  </a>
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground">Run an audit</span>
              )}
            </div>
          </div>

          {/* llms.txt AI navigation file */}
          <LlmsTxtCard
            initialFound={crawl?.llmsTxtFound ?? null}
            domain={project.domain}
          />

          {thematicReports.map((report) => (
            <ScoreCard
              key={report.label}
              report={report}
              hasCrawl={Boolean(crawl)}
              slug={slug}
              issuePages={counts}
            />
          ))}
        </div>
      </div>

      {/* Bot coverage & crawl traps */}
      {crawl ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Bot coverage</CardTitle>
              <span className="text-[11px] text-muted-foreground">
                What ran on this crawl
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {botCoverage.map((entry) => (
                <div
                  key={entry.label}
                  className="flex items-baseline justify-between gap-4 border-b border-border pb-2.5 last:border-0 last:pb-0"
                >
                  <span className="text-[13px] text-muted-foreground shrink-0">
                    {entry.label}
                  </span>
                  <div className="text-right min-w-0">
                    <span className="text-[13px] font-medium text-foreground">
                      {entry.value}
                    </span>
                    {entry.note ? (
                      <span className="block text-[11px] leading-snug text-subtle-foreground">
                        {entry.note}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Crawl traps</CardTitle>
              {trapPatterns.length > 0 ? (
                <Badge tone="warning">
                  {formatNumber(crawl.trapAffectedUrls)} URLs
                </Badge>
              ) : (
                <Badge tone="success">None</Badge>
              )}
            </CardHeader>
            <CardContent>
              {trapPatterns.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  No infinite URL spaces found among the {formatNumber(crawl.pagesFound)}{" "}
                  URLs discovered.
                </p>
              ) : (
                <ul className="space-y-3">
                  {trapPatterns.map((pattern) => (
                    <li
                      key={pattern.kind}
                      className="border-b border-border pb-2.5 last:border-0 last:pb-0"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-medium capitalize text-foreground">
                          {pattern.kind.replace(/_/g, " ")}
                        </span>
                        <span className="text-[12px] tabular-nums text-muted-foreground shrink-0">
                          {formatNumber(pattern.urlCount)} URLs
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                        {pattern.detail}
                      </p>
                      <p className="mt-1 truncate font-mono text-[11px] text-subtle-foreground">
                        {pattern.example}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* 3. Top Issues List */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-bold tracking-tight text-foreground">
              {activeReport ? `${activeReport} issues` : "Top Issues"}
            </h3>
            {activeReport ? (
              <Link
                href={`/${slug}/audit`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Clear filter
                <X className="size-3" />
              </Link>
            ) : null}
          </div>
          <span className="text-[12px] text-muted-foreground">
            {visibleIssueTypes} {visibleIssueTypes === 1 ? "issue type" : "issue types"}
            {activeReport ? " in this report" : " detected"}
          </span>
        </div>

        {visibleIssueTypes === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-xs">
            <CheckCircle2 className="size-10 text-emerald-500 mx-auto" />
            <h4 className="mt-3 text-[15px] font-bold text-foreground">
              {activeReport
                ? `Nothing to fix under ${activeReport}`
                : crawl
                  ? "No technical issues detected"
                  : "0 issues recorded"}
            </h4>
            <p className="mt-1 text-[13px] text-muted-foreground max-w-sm mx-auto">
              {activeReport
                ? "Every page passed the checks behind this report."
                : crawl
                  ? "Every crawled page passed all audit checks cleanly."
                  : "No crawl data recorded yet for this website. Run a site crawl to identify issues."}
            </p>
          </div>
        ) : (
          [...grouped.entries()]
            .filter(([, list]) => list.length > 0)
            .sort(([a], [b]) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b])
            .map(([severity, list]) => (
              <Card key={severity} className="rounded-xl border-border shadow-xs">
                <CardHeader className="py-3 px-5 border-b border-border flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`size-2 rounded-full ${
                        severity === "critical"
                          ? "bg-red-500"
                          : severity === "warning"
                            ? "bg-amber-500"
                            : "bg-blue-500"
                      }`}
                    />
                    <CardTitle className="capitalize text-[14px]">
                      {severity} issues
                    </CardTitle>
                  </div>
                  <Badge tone={severityTone[severity]}>
                    {list.length} {list.length === 1 ? "issue" : "issues"}
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <Tbody>
                      {list.map(({ code, pages }) => {
                        const definition = ISSUE_BY_CODE.get(code)!;
                        const before = previousCounts.get(code) ?? 0;
                        return (
                          <Tr key={code}>
                            <Td className="py-3.5 px-5">
                              <span className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/${slug}/pages?issue=${code}`}
                                  className="font-semibold text-foreground hover:text-blue-600 text-[13px]"
                                >
                                  {definition.label}
                                </Link>
                                {AI_SEARCH_CODES.has(code) ? (
                                  <span className="rounded-[4px] bg-purple-100 dark:bg-purple-950/40 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                                    AI Search
                                  </span>
                                ) : null}
                              </span>
                              <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-muted-foreground">
                                {definition.description}
                              </p>
                              {issueSamples.get(code) ? (
                                <p className="mt-1 text-[11px] text-foreground/80">
                                  <span className="text-subtle-foreground">
                                    Example:{" "}
                                  </span>
                                  {issueSamples.get(code)}
                                </p>
                              ) : null}
                              <p className="mt-1 text-[11px] text-subtle-foreground">
                                Fix: {definition.howToFix}
                              </p>
                            </Td>
                            <Td className="w-36 text-right align-top py-3.5 px-5">
                              <div className="text-[15px] font-bold tabular-nums text-foreground">
                                {formatNumber(pages)}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {pages === 1 ? "page" : "pages"}
                              </div>
                              {previous ? <Delta value={pages - before} /> : null}
                              <div className="mt-2 flex justify-end">
                                <TaskDialog
                                  projectId={projectId}
                                  initialTitle={`Fix: ${definition.label}`}
                                  initialDescription={definition.howToFix}
                                  initialIssueCode={code}
                                  trigger={
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="rounded-[6px] h-6 px-2 text-[11px]"
                                    >
                                      <Plus className="size-3 mr-0.5" />
                                      Task
                                    </Button>
                                  }
                                />
                              </div>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </CardContent>
              </Card>
            ))
        )}
      </div>

      {/* 4. Crawl History */}
      {history.length > 0 ? (
        <Card className="rounded-xl border-border shadow-xs">
          <CardHeader className="py-3 px-5 border-b border-border">
            <CardTitle className="text-[14px]">Crawl History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrap className="rounded-none border-0">
              <Table>
                <Thead>
                  <tr>
                    <Th>Started</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Pages</Th>
                    <Th className="text-right">Issues</Th>
                    <Th className="text-right">Score</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {history.map((entry) => (
                    <Tr key={entry.id}>
                      <Td className="text-muted-foreground text-[12px]">
                        {formatDateTime(entry.startedAt ?? entry.createdAt)}
                      </Td>
                      <Td>
                        <Badge
                          tone={
                            entry.status === "completed"
                              ? "success"
                              : entry.status === "failed"
                                ? "critical"
                                : entry.status === "cancelled"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {entry.status}
                        </Badge>
                      </Td>
                      <Td className="text-right tabular-nums text-muted-foreground text-[12px]">
                        {formatNumber(entry.pagesCrawled)}
                      </Td>
                      <Td className="text-right tabular-nums text-muted-foreground text-[12px]">
                        {formatNumber(entry.issuesFound)}
                      </Td>
                      <Td className="text-right tabular-nums text-[12px] font-bold">
                        {entry.healthScore === null
                          ? "—"
                          : `${Math.round(entry.healthScore)}%`}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
