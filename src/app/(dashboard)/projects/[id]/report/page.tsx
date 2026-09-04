import { desc, eq, sql } from "drizzle-orm";
import {
  CheckCircle2,
  FileText,
  Gauge,
  KeyRound,
  Link2,
  ListTodo,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Stat } from "@/components/ui/stat";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { db } from "@/db";
import {
  backlinks,
  crawls,
  keywordRankings,
  keywords,
  pageIssues,
  psiRuns,
  tasks,
} from "@/db/schema";
import { ISSUE_BY_CODE } from "@/lib/crawler/issue-catalog";
import { getLatestCompletedCrawl, getProjectWithClient } from "@/lib/queries";
import { formatDateTime, formatNumber, hostnameOf } from "@/lib/utils";
import { ReportHeader } from "./report-header";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  const record = await getProjectWithClient(projectId);
  if (!record) notFound();

  const { project, client } = record;

  const [
    crawl,
    projectPsiRuns,
    projectKeywords,
    projectRankings,
    projectBacklinks,
    projectTasks,
  ] = await Promise.all([
    getLatestCompletedCrawl(projectId),
    db
      .select()
      .from(psiRuns)
      .where(eq(psiRuns.projectId, projectId))
      .orderBy(desc(psiRuns.createdAt))
      .limit(5),
    db.select().from(keywords).where(eq(keywords.projectId, projectId)),
    db
      .select({
        keywordId: keywordRankings.keywordId,
        date: keywordRankings.date,
        position: keywordRankings.position,
      })
      .from(keywordRankings)
      .innerJoin(keywords, eq(keywordRankings.keywordId, keywords.id))
      .where(eq(keywords.projectId, projectId))
      .orderBy(desc(keywordRankings.date)),
    db.select().from(backlinks).where(eq(backlinks.projectId, projectId)),
    db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(desc(tasks.createdAt)),
  ]);

  // If crawl exists, query top issues
  let topIssues: { code: string; label: string; severity: string; count: number; fix: string }[] = [];
  if (crawl) {
    const issueRows = await db
      .select({
        code: pageIssues.code,
        count: sql<number>`count(*)`,
      })
      .from(pageIssues)
      .where(eq(pageIssues.crawlId, crawl.id))
      .groupBy(pageIssues.code)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10);

    topIssues = issueRows.map((r) => {
      const def = ISSUE_BY_CODE.get(r.code);
      return {
        code: r.code,
        label: def?.label ?? r.code,
        severity: def?.severity ?? "warning",
        count: r.count,
        fix: def?.howToFix ?? "Review page markup",
      };
    });
  }

  // Calculate ranking stats
  const top10Keywords = projectRankings.filter(
    (r) => r.position != null && r.position <= 10,
  ).length;
  const top3Keywords = projectRankings.filter(
    (r) => r.position != null && r.position <= 3,
  ).length;

  const latestMobilePsi = projectPsiRuns.find((r) => r.strategy === "mobile") ?? projectPsiRuns[0];

  const completedTasks = projectTasks.filter((t) => t.status === "done");
  const pendingTasks = projectTasks.filter((t) => t.status !== "done");

  const healthScore = crawl?.healthScore != null ? Math.round(crawl.healthScore) : null;

  return (
    <div className="space-y-8 print:space-y-6">
      <ReportHeader
        projectName={project.name}
        domain={hostnameOf(project.domain)}
        generatedAt={formatDateTime(new Date())}
      />

      {/* Client Overview Banner */}
      <div className="grid gap-4 rounded-xl border border-border bg-surface p-5 sm:grid-cols-3">
        <div>
          <span className="text-[12px] font-medium text-subtle-foreground uppercase">
            Client
          </span>
          <p className="text-[15px] font-semibold text-foreground">
            {client.name}
          </p>
          {client.contactEmail ? (
            <p className="text-[13px] text-muted-foreground">
              {client.contactEmail}
            </p>
          ) : null}
        </div>
        <div>
          <span className="text-[12px] font-medium text-subtle-foreground uppercase">
            Target Domain
          </span>
          <p className="text-[15px] font-semibold text-foreground">
            {project.domain}
          </p>
          <p className="text-[13px] text-muted-foreground">
            Market: {project.targetCountry} · {project.targetDevice}
          </p>
        </div>
        <div>
          <span className="text-[12px] font-medium text-subtle-foreground uppercase">
            Audit Status
          </span>
          <p className="text-[15px] font-semibold text-foreground">
            {crawl ? `Crawled ${formatNumber(crawl.pagesCrawled)} Pages` : "Not Crawled"}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {crawl?.finishedAt ? `Last run ${formatDateTime(crawl.finishedAt)}` : "—"}
          </p>
        </div>
      </div>

      {/* Executive KPI Summary */}
      <div>
        <h3 className="mb-3 text-[16px] font-bold text-foreground">
          Executive KPI Summary
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Technical Health Score"
            value={healthScore != null ? `${healthScore}/100` : "—"}
            tone={
              healthScore != null && healthScore >= 80
                ? "success"
                : healthScore != null && healthScore >= 50
                ? "warning"
                : "critical"
            }
            hint={
              crawl ? `${crawl.criticalCount} critical issues` : "No audit run"
            }
          />
          <Stat
            label="Mobile PageSpeed"
            value={
              latestMobilePsi?.performanceScore != null
                ? `${latestMobilePsi.performanceScore}/100`
                : "—"
            }
            tone={
              latestMobilePsi?.performanceScore != null &&
              latestMobilePsi.performanceScore >= 80
                ? "success"
                : "warning"
            }
            hint={
              latestMobilePsi?.lcpMs != null
                ? `LCP ${(latestMobilePsi.lcpMs / 1000).toFixed(2)}s`
                : "No PSI run"
            }
          />
          <Stat
            label="Tracked Keywords"
            value={formatNumber(projectKeywords.length)}
            tone="accent"
            hint={`${top10Keywords} rankings in Top 10`}
          />
          <Stat
            label="Backlinks Profile"
            value={formatNumber(projectBacklinks.length)}
            hint={`${
              new Set(projectBacklinks.map((b) => b.sourceDomain)).size
            } referring domains`}
          />
        </div>
      </div>

      {/* Section 1: Technical SEO Audit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-accent" />
            1. Technical Crawl & Site Architecture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {crawl ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3 border-b border-border pb-4">
                <div>
                  <span className="text-[12px] text-muted-foreground">Pages Audited</span>
                  <div className="text-[16px] font-semibold tabular-nums">{formatNumber(crawl.pagesCrawled)}</div>
                </div>
                <div>
                  <span className="text-[12px] text-muted-foreground">Critical Errors</span>
                  <div className="text-[16px] font-semibold tabular-nums text-critical">{formatNumber(crawl.criticalCount)}</div>
                </div>
                <div>
                  <span className="text-[12px] text-muted-foreground">Warnings & Notices</span>
                  <div className="text-[16px] font-semibold tabular-nums text-warning">{formatNumber(crawl.warningCount + crawl.noticeCount)}</div>
                </div>
              </div>

              {topIssues.length > 0 ? (
                <div>
                  <h4 className="text-[13px] font-semibold text-foreground mb-2">Priority Issues & Fixes</h4>
                  <Table>
                    <Thead>
                      <tr>
                        <Th>Issue</Th>
                        <Th>Severity</Th>
                        <Th className="text-right">Pages</Th>
                        <Th>Recommended Fix</Th>
                      </tr>
                    </Thead>
                    <Tbody>
                      {topIssues.map((issue) => (
                        <Tr key={issue.code}>
                          <Td className="font-medium">{issue.label}</Td>
                          <Td>
                            <Badge
                              tone={
                                issue.severity === "critical"
                                  ? "critical"
                                  : issue.severity === "warning"
                                  ? "warning"
                                  : "neutral"
                              }
                              className="capitalize"
                            >
                              {issue.severity}
                            </Badge>
                          </Td>
                          <Td className="text-right tabular-nums font-semibold">{issue.count}</Td>
                          <Td className="text-[13px] text-muted-foreground">{issue.fix}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </div>
              ) : (
                <p className="text-[13px] text-success font-medium">
                  ✓ No technical issues detected in the latest crawl.
                </p>
              )}
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              No crawl has been executed yet. Run a crawl from the Audit tab to populate this section.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Core Web Vitals & PageSpeed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="size-4 text-accent" />
            2. Core Web Vitals & Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latestMobilePsi ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-4 border-b border-border pb-4">
                <div>
                  <span className="text-[12px] text-muted-foreground">Performance</span>
                  <div className="text-[18px] font-bold text-accent">{latestMobilePsi.performanceScore ?? "—"}/100</div>
                </div>
                <div>
                  <span className="text-[12px] text-muted-foreground">SEO Category</span>
                  <div className="text-[18px] font-bold text-success">{latestMobilePsi.seoScore ?? "—"}/100</div>
                </div>
                <div>
                  <span className="text-[12px] text-muted-foreground">Accessibility</span>
                  <div className="text-[18px] font-bold text-warning">{latestMobilePsi.accessibilityScore ?? "—"}/100</div>
                </div>
                <div>
                  <span className="text-[12px] text-muted-foreground">Best Practices</span>
                  <div className="text-[18px] font-bold text-foreground">{latestMobilePsi.bestPracticesScore ?? "—"}/100</div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <span className="text-[12px] text-muted-foreground">LCP (Largest Contentful Paint)</span>
                  <div className="text-[16px] font-semibold tabular-nums mt-0.5">
                    {latestMobilePsi.lcpMs != null ? `${(latestMobilePsi.lcpMs / 1000).toFixed(2)}s` : "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <span className="text-[12px] text-muted-foreground">CLS (Layout Shift)</span>
                  <div className="text-[16px] font-semibold tabular-nums mt-0.5">
                    {latestMobilePsi.cls != null ? String(latestMobilePsi.cls) : "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <span className="text-[12px] text-muted-foreground">INP / Total Blocking Time</span>
                  <div className="text-[16px] font-semibold tabular-nums mt-0.5">
                    {latestMobilePsi.inpMs != null ? `${latestMobilePsi.inpMs}ms` : "—"}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              No PageSpeed audit data available yet. Run a PSI audit from the Performance tab.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Keywords & SERP Rankings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-accent" />
            3. Keyword Rankings & Search Presence
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projectKeywords.length > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3 border-b border-border pb-4">
                <div>
                  <span className="text-[12px] text-muted-foreground">Tracked Pool</span>
                  <div className="text-[16px] font-semibold tabular-nums">{formatNumber(projectKeywords.length)}</div>
                </div>
                <div>
                  <span className="text-[12px] text-muted-foreground">Top 3 Rankings</span>
                  <div className="text-[16px] font-semibold tabular-nums text-success">{formatNumber(top3Keywords)}</div>
                </div>
                <div>
                  <span className="text-[12px] text-muted-foreground">Top 10 Rankings</span>
                  <div className="text-[16px] font-semibold tabular-nums text-accent">{formatNumber(top10Keywords)}</div>
                </div>
              </div>

              <Table>
                <Thead>
                  <tr>
                    <Th>Keyword</Th>
                    <Th className="text-right">Volume</Th>
                    <Th className="text-right">KD%</Th>
                    <Th>Intent</Th>
                    <Th>Target Page</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {projectKeywords.slice(0, 8).map((kw) => (
                    <Tr key={kw.id}>
                      <Td className="font-medium">{kw.keyword}</Td>
                      <Td className="text-right tabular-nums">{kw.searchVolume ? formatNumber(kw.searchVolume) : "—"}</Td>
                      <Td className="text-right tabular-nums">{kw.difficulty ? `${kw.difficulty}%` : "—"}</Td>
                      <Td>{kw.intent ? <Badge tone="outline">{kw.intent}</Badge> : "—"}</Td>
                      <Td className="truncate max-w-xs text-[12px] text-muted-foreground">{kw.targetUrl ?? "—"}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              No keywords tracked yet. Add keywords or import from CSV.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Action Roadmap & Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="size-4 text-accent" />
            4. SEO Action Plan & Completed Milestones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-[13px] font-semibold text-foreground mb-2 flex items-center gap-1.5">
                Pending Action Items ({pendingTasks.length})
              </h4>
              {pendingTasks.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">All assigned tasks completed.</p>
              ) : (
                <ul className="space-y-2">
                  {pendingTasks.map((t) => (
                    <li key={t.id} className="rounded-lg border border-border p-2.5 text-[13px]">
                      <div className="font-medium text-foreground">{t.title}</div>
                      {t.description ? <p className="text-[12px] text-muted-foreground mt-0.5">{t.description}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="text-[13px] font-semibold text-success mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="size-4" />
                Completed Optimizations ({completedTasks.length})
              </h4>
              {completedTasks.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No completed tasks recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {completedTasks.map((t) => (
                    <li key={t.id} className="rounded-lg border border-border/50 bg-surface-muted/30 p-2.5 text-[13px]">
                      <div className="font-medium text-foreground line-through opacity-80">{t.title}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
