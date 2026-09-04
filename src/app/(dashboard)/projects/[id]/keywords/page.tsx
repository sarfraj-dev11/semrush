import { and, desc, eq, like, or } from "drizzle-orm";
import { ArrowDownToLine, KeyRound, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Input, NativeSelect } from "@/components/ui/input";
import { Stat } from "@/components/ui/stat";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { db } from "@/db";
import { keywords } from "@/db/schema";
import { getProjectWithClient } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import { deleteKeywordAction } from "./actions";
import { KeywordDialog } from "./keyword-dialog";

export const dynamic = "force-dynamic";

function difficultyTone(kd: number | null) {
  if (kd === null) return "neutral" as const;
  if (kd <= 29) return "success" as const;
  if (kd <= 59) return "warning" as const;
  return "critical" as const;
}

function intentTone(intent: string | null) {
  if (!intent) return "neutral" as const;
  const lower = intent.toLowerCase();
  if (lower.includes("trans")) return "accent" as const;
  if (lower.includes("comm")) return "warning" as const;
  if (lower.includes("info")) return "neutral" as const;
  return "outline" as const;
}

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; intent?: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  const record = await getProjectWithClient(projectId);
  if (!record) notFound();

  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const intent = typeof query.intent === "string" ? query.intent : "";

  const allKeywords = await db
    .select()
    .from(keywords)
    .where(eq(keywords.projectId, projectId))
    .orderBy(desc(keywords.searchVolume));

  let filtered = allKeywords;
  if (q) {
    const term = q.toLowerCase();
    filtered = filtered.filter(
      (k) =>
        k.keyword.toLowerCase().includes(term) ||
        (k.tags && k.tags.toLowerCase().includes(term)) ||
        (k.targetUrl && k.targetUrl.toLowerCase().includes(term)),
    );
  }
  if (intent) {
    filtered = filtered.filter(
      (k) => k.intent?.toLowerCase() === intent.toLowerCase(),
    );
  }

  // Calculate statistics
  const totalVolume = allKeywords.reduce((acc, k) => acc + (k.searchVolume ?? 0), 0);
  const keywordsWithKd = allKeywords.filter((k) => k.difficulty != null);
  const avgDifficulty =
    keywordsWithKd.length > 0
      ? Math.round(
          keywordsWithKd.reduce((acc, k) => acc + (k.difficulty ?? 0), 0) /
            keywordsWithKd.length,
        )
      : null;

  const highIntentCount = allKeywords.filter(
    (k) =>
      k.intent?.toLowerCase().includes("trans") ||
      k.intent?.toLowerCase().includes("comm"),
  ).length;

  return (
    <div className="space-y-5">
      {/* Top summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Tracked Keywords"
          value={formatNumber(allKeywords.length)}
          hint="Total tracked queries"
        />
        <Stat
          label="Total Monthly Volume"
          value={formatNumber(totalVolume)}
          hint="Estimated search demand"
        />
        <Stat
          label="Avg Keyword Difficulty"
          value={avgDifficulty != null ? `${avgDifficulty}%` : "—"}
          tone={difficultyTone(avgDifficulty)}
          hint="Across all tracked queries"
        />
        <Stat
          label="Commercial Intent"
          value={formatNumber(highIntentCount)}
          hint={
            allKeywords.length > 0
              ? `${Math.round((highIntentCount / allKeywords.length) * 100)}% of tracked pool`
              : "Transactional & commercial"
          }
        />
      </div>

      {/* Action and Filter Bar */}
      {allKeywords.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form className="flex flex-wrap items-center gap-2" method="get">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search keywords or tags…"
              className="w-64 text-[13px]"
            />
            <NativeSelect
              name="intent"
              defaultValue={intent}
              className="w-40 text-[13px]"
            >
              <option value="">All intents</option>
              <option value="Informational">Informational</option>
              <option value="Navigational">Navigational</option>
              <option value="Commercial">Commercial</option>
              <option value="Transactional">Transactional</option>
            </NativeSelect>
            <Button type="submit" variant="secondary" size="sm">
              Filter
            </Button>
            {q || intent ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${projectId}/keywords`}>Reset</Link>
              </Button>
            ) : null}
          </form>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/imports">
                <ArrowDownToLine className="size-4" />
                Import CSV
              </Link>
            </Button>
            <KeywordDialog projectId={projectId} />
          </div>
        </div>
      ) : null}

      {/* Keywords Table */}
      {filtered.length === 0 ? (
        <Empty
          icon={KeyRound}
          title={
            allKeywords.length === 0
              ? "No keywords tracked yet"
              : "No keywords match your filters"
          }
          description={
            allKeywords.length === 0
              ? "Add keywords manually or import a Semrush CSV export to track volume, difficulty, and rankings."
              : "Try clearing search or selecting a different intent filter."
          }
          action={
            allKeywords.length === 0 ? (
              <div className="flex gap-2">
                <KeywordDialog projectId={projectId} />
                <Button variant="secondary" asChild>
                  <Link href="/imports">Import Semrush CSV</Link>
                </Button>
              </div>
            ) : null
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <TableWrap className="rounded-none border-0">
              <Table>
                <Thead>
                  <tr>
                    <Th>Keyword</Th>
                    <Th className="text-right">Volume</Th>
                    <Th className="text-right">KD%</Th>
                    <Th className="text-right">CPC</Th>
                    <Th>Intent</Th>
                    <Th>Target Page</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {filtered.map((kw) => (
                    <Tr key={kw.id}>
                      <Td className="font-medium">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/projects/${projectId}/rankings?q=${encodeURIComponent(
                              kw.keyword,
                            )}`}
                            className="hover:text-accent"
                          >
                            {kw.keyword}
                          </Link>
                          {kw.tags ? (
                            <span className="text-[11px] text-subtle-foreground bg-surface-muted px-1.5 py-0.5 rounded">
                              {kw.tags}
                            </span>
                          ) : null}
                        </div>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {kw.searchVolume != null
                          ? formatNumber(kw.searchVolume)
                          : "—"}
                      </Td>
                      <Td className="text-right">
                        {kw.difficulty != null ? (
                          <Badge tone={difficultyTone(kw.difficulty)}>
                            {kw.difficulty}%
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-right tabular-nums text-muted-foreground">
                        {kw.cpc != null ? `$${kw.cpc.toFixed(2)}` : "—"}
                      </Td>
                      <Td>
                        {kw.intent ? (
                          <Badge tone={intentTone(kw.intent)}>
                            {kw.intent}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="truncate max-w-xs text-[13px] text-muted-foreground">
                        {kw.targetUrl ? (
                          <a
                            href={kw.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-accent"
                          >
                            {kw.targetUrl}
                          </a>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <KeywordDialog
                            projectId={projectId}
                            keyword={kw}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Edit keyword"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            }
                          />
                          <ConfirmDelete
                            action={deleteKeywordAction}
                            id={kw.id}
                            title={`Delete keyword "${kw.keyword}"?`}
                            description="All historical rankings tied to this keyword will also be removed."
                            confirmLabel="Delete"
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete keyword"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            }
                          />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
