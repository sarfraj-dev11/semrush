import { eq } from "drizzle-orm";
import {
  Building2,
  ExternalLink,
  Flame,
  ShieldCheck,
  Swords,
  Trash2,
  Users2,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { db } from "@/db";
import { backlinks, competitors, keywords } from "@/db/schema";
import { getLatestCompletedCrawl, getProjectWithClient } from "@/lib/queries";
import { formatNumber, hostnameOf } from "@/lib/utils";
import { syncCompetitorsFromFirebase } from "@/lib/firebase-tracking";
import { deleteCompetitorAction } from "./actions";
import { CompetitorDialog } from "./competitor-dialog";

export const dynamic = "force-dynamic";

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  const record = await getProjectWithClient(projectId);
  if (!record) notFound();

  // Sync competitors from Firebase
  await syncCompetitorsFromFirebase(projectId).catch((err) => {
    console.error("⚠️ [CompetitorsPage] Failed to sync competitors from Firebase:", err);
  });

  const { project } = record;
  const [crawl, projectKeywords, projectBacklinks, competitorList] =
    await Promise.all([
      getLatestCompletedCrawl(projectId),
      db.select().from(keywords).where(eq(keywords.projectId, projectId)),
      db.select().from(backlinks).where(eq(backlinks.projectId, projectId)),
      db
        .select()
        .from(competitors)
        .where(eq(competitors.projectId, projectId)),
    ]);

  const projectHost = hostnameOf(project.domain);
  const projectHealthScore =
    crawl?.healthScore != null ? Math.round(crawl.healthScore) : null;
  const projectPageCount = crawl?.pagesCrawled ?? 0;
  const projectKwCount = projectKeywords.length;
  const projectBlCount = projectBacklinks.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          Benchmark {project.name} ({projectHost}) against your organic and industry competitors.
        </p>
        <CompetitorDialog projectId={projectId} />
      </div>

      {/* Comparison Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="size-4 text-accent" />
            Competitive Benchmark Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TableWrap className="rounded-none border-0">
            <Table>
              <Thead>
                <tr>
                  <Th>Domain / Brand</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Health Score</Th>
                  <Th className="text-right">Crawled Pages</Th>
                  <Th className="text-right">Tracked Keywords</Th>
                  <Th className="text-right">Backlinks</Th>
                </tr>
              </Thead>
              <Tbody>
                {/* Project Row (Highlighted) */}
                <Tr className="bg-accent-subtle/30 font-medium">
                  <Td>
                    <div className="flex items-center gap-2">
                      <Badge tone="accent">Your Site</Badge>
                      <span className="font-semibold text-foreground">
                        {project.name}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        ({projectHost})
                      </span>
                    </div>
                  </Td>
                  <Td>Primary Target</Td>
                  <Td className="text-right tabular-nums">
                    {projectHealthScore != null ? (
                      <Badge
                        tone={
                          projectHealthScore >= 80
                            ? "success"
                            : projectHealthScore >= 50
                            ? "warning"
                            : "critical"
                        }
                      >
                        {projectHealthScore}/100
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {formatNumber(projectPageCount)}
                  </Td>
                  <Td className="text-right tabular-nums font-semibold">
                    {formatNumber(projectKwCount)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {formatNumber(projectBlCount)}
                  </Td>
                </Tr>

                {/* Competitor Rows */}
                {competitorList.map((comp) => (
                  <Tr key={comp.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {comp.name || comp.domain}
                        </span>
                        <a
                          href={`https://${comp.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-muted-foreground hover:text-accent inline-flex items-center gap-1"
                        >
                          {comp.domain}
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone="outline">Competitor</Badge>
                    </Td>
                    <Td className="text-right text-muted-foreground">—</Td>
                    <Td className="text-right text-muted-foreground">—</Td>
                    <Td className="text-right text-muted-foreground">—</Td>
                    <Td className="text-right text-muted-foreground">—</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>

      {/* Competitors Management List */}
      {competitorList.length === 0 ? (
        <Empty
          icon={Users2}
          title="No competitors added yet"
          description="Add competitor websites to compare SEO positioning, keyword overlap, and link profiles."
          action={<CompetitorDialog projectId={projectId} />}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tracked Competitors</CardTitle>
            <Badge tone="neutral">{competitorList.length} domains</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <tr>
                  <Th>Brand Name</Th>
                  <Th>Domain</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {competitorList.map((comp) => (
                  <Tr key={comp.id}>
                    <Td className="font-medium">{comp.name || "—"}</Td>
                    <Td className="font-mono text-[13px] text-muted-foreground">
                      {comp.domain}
                    </Td>
                    <Td className="text-right">
                      <ConfirmDelete
                        action={deleteCompetitorAction}
                        id={comp.id}
                        title={`Remove competitor "${comp.name || comp.domain}"?`}
                        description="This competitor will be removed from this project's benchmark."
                        confirmLabel="Remove"
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete competitor"
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
