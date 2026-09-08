import { and, desc, eq } from "drizzle-orm";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Flame,
  Globe,
  Laptop,
  Minus,
  Plus,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DailyTrackingBanner } from "@/app/(dashboard)/projects/[id]/rankings/daily-tracking-banner";
import { KeywordDialog } from "@/app/(dashboard)/projects/[id]/keywords/keyword-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Stat } from "@/components/ui/stat";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { db } from "@/db";
import { keywordRankings, keywords } from "@/db/schema";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";
import { getCountryFlagUrl } from "@/lib/countries";
import { formatDate, formatNumber } from "@/lib/utils";
import { syncKeywordsAndRankingsFromFirebase } from "@/lib/firebase-tracking";
import {
  KeywordMonthlyRankViewer,
  PositionDistributionChart,
  SingleKeywordRankChart,
} from "./ranking-charts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getCtrByPosition(pos: number | null): number {
  if (pos === null || pos <= 0 || pos > 100) return 0;
  if (pos === 1) return 0.32;
  if (pos === 2) return 0.18;
  if (pos === 3) return 0.11;
  if (pos <= 10) return Math.max(0.02, 0.09 - (pos - 4) * 0.012);
  if (pos <= 20) return 0.012;
  if (pos <= 50) return 0.004;
  return 0.001;
}

function getGooglePageBadge(pos: number | null) {
  if (pos === null || pos <= 0 || pos > 100) {
    return (
      <span className="inline-flex items-center rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        &gt; Page 10
      </span>
    );
  }
  const page = Math.ceil(pos / 10);
  if (page === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
        Page 1 <span className="text-[10px] font-normal">(Top 10)</span>
      </span>
    );
  }
  if (page <= 3) {
    return (
      <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-500">
        Page {page}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">
      Page {page}
    </span>
  );
}

export default async function ProjectRankingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { project: slugOrId } = await params;
  const project = await findProjectBySlugOrId(slugOrId);
  if (!project) notFound();

  const projectId = project.id;
  const slug = toProjectSlug(project.name);

  // Sync latest keywords and rankings from Firebase only if local project has no keywords yet
  const localKwCheck = await db
    .select({ id: keywords.id })
    .from(keywords)
    .where(eq(keywords.projectId, projectId))
    .limit(1);

  if (localKwCheck.length === 0) {
    try {
      await syncKeywordsAndRankingsFromFirebase(projectId);
    } catch (err) {
      console.error("⚠️ [ProjectRankingsPage] Failed to sync from Firebase:", err);
    }
  }

  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim() : "";

  // Get all keywords and rankings
  const [projectKeywords, allRankings] = await Promise.all([
    db.select().from(keywords).where(eq(keywords.projectId, projectId)),
    db
      .select({
        id: keywordRankings.id,
        keywordId: keywordRankings.keywordId,
        date: keywordRankings.date,
        position: keywordRankings.position,
        url: keywordRankings.url,
        device: keywordRankings.device,
        country: keywordRankings.country,
      })
      .from(keywordRankings)
      .innerJoin(keywords, eq(keywordRankings.keywordId, keywords.id))
      .where(eq(keywords.projectId, projectId))
      .orderBy(desc(keywordRankings.date)),
  ]);

  if (projectKeywords.length === 0) {
    return (
      <div className="space-y-6">
        <DailyTrackingBanner
          projectId={projectId}
          projectName={project.name}
          lastChecked={null}
          totalKeywords={0}
        />
        <Empty
          icon={TrendingUp}
          title="No tracked keywords yet"
          description="Add keywords to start tracking daily Google rankings across the Top 10 Pages (Positions 1–100) at 6:00 PM IST."
          action={
            <div className="flex items-center gap-2">
              <Button variant="primary" asChild>
                <Link href="/imports">Import Rankings CSV</Link>
              </Button>
              <KeywordDialog
                projectId={projectId}
                trigger={
                  <Button variant="secondary">
                    <Plus className="size-4" />
                    Add Keywords
                  </Button>
                }
              />
            </div>
          }
        />
      </div>
    );
  }

  if (allRankings.length === 0) {
    return (
      <div className="space-y-6">
        <DailyTrackingBanner
          projectId={projectId}
          projectName={project.name}
          lastChecked={null}
          totalKeywords={projectKeywords.length}
        />
        <Empty
          icon={TrendingUp}
          title="Rankings Not Checked Yet"
          description={`You have ${projectKeywords.length} tracked keywords ready. Click "Check Rankings Now" above to check their positions on Google's Top 10 Pages immediately, or wait for the automated daily check at 6:00 PM IST.`}
          action={
            <div className="flex items-center gap-2">
              <Button variant="primary" asChild>
                <Link href="/imports">Import Rankings CSV</Link>
              </Button>
              <KeywordDialog
                projectId={projectId}
                trigger={
                  <Button variant="secondary">
                    <Plus className="size-4" />
                    Add More Keywords
                  </Button>
                }
              />
            </div>
          }
        />
      </div>
    );
  }

  // Find distinct dates sorted chronologically
  const dates = Array.from(new Set(allRankings.map((r) => r.date))).sort();
  const latestDate = dates[dates.length - 1];
  const previousDate = dates.length > 1 ? dates[dates.length - 2] : null;

  // Group rankings by date for time-series chart
  const dateHistoryMap = new Map<
    string,
    {
      top3: number;
      top10: number;
      top20: number;
      top50: number;
      top100: number;
      positions: number[];
    }
  >();

  for (const date of dates) {
    dateHistoryMap.set(date, {
      top3: 0,
      top10: 0,
      top20: 0,
      top50: 0,
      top100: 0,
      positions: [],
    });
  }

  for (const r of allRankings) {
    const entry = dateHistoryMap.get(r.date);
    if (entry && r.position != null) {
      entry.positions.push(r.position);
      if (r.position <= 3) entry.top3++;
      else if (r.position <= 10) entry.top10++;
      else if (r.position <= 20) entry.top20++;
      else if (r.position <= 50) entry.top50++;
      else if (r.position <= 100) entry.top100++;
    }
  }

  const chartData = dates.map((date) => {
    const entry = dateHistoryMap.get(date)!;
    const avg =
      entry.positions.length > 0
        ? Math.round(
            (entry.positions.reduce((a, b) => a + b, 0) /
              entry.positions.length) *
              10,
          ) / 10
        : 0;

    return {
      date,
      formattedDate: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      top3: entry.top3,
      top10: entry.top10,
      top20: entry.top20,
      top50: entry.top50,
      top100: entry.top100,
      avgPosition: avg,
    };
  });

  // Calculate latest stats per keyword
  const latestRankingsMap = new Map<number, typeof allRankings[0]>();
  const previousRankingsMap = new Map<number, typeof allRankings[0]>();

  for (const r of allRankings) {
    if (r.date === latestDate && !latestRankingsMap.has(r.keywordId)) {
      latestRankingsMap.set(r.keywordId, r);
    } else if (
      previousDate &&
      r.date === previousDate &&
      !previousRankingsMap.has(r.keywordId)
    ) {
      previousRankingsMap.set(r.keywordId, r);
    }
  }

  // Calculate Visibility Index
  let totalPotentialTraffic = 0;
  let estimatedOrganicTraffic = 0;
  let top3Count = 0;
  let top10Count = 0;
  let top20Count = 0;
  const moversList: {
    keyword: string;
    latestPos: number;
    prevPos: number;
    delta: number;
    volume: number;
  }[] = [];

  const rows = projectKeywords.map((kw) => {
    const current = latestRankingsMap.get(kw.id);
    const prev = previousRankingsMap.get(kw.id);
    const pos = current?.position ?? null;
    const prevPos = prev?.position ?? null;

    let delta: number | null = null;
    if (pos != null && prevPos != null) {
      delta = prevPos - pos; // positive means rank improved
    }

    const vol = kw.searchVolume ?? 0;
    totalPotentialTraffic += vol;
    estimatedOrganicTraffic += vol * getCtrByPosition(pos);

    if (pos != null) {
      if (pos <= 3) top3Count++;
      if (pos <= 10) top10Count++;
      if (pos <= 20) top20Count++;
    }

    if (delta !== null && delta !== 0 && pos !== null && prevPos !== null) {
      moversList.push({
        keyword: kw.keyword,
        latestPos: pos,
        prevPos,
        delta,
        volume: vol,
      });
    }

    return {
      keyword: kw,
      latestPosition: pos,
      previousPosition: prevPos,
      delta,
      url: current?.url ?? kw.targetUrl,
      date: current?.date ?? latestDate,
      device: current?.device ?? null,
      country: current?.country ?? null,
    };
  });

  const visibilityScore =
    totalPotentialTraffic > 0
      ? Math.min(
          100,
          Math.round((estimatedOrganicTraffic / totalPotentialTraffic) * 100 * 3.5),
        )
      : 0;

  // Movers: top gainers and decliners
  moversList.sort((a, b) => b.delta - a.delta);
  const topGainers = moversList.filter((m) => m.delta > 0).slice(0, 5);
  const topDecliners = [...moversList]
    .filter((m) => m.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5);

  let filteredRows = rows;
  if (q) {
    const term = q.toLowerCase();
    filteredRows = filteredRows.filter(
      (r) =>
        r.keyword.keyword.toLowerCase().includes(term) ||
        (r.url && r.url.toLowerCase().includes(term)),
    );
  }

  // Check if a single keyword is being focused
  const focusedKeyword = q
    ? projectKeywords.find((k) => k.keyword.toLowerCase() === q.toLowerCase())
    : null;
  const singleKeywordHistory = focusedKeyword
    ? allRankings
        .filter((r) => r.keywordId === focusedKeyword.id && r.position != null)
        .map((r) => ({
          date: r.date,
          formattedDate: new Date(r.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          position: r.position!,
        }))
        .reverse()
    : [];

  // Build 30-day monthly history for each keyword
  const keywordsWithHistory = projectKeywords.map((kw) => {
    const kwRankings = allRankings
      .filter((r) => r.keywordId === kw.id && r.position != null)
      .sort((a, b) => a.date.localeCompare(b.date));

    const current = latestRankingsMap.get(kw.id);

    return {
      id: kw.id,
      keyword: kw.keyword,
      latestPosition: current?.position ?? null,
      history: kwRankings.map((r) => ({
        date: r.date,
        formattedDate: new Date(r.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        position: r.position as number,
      })),
    };
  });

  return (
    <div className="space-y-5">
      {/* Daily 6:00 PM IST Schedule & Live Check Banner */}
      <DailyTrackingBanner
        projectId={projectId}
        projectName={project.name}
        lastChecked={latestDate ? formatDate(latestDate) : null}
        totalKeywords={projectKeywords.length}
      />

      {/* Top metric scorecards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Visibility Index"
          value={`${visibilityScore}%`}
          tone={visibilityScore >= 50 ? "success" : "accent"}
          hint="Calculated organic search presence"
        />
        <Stat
          label="Top 3 Positions"
          value={formatNumber(top3Count)}
          tone="success"
          hint="Highest converting SERP tier"
        />
        <Stat
          label="Top 10 Positions"
          value={formatNumber(top10Count)}
          tone="accent"
          hint="First page of Google"
        />
        <Stat
          label="Top 20 Positions"
          value={formatNumber(top20Count)}
          tone="warning"
        />
        <Stat
          label="Est. Organic Clicks"
          value={formatNumber(Math.round(estimatedOrganicTraffic))}
          hint="Monthly traffic index"
        />
      </div>

      {/* Monthly Keyword Ranking Graphs (per keyword) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Monthly Keyword Ranking Trajectory</CardTitle>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Daily rank movement across Google&apos;s Top 10 Pages (Positions 1–100)
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <KeywordMonthlyRankViewer
            keywords={keywordsWithHistory}
            initialKeywordId={focusedKeyword?.id}
          />
        </CardContent>
      </Card>

      {/* Focused single keyword chart if searching specific keyword */}
      {focusedKeyword && singleKeywordHistory.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Rank trajectory: “{focusedKeyword.keyword}”</CardTitle>
          </CardHeader>
          <CardContent>
            <SingleKeywordRankChart
              data={singleKeywordHistory}
              keywordName={focusedKeyword.keyword}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Position Distribution Chart */}
      {chartData.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Position distribution history</CardTitle>
            <span className="text-[13px] text-muted-foreground">
              {dates.length} ranking snapshots tracked
            </span>
          </CardHeader>
          <CardContent>
            <PositionDistributionChart data={chartData} />
          </CardContent>
        </Card>
      ) : null}

      {/* Top Movers (Gainers & Decliners) */}
      {moversList.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success">
                <ArrowUpRight className="size-4" />
                Top Gainers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {topGainers.length === 0 ? (
                <p className="p-4 text-[13px] text-muted-foreground">
                  No rank improvements between recent snapshots.
                </p>
              ) : (
                <Table>
                  <Tbody>
                    {topGainers.map((m) => (
                      <Tr key={m.keyword}>
                        <Td className="font-medium">
                          <Link
                            href={`/${slug}/rankings?q=${encodeURIComponent(
                              m.keyword,
                            )}`}
                            className="hover:text-accent"
                          >
                            {m.keyword}
                          </Link>
                        </Td>
                        <Td className="text-right tabular-nums text-[13px] text-muted-foreground">
                          Pos {m.prevPos} → {m.latestPos}
                        </Td>
                        <Td className="w-20 text-right font-semibold text-success tabular-nums">
                          +{m.delta}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-critical">
                <ArrowDownRight className="size-4" />
                Top Drops
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {topDecliners.length === 0 ? (
                <p className="p-4 text-[13px] text-muted-foreground">
                  No ranking drops between recent snapshots.
                </p>
              ) : (
                <Table>
                  <Tbody>
                    {topDecliners.map((m) => (
                      <Tr key={m.keyword}>
                        <Td className="font-medium">
                          <Link
                            href={`/${slug}/rankings?q=${encodeURIComponent(
                              m.keyword,
                            )}`}
                            className="hover:text-accent"
                          >
                            {m.keyword}
                          </Link>
                        </Td>
                        <Td className="text-right tabular-nums text-[13px] text-muted-foreground">
                          Pos {m.prevPos} → {m.latestPos}
                        </Td>
                        <Td className="w-20 text-right font-semibold text-critical tabular-nums">
                          {m.delta}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Rankings Explorer Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form className="flex items-center gap-2" method="get">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search ranking keywords or URLs…"
              className="w-72 text-[13px]"
            />
            <Button type="submit" variant="secondary" size="sm">
              Filter
            </Button>
            {q ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${slug}/rankings`}>Reset</Link>
              </Button>
            ) : null}
          </form>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/imports">Import New Rankings</Link>
            </Button>
            <KeywordDialog
              projectId={projectId}
              trigger={
                <Button variant="primary" size="sm">
                  <Plus className="size-3.5" />
                  Add Keywords
                </Button>
              }
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <TableWrap className="rounded-none border-0">
              <Table>
                <Thead>
                  <tr>
                    <Th>Keyword</Th>
                    <Th className="text-center">Device</Th>
                    <Th className="text-center">Location</Th>
                    <Th className="text-right">Rank Position</Th>
                    <Th className="text-center">Google Page (1–10)</Th>
                    <Th className="text-right">Change</Th>
                    <Th className="text-right">Volume</Th>
                    <Th>Ranking URL</Th>
                    <Th className="text-right">Date</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {filteredRows.map((r) => (
                    <Tr key={r.keyword.id}>
                      <Td className="font-medium">
                        <Link
                          href={`/${slug}/rankings?q=${encodeURIComponent(
                            r.keyword.keyword,
                          )}`}
                          className="hover:text-accent"
                        >
                          {r.keyword.keyword}
                        </Link>
                      </Td>
                      {/* Device badge */}
                      <Td className="text-center">
                        {r.device ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium capitalize">
                            {r.device === "mobile" ? (
                              <Smartphone className="size-3 text-blue-500" />
                            ) : (
                              <Laptop className="size-3 text-purple-500" />
                            )}
                            {r.device}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </Td>
                      {/* Country flag */}
                      <Td className="text-center">
                        {r.country ? (
                          <span className="inline-flex items-center gap-1">
                            <img
                              src={getCountryFlagUrl(r.country)}
                              alt={r.country}
                              className="h-3 w-4.5 rounded-[2px] border border-border/50 object-cover"
                              loading="lazy"
                            />
                            <span className="text-[10px] font-medium text-muted-foreground">{r.country}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums font-bold text-[15px]">
                        {r.latestPosition != null ? (
                          <span
                            className={
                              r.latestPosition <= 3
                                ? "text-success"
                                : r.latestPosition <= 10
                                ? "text-accent"
                                : ""
                            }
                          >
                            #{r.latestPosition}
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-normal">
                            &gt;100
                          </span>
                        )}
                      </Td>
                      <Td className="text-center">
                        {getGooglePageBadge(r.latestPosition)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {r.delta != null ? (
                          r.delta > 0 ? (
                            <span className="inline-flex items-center text-success font-semibold text-[13px]">
                              <ArrowUpRight className="size-3.5" />+{r.delta}
                            </span>
                          ) : r.delta < 0 ? (
                            <span className="inline-flex items-center text-critical font-semibold text-[13px]">
                              <ArrowDownRight className="size-3.5" />
                              {r.delta}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[13px]">
                              —
                            </span>
                          )
                        ) : (
                          <Badge tone="outline">New</Badge>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums text-muted-foreground">
                        {r.keyword.searchVolume != null
                          ? formatNumber(r.keyword.searchVolume)
                          : "—"}
                      </Td>
                      <Td className="truncate max-w-xs text-[13px] text-muted-foreground">
                        {r.url ? (
                          <span className="truncate block" title={r.url}>
                            {r.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-right text-[12px] text-subtle-foreground font-mono">
                        {r.date}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
