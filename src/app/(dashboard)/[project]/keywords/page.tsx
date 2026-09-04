import { sql } from "drizzle-orm";
import { ArrowDown, ArrowUp, Import, Minus, Plus, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { db } from "@/db";
import {
  distributionByDate,
  intentBreakdown,
  RANK_BUCKETS,
  summarizeKeywords,
  type RankBucketId,
} from "@/lib/keyword-stats";
import { getKeywordRows } from "@/lib/queries";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";
import { formatDate, formatNumber, hostnameOf } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Ordinal ramp: one hue, darkest for the best positions. Validated for contrast
 * against both surfaces, with the dark-mode steps chosen for the dark surface
 * rather than flipped from the light ones.
 */
const BUCKET_STYLE: Record<RankBucketId, string> = {
  top3: "bg-[#104281] dark:bg-[#1c5cab]",
  "4-10": "bg-[#1c5cab] dark:bg-[#2a78d6]",
  "11-20": "bg-[#2a78d6] dark:bg-[#5598e7]",
  "21-50": "bg-[#5598e7] dark:bg-[#86b6ef]",
  "51-100": "bg-[#86b6ef] dark:bg-[#b7d3f6]",
};

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <span className="text-[11px] font-semibold text-muted-foreground">
        {label}
      </span>
      <div className="mt-1 text-[26px] leading-none font-extrabold tabular-nums text-foreground">
        {value}
      </div>
      {hint ? (
        <p className="mt-1.5 text-[11px] text-subtle-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Movement is reported only when there are two checks to compare. */
function Movement({
  position,
  previous,
}: {
  position: number | null;
  previous: number | null;
}) {
  if (previous === null) {
    return <span className="text-subtle-foreground">—</span>;
  }

  if (position === null) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-critical">
        <ArrowDown className="size-3" /> lost
      </span>
    );
  }

  const delta = previous - position;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="size-3" /> 0
      </span>
    );
  }

  return delta > 0 ? (
    <span className="inline-flex items-center gap-1 font-medium text-success">
      <ArrowUp className="size-3" /> {delta}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 font-medium text-critical">
      <ArrowDown className="size-3" /> {Math.abs(delta)}
    </span>
  );
}

export default async function ProjectKeywordsPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: slugOrId } = await params;
  const project = await findProjectBySlugOrId(slugOrId);
  if (!project) notFound();

  const domain = hostnameOf(project.domain) || project.domain;
  const slug = toProjectSlug(project.name);

  // Shared with the position-tracking directory so both agree on what
  // "latest", "improved" and "declined" mean.
  const rows = await getKeywordRows(project.id);

  const history = await db.all<{ date: string; position: number | null }>(sql`
    select r.date as date, r.position as position
    from keyword_rankings r
    join keywords k on k.id = r.keyword_id
    where k.project_id = ${project.id}
    order by r.date asc
  `);

  const summary = summarizeKeywords(rows);
  const distribution = distributionByDate(history);
  const intents = intentBreakdown(rows);
  const latestCheck = rows.find((row) => row.date)?.date ?? null;

  return (
    <div className="space-y-6 pb-24 pt-1 animate-in">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Link href="/projects" className="hover:text-foreground">
              Projects
            </Link>
            <span>&gt;</span>
            <Link href={`/${slug}`} className="hover:text-foreground">
              {project.name}
            </Link>
            <span>&gt;</span>
            <span className="font-semibold text-foreground">Keywords</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Keywords: {domain}
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {latestCheck
              ? `Positions last checked ${formatDate(latestCheck)}`
              : "No rank check has run for these keywords yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/imports">
              <Import className="size-3.5" />
              Import CSV
            </Link>
          </Button>
          <Button variant="primary" size="sm" asChild>
            <Link href={`/projects/${project.id}/keywords`}>
              <Plus className="size-3.5" />
              Manage keywords
            </Link>
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty
          icon={Search}
          title="No keywords for this project yet"
          description="Keyword data is not something a crawler can discover — it comes from your own list. Import a CSV export, or add keywords by hand, then run a rank check to fill in positions."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" asChild>
                <Link href={`/projects/${project.id}/keywords`}>Add keywords</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/imports">Import from CSV</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* Real metrics only — every one is derived from the rows above. */}
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Keywords" value={formatNumber(summary.total)} />
            <Metric
              label="Ranking"
              value={formatNumber(summary.ranking)}
              hint={
                summary.unchecked > 0
                  ? `${formatNumber(summary.unchecked)} never checked`
                  : `${formatNumber(summary.notRanking)} outside top 100`
              }
            />
            <Metric label="Top 3" value={formatNumber(summary.top3)} />
            <Metric label="Top 10" value={formatNumber(summary.top10)} />
            <Metric
              label="Avg. position"
              value={
                summary.averagePosition === null
                  ? "—"
                  : String(summary.averagePosition)
              }
              hint={summary.averagePosition === null ? "Nothing ranking" : "Ranking keywords only"}
            />
            <Metric
              label="Search volume"
              value={
                summary.totalVolume === null
                  ? "—"
                  : formatNumber(summary.totalVolume)
              }
              hint={summary.totalVolume === null ? "Not imported" : "Monthly, combined"}
            />
          </div>

          {distribution.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Position distribution</CardTitle>
                <span className="text-[12px] text-muted-foreground">
                  {distribution.length === 1
                    ? "One check so far"
                    : `${distribution.length} checks`}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {RANK_BUCKETS.map((bucket) => (
                    <span
                      key={bucket.id}
                      className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
                    >
                      <span
                        className={`inline-block size-2.5 rounded-[2px] ${BUCKET_STYLE[bucket.id]}`}
                      />
                      {bucket.label}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-block size-2.5 rounded-[2px] bg-notice-subtle" />
                    Not ranking
                  </span>
                </div>

                {distribution.map((point) => (
                  <div key={point.date} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[12px] tabular-nums text-muted-foreground">
                      {formatDate(point.date)}
                    </span>
                    <div className="flex h-5 flex-1 overflow-hidden rounded-[4px] bg-notice-subtle">
                      {RANK_BUCKETS.map((bucket) => {
                        const count = point.counts[bucket.id];
                        if (count === 0) return null;
                        return (
                          <div
                            key={bucket.id}
                            className={BUCKET_STYLE[bucket.id]}
                            style={{ width: `${(count / point.total) * 100}%` }}
                            title={`${bucket.label}: ${count}`}
                          />
                        );
                      })}
                    </div>
                    <span className="w-20 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
                      {point.total - point.notRanking}/{point.total}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>All keywords</CardTitle>
                <Badge tone="outline">{formatNumber(rows.length)}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead className="border-b border-border text-[11px] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium">Keyword</th>
                        <th className="px-2 py-2.5 text-center font-medium">Position</th>
                        <th className="px-2 py-2.5 text-center font-medium">Change</th>
                        <th className="px-2 py-2.5 text-center font-medium">Volume</th>
                        <th className="px-2 py-2.5 text-center font-medium">KD</th>
                        <th className="px-4 py-2.5 text-left font-medium">Ranking URL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row) => (
                        <tr key={row.id} className="hover:bg-surface-muted/40">
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-foreground">
                              {row.keyword}
                            </span>
                            {row.intent ? (
                              <span className="ml-2 text-[11px] text-subtle-foreground">
                                {row.intent}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2.5 text-center font-bold tabular-nums">
                            {row.date === null ? (
                              <span
                                className="text-subtle-foreground"
                                title="No rank check has run for this keyword"
                              >
                                —
                              </span>
                            ) : row.position === null ? (
                              <span
                                className="text-muted-foreground"
                                title="Checked, but not in the top 100"
                              >
                                &gt;100
                              </span>
                            ) : (
                              row.position
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-center text-[12px]">
                            <Movement
                              position={row.position}
                              previous={row.previousPosition}
                            />
                          </td>
                          <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">
                            {row.searchVolume === null
                              ? "—"
                              : formatNumber(row.searchVolume)}
                          </td>
                          <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">
                            {row.difficulty === null ? "—" : Math.round(row.difficulty)}
                          </td>
                          <td className="max-w-70 px-4 py-2.5">
                            {row.url ? (
                              <a
                                href={row.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block truncate text-accent hover:underline"
                                title={row.url}
                              >
                                {row.url}
                              </a>
                            ) : (
                              <span className="text-subtle-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle>By intent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {intents.map((entry) => (
                  <div
                    key={entry.intent}
                    className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-[13px] text-foreground">{entry.intent}</span>
                    <span className="text-[12px] tabular-nums text-muted-foreground">
                      {entry.count} · {entry.share}%
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <p className="px-1 text-[11px] leading-relaxed text-subtle-foreground">
            Volume, difficulty and intent come from what you imported; positions come
            from rank checks against a search provider. Blank cells mean the value was
            never supplied — they are not zeroes.
          </p>
        </>
      )}
    </div>
  );
}
