import { desc, eq } from "drizzle-orm";
import {
  Activity,
  AlertCircle,
  Clock,
  Gauge,
  Laptop,
  Play,
  Smartphone,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { SubmitButton } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Stat } from "@/components/ui/stat";
import {
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/table";
import { db } from "@/db";
import { psiRuns } from "@/db/schema";
import { getActiveProjectJob } from "@/lib/queries";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { startPsiAction } from "@/app/(dashboard)/projects/[id]/performance/actions";
import {
  PerformanceTrendChart,
  ScoreGauge,
} from "./performance-charts";

export const dynamic = "force-dynamic";

function cwvStatus(
  metric: "lcp" | "cls" | "inp" | "fcp" | "ttfb",
  value: number | null,
) {
  if (value === null) return { label: "N/A", tone: "neutral" as const };
  switch (metric) {
    case "lcp":
      if (value <= 2500) return { label: "Good", tone: "success" as const };
      if (value <= 4000)
        return { label: "Needs Improvement", tone: "warning" as const };
      return { label: "Poor", tone: "critical" as const };
    case "cls":
      if (value <= 0.1) return { label: "Good", tone: "success" as const };
      if (value <= 0.25)
        return { label: "Needs Improvement", tone: "warning" as const };
      return { label: "Poor", tone: "critical" as const };
    case "inp":
      if (value <= 200) return { label: "Good", tone: "success" as const };
      if (value <= 500)
        return { label: "Needs Improvement", tone: "warning" as const };
      return { label: "Poor", tone: "critical" as const };
    case "fcp":
      if (value <= 1800) return { label: "Good", tone: "success" as const };
      if (value <= 3000)
        return { label: "Needs Improvement", tone: "warning" as const };
      return { label: "Poor", tone: "critical" as const };
    case "ttfb":
      if (value <= 800) return { label: "Good", tone: "success" as const };
      if (value <= 1800)
        return { label: "Needs Improvement", tone: "warning" as const };
      return { label: "Poor", tone: "critical" as const };
  }
}

export default async function ProjectPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ strategy?: string }>;
}) {
  const { project: slugOrId } = await params;
  const project = await findProjectBySlugOrId(slugOrId);
  if (!project) notFound();

  const projectId = project.id;
  const slug = toProjectSlug(project.name);

  const query = await searchParams;
  const strategy = (
    query.strategy === "desktop" ? "desktop" : "mobile"
  ) as "mobile" | "desktop";

  const [activeJob, runs] = await Promise.all([
    getActiveProjectJob(projectId, "psi"),
    db
      .select()
      .from(psiRuns)
      .where(eq(psiRuns.projectId, projectId))
      .orderBy(desc(psiRuns.createdAt))
      .limit(30),
  ]);

  const strategyRuns = runs.filter((r) => r.strategy === strategy);
  const latestRun = strategyRuns[0] ?? runs[0] ?? null;

  const runButton = (
    <form action={startPsiAction} className="flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="strategy" value={strategy} />
      <input type="hidden" name="url" value={project.domain} />
      <SubmitButton variant="primary">
        <Play className="size-4" />
        {latestRun ? `Run ${strategy} audit` : "Run first audit"}
      </SubmitButton>
    </form>
  );

  if (activeJob) {
    return (
      <div className="space-y-5">
        <AutoRefresh enabled />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-4 text-accent" />
              PageSpeed audit in progress
            </CardTitle>
            <Badge tone="accent">{activeJob.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={activeJob.progress} />
            <p className="text-[13px] text-muted-foreground">
              {activeJob.progressLabel ??
                "Requesting PageSpeed Insights from Google…"}
            </p>
            <p className="text-[12px] text-subtle-foreground">
              Started {formatRelative(activeJob.createdAt)}. Tracked on{" "}
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

  if (!latestRun) {
    return (
      <div className="space-y-5">
        <Empty
          icon={Gauge}
          title="No PageSpeed audit data yet"
          description={`Run a Google PageSpeed Insights audit for ${project.domain} to measure Core Web Vitals, Lighthouse scores, and optimization opportunities.`}
          action={runButton}
        />
      </div>
    );
  }

  const chartData = [...strategyRuns].reverse().map((run) => ({
    date: run.createdAt.toISOString(),
    formattedDate: new Date(run.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    performance: run.performanceScore,
    seo: run.seoScore,
    accessibility: run.accessibilityScore,
    bestPractices: run.bestPracticesScore,
  }));

  const lcp = cwvStatus("lcp", latestRun.lcpMs);
  const cls = cwvStatus("cls", latestRun.cls);
  const inp = cwvStatus("inp", latestRun.inpMs);
  const fcp = cwvStatus("fcp", latestRun.fcpMs);
  const ttfb = cwvStatus("ttfb", latestRun.ttfbMs);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={strategy === "mobile" ? "primary" : "secondary"}
            size="sm"
            asChild
          >
            <Link href={`/${slug}/performance?strategy=mobile`}>
              <Smartphone className="size-4" />
              Mobile
            </Link>
          </Button>
          <Button
            variant={strategy === "desktop" ? "primary" : "secondary"}
            size="sm"
            asChild
          >
            <Link href={`/${slug}/performance?strategy=desktop`}>
              <Laptop className="size-4" />
              Desktop
            </Link>
          </Button>
          <span className="text-[13px] text-muted-foreground ml-2">
            Last tested {formatDateTime(latestRun.createdAt)}
          </span>
        </div>
        {runButton}
      </div>

      {/* Lighthouse Score Gauges */}
      <Card>
        <CardHeader>
          <CardTitle>Lighthouse scores ({latestRun.strategy})</CardTitle>
          {latestRun.hasFieldData ? (
            <Badge tone="success">CrUX Real-user Data</Badge>
          ) : (
            <Badge tone="outline">Lab Simulated</Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 py-2 sm:grid-cols-4">
            <ScoreGauge
              label="Performance"
              score={latestRun.performanceScore}
            />
            <ScoreGauge
              label="SEO"
              score={latestRun.seoScore}
            />
            <ScoreGauge
              label="Accessibility"
              score={latestRun.accessibilityScore}
            />
            <ScoreGauge
              label="Best Practices"
              score={latestRun.bestPracticesScore}
            />
          </div>
        </CardContent>
      </Card>

      {/* Core Web Vitals */}
      <div>
        <h3 className="mb-3 text-[15px] font-semibold">Core Web Vitals</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="LCP (Largest Contentful)"
            value={latestRun.lcpMs != null ? `${(latestRun.lcpMs / 1000).toFixed(2)}s` : "—"}
            tone={lcp.tone}
            hint={lcp.label}
          />
          <Stat
            label="CLS (Cumulative Shift)"
            value={latestRun.cls != null ? String(latestRun.cls) : "—"}
            tone={cls.tone}
            hint={cls.label}
          />
          <Stat
            label="INP / TBT"
            value={latestRun.inpMs != null ? `${latestRun.inpMs}ms` : "—"}
            tone={inp.tone}
            hint={inp.label}
          />
          <Stat
            label="FCP (First Contentful)"
            value={latestRun.fcpMs != null ? `${(latestRun.fcpMs / 1000).toFixed(2)}s` : "—"}
            tone={fcp.tone}
            hint={fcp.label}
          />
          <Stat
            label="TTFB (Time to First Byte)"
            value={latestRun.ttfbMs != null ? `${latestRun.ttfbMs}ms` : "—"}
            tone={ttfb.tone}
            hint={ttfb.label}
          />
        </div>
      </div>

      {/* Trend chart */}
      {chartData.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Score history ({strategy})</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceTrendChart data={chartData} />
          </CardContent>
        </Card>
      ) : null}

      {/* Opportunities */}
      {latestRun.opportunities && latestRun.opportunities.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Optimization opportunities</CardTitle>
            <Badge tone="accent">{latestRun.opportunities.length} suggestions</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <tr>
                  <Th>Opportunity</Th>
                  <Th className="text-right">Estimated Savings</Th>
                </tr>
              </Thead>
              <Tbody>
                {latestRun.opportunities.map((item) => (
                  <Tr key={item.id}>
                    <Td className="font-medium text-foreground">
                      {item.title}
                    </Td>
                    <Td className="text-right tabular-nums text-warning font-semibold">
                      {item.savingsMs >= 1000
                        ? `${(item.savingsMs / 1000).toFixed(2)}s`
                        : `${item.savingsMs}ms`}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Audit runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrap className="rounded-none border-0">
            <Table>
              <Thead>
                <tr>
                  <Th>Tested</Th>
                  <Th>Strategy</Th>
                  <Th className="text-right">Performance</Th>
                  <Th className="text-right">SEO</Th>
                  <Th className="text-right">LCP</Th>
                  <Th className="text-right">CLS</Th>
                  <Th className="text-right">INP/TBT</Th>
                </tr>
              </Thead>
              <Tbody>
                {runs.map((run) => (
                  <Tr key={run.id}>
                    <Td className="text-muted-foreground">
                      {formatDateTime(run.createdAt)}
                    </Td>
                    <Td>
                      <Badge tone="outline" className="capitalize">
                        {run.strategy}
                      </Badge>
                    </Td>
                    <Td className="text-right tabular-nums font-semibold">
                      {run.performanceScore ?? "—"}
                    </Td>
                    <Td className="text-right tabular-nums text-muted-foreground">
                      {run.seoScore ?? "—"}
                    </Td>
                    <Td className="text-right tabular-nums text-muted-foreground">
                      {run.lcpMs != null ? `${(run.lcpMs / 1000).toFixed(2)}s` : "—"}
                    </Td>
                    <Td className="text-right tabular-nums text-muted-foreground">
                      {run.cls ?? "—"}
                    </Td>
                    <Td className="text-right tabular-nums text-muted-foreground">
                      {run.inpMs != null ? `${run.inpMs}ms` : "—"}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>
    </div>
  );
}
