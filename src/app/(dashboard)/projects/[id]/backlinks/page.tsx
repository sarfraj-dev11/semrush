import { and, desc, eq } from "drizzle-orm";
import {
  ArrowDownToLine,
  CheckCircle2,
  ExternalLink,
  Link2,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Input, NativeSelect } from "@/components/ui/input";
import { Stat } from "@/components/ui/stat";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { db } from "@/db";
import { backlinks } from "@/db/schema";
import { getProjectWithClient } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import { deleteBacklinkAction } from "./actions";
import { FollowRatioDonut } from "./backlink-charts";
import { BacklinkDialog } from "./backlink-dialog";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "new") return "accent" as const;
  if (status === "active") return "success" as const;
  return "critical" as const;
}

export default async function BacklinksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  const record = await getProjectWithClient(projectId);
  if (!record) notFound();

  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const statusFilter = typeof query.status === "string" ? query.status : "";
  const typeFilter = typeof query.type === "string" ? query.type : "";

  const allBacklinks = await db
    .select()
    .from(backlinks)
    .where(eq(backlinks.projectId, projectId))
    .orderBy(desc(backlinks.createdAt));

  let filtered = allBacklinks;
  if (q) {
    const term = q.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.sourceUrl.toLowerCase().includes(term) ||
        b.sourceDomain.toLowerCase().includes(term) ||
        (b.anchorText && b.anchorText.toLowerCase().includes(term)) ||
        (b.targetUrl && b.targetUrl.toLowerCase().includes(term)),
    );
  }
  if (statusFilter) {
    filtered = filtered.filter((b) => b.status === statusFilter);
  }
  if (typeFilter === "follow") {
    filtered = filtered.filter((b) => b.isFollow);
  } else if (typeFilter === "nofollow") {
    filtered = filtered.filter((b) => !b.isFollow);
  }

  // Summary stats
  const totalCount = allBacklinks.length;
  const domainSet = new Set(allBacklinks.map((b) => b.sourceDomain));
  const followCount = allBacklinks.filter((b) => b.isFollow).length;
  const nofollowCount = totalCount - followCount;
  const newCount = allBacklinks.filter((b) => b.status === "new").length;
  const lostCount = allBacklinks.filter((b) => b.status === "lost").length;

  const validDrs = allBacklinks.map((b) => b.domainRating).filter((d): d is number => d != null);
  const avgDr =
    validDrs.length > 0
      ? Math.round(validDrs.reduce((a, b) => a + b, 0) / validDrs.length)
      : null;

  // Group by referring domains
  const domainMap = new Map<string, { count: number; maxDr: number | null }>();
  for (const b of allBacklinks) {
    const entry = domainMap.get(b.sourceDomain) ?? { count: 0, maxDr: null };
    entry.count++;
    if (b.domainRating != null) {
      entry.maxDr = Math.max(entry.maxDr ?? 0, b.domainRating);
    }
    domainMap.set(b.sourceDomain, entry);
  }
  const topDomains = [...domainMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  // Group by anchor text
  const anchorMap = new Map<string, number>();
  for (const b of allBacklinks) {
    const text = b.anchorText?.trim() || "(empty anchor)";
    anchorMap.set(text, (anchorMap.get(text) ?? 0) + 1);
  }
  const topAnchors = [...anchorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="space-y-5">
      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Total Backlinks"
          value={formatNumber(totalCount)}
        />
        <Stat
          label="Referring Domains"
          value={formatNumber(domainSet.size)}
          hint="Unique root domains"
        />
        <Stat
          label="Average DR"
          value={avgDr != null ? String(avgDr) : "—"}
          tone={avgDr && avgDr >= 60 ? "success" : "neutral"}
          hint="Authority index"
        />
        <Stat
          label="Follow Ratio"
          value={
            totalCount > 0
              ? `${Math.round((followCount / totalCount) * 100)}%`
              : "—"
          }
          tone="accent"
          hint={`${followCount} follow / ${nofollowCount} nofollow`}
        />
        <Stat
          label="New / Lost Links"
          value={`+${newCount} / -${lostCount}`}
          tone={newCount >= lostCount ? "success" : "warning"}
        />
      </div>

      {/* Breakdowns: Referring Domains & Anchors */}
      {allBacklinks.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Top Referring Domains</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <Thead>
                  <tr>
                    <Th>Domain</Th>
                    <Th className="text-right">DR</Th>
                    <Th className="text-right">Backlinks</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {topDomains.map(([domain, data]) => (
                    <Tr key={domain}>
                      <Td className="font-medium truncate max-w-xs">{domain}</Td>
                      <Td className="text-right tabular-nums text-muted-foreground">
                        {data.maxDr != null ? (
                          <Badge tone={data.maxDr >= 50 ? "success" : "neutral"}>
                            DR {data.maxDr}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-right tabular-nums font-semibold">
                        {formatNumber(data.count)}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Link Attributes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FollowRatioDonut
                followCount={followCount}
                nofollowCount={nofollowCount}
              />
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="text-[13px] font-semibold text-foreground">
                  Top Anchors
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {topAnchors.map(([anchor, count]) => (
                    <div
                      key={anchor}
                      className="flex items-center justify-between text-[12px]"
                    >
                      <span className="truncate text-muted-foreground mr-2">
                        “{anchor}”
                      </span>
                      <span className="tabular-nums font-medium text-foreground">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Explorer & Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form className="flex flex-wrap items-center gap-2" method="get">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search domain, URL, or anchor…"
              className="w-64 text-[13px]"
            />
            <NativeSelect
              name="status"
              defaultValue={statusFilter}
              className="w-32 text-[13px]"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="new">New</option>
              <option value="lost">Lost</option>
            </NativeSelect>
            <NativeSelect
              name="type"
              defaultValue={typeFilter}
              className="w-32 text-[13px]"
            >
              <option value="">All types</option>
              <option value="follow">Follow only</option>
              <option value="nofollow">Nofollow only</option>
            </NativeSelect>
            <Button type="submit" variant="secondary" size="sm">
              Filter
            </Button>
            {q || statusFilter || typeFilter ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${projectId}/backlinks`}>Reset</Link>
              </Button>
            ) : null}
          </form>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/imports">
                <ArrowDownToLine className="size-4" />
                Import Backlinks CSV
              </Link>
            </Button>
            <BacklinkDialog projectId={projectId} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <Empty
            icon={Link2}
            title={
              allBacklinks.length === 0
                ? "No backlinks tracked yet"
                : "No backlinks match your filters"
            }
            description={
              allBacklinks.length === 0
                ? "Import an Ahrefs or Semrush backlinks export CSV or add inbound links manually."
                : "Try widening search or resetting filters."
            }
            action={
              allBacklinks.length === 0 ? (
                <div className="flex gap-2">
                  <BacklinkDialog projectId={projectId} />
                  <Button variant="secondary" asChild>
                    <Link href="/imports">Import CSV</Link>
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
                      <Th>Source URL & Domain</Th>
                      <Th>Anchor Text</Th>
                      <Th>Target Page</Th>
                      <Th className="text-right">DR</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {filtered.map((link) => (
                      <Tr key={link.id}>
                        <Td className="max-w-xs">
                          <div className="truncate font-medium text-foreground">
                            {link.sourceDomain}
                          </div>
                          <a
                            href={link.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate block text-[12px] text-muted-foreground hover:text-accent"
                          >
                            {link.sourceUrl}
                          </a>
                        </Td>
                        <Td className="truncate max-w-xs text-[13px] text-foreground">
                          {link.anchorText ? `“${link.anchorText}”` : "—"}
                        </Td>
                        <Td className="truncate max-w-xs text-[12px] text-muted-foreground">
                          {link.targetUrl ? (
                            link.targetUrl.replace(/^https?:\/\/[^/]+/, "") || "/"
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td className="text-right tabular-nums">
                          {link.domainRating != null ? link.domainRating : "—"}
                        </Td>
                        <Td>
                          <Badge tone={link.isFollow ? "accent" : "neutral"}>
                            {link.isFollow ? "Follow" : "Nofollow"}
                          </Badge>
                        </Td>
                        <Td>
                          <Badge tone={statusTone(link.status)}>
                            {link.status}
                          </Badge>
                        </Td>
                        <Td className="text-right">
                          <ConfirmDelete
                            action={deleteBacklinkAction}
                            id={link.id}
                            title="Delete this backlink?"
                            description="This record will be permanently removed from this project."
                            confirmLabel="Delete"
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete backlink"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            }
                          />
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
    </div>
  );
}
