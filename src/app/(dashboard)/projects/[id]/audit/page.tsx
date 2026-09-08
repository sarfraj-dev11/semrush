import { eq, sql } from "drizzle-orm";
import { AlertTriangle, Play, Plus, Radar } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { SubmitButton } from "@/components/form";
import { TaskDialog } from "../tasks/task-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Stat } from "@/components/ui/stat";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { db } from "@/db";
import { pageIssues } from "@/db/schema";
import {
  ISSUE_BY_CODE,
  SEVERITY_ORDER,
  type IssueSeverity,
} from "@/lib/crawler/issue-catalog";
import {
  getActiveProjectJob,
  getCrawlHistory,
  getLatestCompletedCrawl,
  getPreviousCompletedCrawl,
  getProjectWithClient,
} from "@/lib/queries";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/utils";
import { startCrawlAction } from "./actions";

export const dynamic = "force-dynamic";

const severityTone = {
  critical: "critical",
  warning: "warning",
  notice: "notice",
} as const;

/** Counts distinct pages affected per issue code within one crawl. */
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

function Delta({ value, invert = true }: { value: number; invert?: boolean }) {
  if (value === 0) return null;
  // For issue counts, fewer is better — hence invert by default.
  const good = invert ? value < 0 : value > 0;
  return (
    <span
      className={`text-[12px] font-medium tabular-nums ${good ? "text-success" : "text-critical"}`}
    >
      {value > 0 ? "+" : ""}
      {value}
    </span>
  );
}

export default async function AuditPage({
  params,
}: PageProps<"/projects/[id]/audit">) {
  const { id } = await params;
  const projectId = Number(id);
  const record = await getProjectWithClient(projectId);
  if (!record) notFound();

  const [activeJob, crawl, history] = await Promise.all([
    getActiveProjectJob(projectId, "crawl"),
    getLatestCompletedCrawl(projectId),
    getCrawlHistory(projectId),
  ]);

  const runButton = (
    <form action={startCrawlAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <SubmitButton variant="primary">
        <Play className="size-4" />
        {crawl ? "Run new crawl" : "Run first crawl"}
      </SubmitButton>
    </form>
  );

  if (activeJob) {
    return (
      <div className="space-y-5">
        <AutoRefresh enabled />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Crawl in progress</CardTitle>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-600/10 dark:bg-indigo-400/10 px-2 py-0.5 text-[12px] font-extrabold font-mono text-indigo-600 dark:text-indigo-400 tabular-nums border border-indigo-600/20 dark:border-indigo-400/20">
                {activeJob.progress}%
              </span>
              <Badge tone="accent" className="capitalize">{activeJob.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={activeJob.progress} />
            <div className="flex items-center justify-between text-[13px]">
              <p className="text-muted-foreground">
                {activeJob.progressLabel ?? "Waiting for the worker to pick this up…"}
              </p>
              <span className="font-bold text-foreground tabular-nums">
                {activeJob.progress}% completed
              </span>
            </div>
            <p className="text-[12px] text-subtle-foreground">
              Started {formatRelative(activeJob.createdAt)}. You can leave this
              page — progress is tracked on{" "}
              <Link href="/jobs" className="text-accent hover:underline">
                Jobs
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!crawl) {
    const lastFailed = history.find((entry) => entry.status === "failed");
    return (
      <div className="space-y-5">
        {lastFailed ? (
          <Card className="border-critical/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-critical">
                <AlertTriangle className="size-4" />
                Last crawl failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-muted-foreground">
                {lastFailed.error ?? "No error message was recorded."}
              </p>
            </CardContent>
          </Card>
        ) : null}
        <Empty
          icon={Radar}
          title="No completed crawl yet"
          description="Crawl the site to collect pages, technical issues and the internal link graph. The background worker must be running (npm run dev:all)."
          action={runButton}
        />
      </div>
    );
  }

  const previous = await getPreviousCompletedCrawl(projectId, crawl.id);
  const [counts, previousCounts] = await Promise.all([
    issueCounts(crawl.id),
    previous ? issueCounts(previous.id) : Promise.resolve(new Map()),
  ]);

  const grouped = new Map<IssueSeverity, { code: string; pages: number }[]>([
    ["critical", []],
    ["warning", []],
    ["notice", []],
  ]);

  for (const [code, pages] of counts) {
    const definition = ISSUE_BY_CODE.get(code);
    if (!definition) continue;
    grouped.get(definition.severity)!.push({ code, pages });
  }

  for (const list of grouped.values()) list.sort((a, b) => b.pages - a.pages);

  const score = Math.round(crawl.healthScore ?? 0);
  const scoreTone = score >= 80 ? "success" : score >= 50 ? "warning" : "critical";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          Last crawled {formatDateTime(crawl.finishedAt)} ·{" "}
          {formatNumber(crawl.pagesCrawled)} pages
          {crawl.sitemapUrls !== null
            ? ` · ${formatNumber(crawl.sitemapUrls)} sitemap URLs`
            : ""}
          {crawl.robotsTxtFound === false ? " · no robots.txt" : ""}
        </p>
        {runButton}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Health score"
          value={score}
          tone={scoreTone}
          hint={
            previous?.healthScore != null ? (
              <Delta
                value={score - Math.round(previous.healthScore)}
                invert={false}
              />
            ) : (
              "No previous crawl to compare"
            )
          }
        />
        <Stat
          label="Pages crawled"
          value={formatNumber(crawl.pagesCrawled)}
          hint={`${formatNumber(crawl.pagesFound)} URLs discovered`}
        />
        <Stat
          label="Critical"
          value={formatNumber(crawl.criticalCount)}
          tone="critical"
          hint={
            previous ? (
              <Delta value={crawl.criticalCount - previous.criticalCount} />
            ) : undefined
          }
        />
        <Stat
          label="Warnings"
          value={formatNumber(crawl.warningCount)}
          tone="warning"
          hint={
            previous ? (
              <Delta value={crawl.warningCount - previous.warningCount} />
            ) : undefined
          }
        />
        <Stat
          label="Notices"
          value={formatNumber(crawl.noticeCount)}
          tone="notice"
          hint={
            previous ? (
              <Delta value={crawl.noticeCount - previous.noticeCount} />
            ) : undefined
          }
        />
      </div>

      {counts.size === 0 ? (
        <Empty
          title="No issues found"
          description="Every checked page passed. Worth re-running after your next release."
        />
      ) : (
        [...grouped.entries()]
          .filter(([, list]) => list.length > 0)
          .sort(([a], [b]) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b])
          .map(([severity, list]) => (
            <Card key={severity}>
              <CardHeader>
                <CardTitle className="capitalize">{severity}</CardTitle>
                <Badge tone={severityTone[severity]}>
                  {list.length} {list.length === 1 ? "check" : "checks"}
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
                          <Td className="py-3.5">
                            <Link
                              href={`/projects/${projectId}/pages?issue=${code}`}
                              className="font-medium hover:text-accent"
                            >
                              {definition.label}
                            </Link>
                            <p className="mt-0.5 max-w-xl text-[13px] leading-5 text-muted-foreground">
                              {definition.description}
                            </p>
                            <p className="mt-1 text-[12px] text-subtle-foreground">
                              Fix: {definition.howToFix}
                            </p>
                          </Td>
                          <Td className="w-36 text-right align-top">
                            <div className="text-[15px] font-semibold tabular-nums">
                              {formatNumber(pages)}
                            </div>
                            <div className="text-[12px] text-subtle-foreground">
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
                                    className="h-6 px-2 text-[11px]"
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

      {history.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Crawl history</CardTitle>
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
                      <Td className="text-muted-foreground">
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
                      <Td className="text-right tabular-nums text-muted-foreground">
                        {formatNumber(entry.pagesCrawled)}
                      </Td>
                      <Td className="text-right tabular-nums text-muted-foreground">
                        {formatNumber(entry.issuesFound)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {entry.healthScore === null
                          ? "—"
                          : Math.round(entry.healthScore)}
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
