import { and, desc, eq, gt, sql } from "drizzle-orm";
import { Link2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Stat } from "@/components/ui/stat";
import { Table, Tbody, Td, Tr } from "@/components/ui/table";
import { db } from "@/db";
import { crawlPages, pageLinks } from "@/db/schema";
import { getLatestCompletedCrawl } from "@/lib/queries";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";
import { formatNumber, hostnameOf } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectLinksTab({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: slugOrId } = await params;
  const project = await findProjectBySlugOrId(slugOrId);
  if (!project) notFound();

  const projectId = project.id;
  const slug = toProjectSlug(project.name);

  const crawl = await getLatestCompletedCrawl(projectId);
  if (!crawl) {
    return (
      <Empty
        icon={Link2}
        title="No crawl data yet"
        description="The internal link graph is built from a crawl. Run one from the Audit tab."
        action={
          <Button variant="primary" asChild>
            <Link href={`/${slug}/audit`}>Go to Audit</Link>
          </Button>
        }
      />
    );
  }

  const [depths, orphans, mostLinked, externalDomains, totals] =
    await Promise.all([
      db
        .select({
          depth: crawlPages.depth,
          count: sql<number>`count(*)`,
        })
        .from(crawlPages)
        .where(eq(crawlPages.crawlId, crawl.id))
        .groupBy(crawlPages.depth)
        .orderBy(crawlPages.depth),
      db
        .select({
          id: crawlPages.id,
          url: crawlPages.url,
          path: crawlPages.path,
          statusCode: crawlPages.statusCode,
        })
        .from(crawlPages)
        .where(
          and(
            eq(crawlPages.crawlId, crawl.id),
            eq(crawlPages.inlinkCount, 0),
            gt(crawlPages.depth, 0),
          ),
        )
        .limit(100),
      db
        .select({
          id: crawlPages.id,
          path: crawlPages.path,
          inlinkCount: crawlPages.inlinkCount,
        })
        .from(crawlPages)
        .where(eq(crawlPages.crawlId, crawl.id))
        .orderBy(desc(crawlPages.inlinkCount))
        .limit(10),
      db
        .select({
          toUrl: pageLinks.toUrl,
          count: sql<number>`count(*)`,
        })
        .from(pageLinks)
        .where(
          and(eq(pageLinks.crawlId, crawl.id), eq(pageLinks.isInternal, false)),
        )
        .groupBy(pageLinks.toUrl),
      db
        .select({
          internal: sql<number>`sum(case when ${pageLinks.isInternal} then 1 else 0 end)`,
          external: sql<number>`sum(case when ${pageLinks.isInternal} then 0 else 1 end)`,
        })
        .from(pageLinks)
        .where(eq(pageLinks.crawlId, crawl.id)),
    ]);

  // Group external links by host
  const byDomain = new Map<string, number>();
  for (const row of externalDomains) {
    const host = hostnameOf(row.toUrl);
    byDomain.set(host, (byDomain.get(host) ?? 0) + row.count);
  }
  const topDomains = [...byDomain.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const maxDepthCount = Math.max(...depths.map((d) => d.count), 1);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Internal links"
          value={formatNumber(totals[0]?.internal ?? 0)}
        />
        <Stat
          label="External links"
          value={formatNumber(totals[0]?.external ?? 0)}
        />
        <Stat
          label="Referenced domains"
          value={formatNumber(byDomain.size)}
        />
        <Stat
          label="Orphan pages"
          value={formatNumber(orphans.length)}
          tone={orphans.length > 0 ? "warning" : "success"}
          hint="Reachable in the sitemap but not linked"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Crawl depth</CardTitle>
            <span className="text-[13px] text-muted-foreground">
              Clicks from the start URL
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            {depths.map((row) => (
              <div key={row.depth} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-[13px] text-muted-foreground">
                  {row.depth === 0 ? "Start" : `Depth ${row.depth}`}
                </span>
                <div className="h-6 flex-1 overflow-hidden rounded-[6px] bg-surface-muted">
                  <div
                    className="h-full rounded-[6px] bg-accent/80"
                    style={{ width: `${(row.count / maxDepthCount) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-[13px] tabular-nums">
                  {formatNumber(row.count)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most linked pages</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <Tbody>
                {mostLinked.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <Link
                        href={`/${slug}/pages/${row.id}`}
                        className="block truncate hover:text-accent"
                      >
                        {row.path || "/"}
                      </Link>
                    </Td>
                    <Td className="w-20 text-right tabular-nums text-muted-foreground">
                      {formatNumber(row.inlinkCount)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orphan pages</CardTitle>
            <Badge tone={orphans.length ? "warning" : "success"}>
              {orphans.length}
            </Badge>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto p-0">
            {orphans.length === 0 ? (
              <p className="px-5 pb-5 text-[13px] text-muted-foreground">
                Every crawled page is linked from somewhere on the site.
              </p>
            ) : (
              <Table>
                <Tbody>
                  {orphans.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <Link
                          href={`/${slug}/pages/${row.id}`}
                          className="block truncate hover:text-accent"
                          title={row.url}
                        >
                          {row.path || "/"}
                        </Link>
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
            <CardTitle>Top external domains</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topDomains.length === 0 ? (
              <p className="px-5 pb-5 text-[13px] text-muted-foreground">
                The site links to no external domains.
              </p>
            ) : (
              <Table>
                <Tbody>
                  {topDomains.map(([domain, count]) => (
                    <Tr key={domain}>
                      <Td className="truncate">{domain}</Td>
                      <Td className="w-20 text-right tabular-nums text-muted-foreground">
                        {formatNumber(count)}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
