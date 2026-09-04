import { and, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Tbody, Td, Tr } from "@/components/ui/table";
import { db } from "@/db";
import { crawlPages, pageIssues, pageLinks } from "@/db/schema";
import { ISSUE_BY_CODE, SEVERITY_ORDER } from "@/lib/crawler/issue-catalog";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";
import { formatBytes, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const severityTone = {
  critical: "critical",
  warning: "warning",
  notice: "notice",
} as const;

export default async function ProjectPageDetail({
  params,
}: {
  params: Promise<{ project: string; pageId: string }>;
}) {
  const { project: slugOrId, pageId } = await params;
  const project = await findProjectBySlugOrId(slugOrId);
  if (!project) notFound();

  const slug = toProjectSlug(project.name);

  const page = await db.query.crawlPages.findFirst({
    where: eq(crawlPages.id, Number(pageId)),
  });
  if (!page) notFound();

  const [issues, outlinks, inlinks] = await Promise.all([
    db
      .select()
      .from(pageIssues)
      .where(eq(pageIssues.pageId, page.id)),
    db
      .select({
        toUrl: pageLinks.toUrl,
        anchorText: pageLinks.anchorText,
        isInternal: pageLinks.isInternal,
        rel: pageLinks.rel,
      })
      .from(pageLinks)
      .where(eq(pageLinks.fromPageId, page.id))
      .limit(200),
    db
      .select({
        fromUrl: crawlPages.url,
        fromId: crawlPages.id,
        anchorText: pageLinks.anchorText,
      })
      .from(pageLinks)
      .innerJoin(crawlPages, eq(pageLinks.fromPageId, crawlPages.id))
      .where(
        and(eq(pageLinks.toPageId, page.id), eq(pageLinks.crawlId, page.crawlId)),
      )
      .limit(200),
  ]);

  const sortedIssues = issues
    .map((issue) => ({ ...issue, definition: ISSUE_BY_CODE.get(issue.code) }))
    .filter((issue) => issue.definition)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.definition!.severity] -
        SEVERITY_ORDER[b.definition!.severity],
    );

  const facts: [string, string][] = [
    ["Status", page.statusCode === null ? "Fetch failed" : String(page.statusCode)],
    ["Depth", String(page.depth)],
    ["Content type", page.contentType ?? "—"],
    ["Response time", page.responseTimeMs ? `${page.responseTimeMs}ms` : "—"],
    ["Size", formatBytes(page.sizeBytes)],
    ["Word count", formatNumber(page.wordCount)],
    ["Inlinks", formatNumber(page.inlinkCount)],
    ["Internal links out", formatNumber(page.internalLinks)],
    ["External links out", formatNumber(page.externalLinks)],
    ["Images", `${page.imagesMissingAlt} of ${page.imageCount} missing alt`],
    ["Language", page.lang ?? "—"],
    ["hreflang", String(page.hreflangCount)],
    ["Redirects", String(page.redirectChain)],
    ["CDN", page.cdnProvider ?? "None detected"],
    ["Cache-Control", page.cacheControl ?? "Not set"],
    [
      "Structured data",
      page.structuredDataTypes?.length
        ? page.structuredDataTypes.join(", ")
        : "None",
    ],
  ];

  const meta: [string, string | null][] = [
    ["Title", page.title],
    ["Meta description", page.metaDescription],
    ["H1", page.h1?.join(" · ") ?? null],
    ["Canonical", page.canonical],
    ["Meta robots", page.metaRobots],
    ["og:title", page.ogTitle],
    ["og:description", page.ogDescription],
    ["og:image", page.ogImage],
    ["twitter:card", page.twitterCard],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${slug}/pages`}>
            <ArrowLeft className="size-4 mr-1" />
            All pages
          </Link>
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <a href={page.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4 mr-1" />
            Open page
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle className="break-all">{page.path || "/"}</CardTitle>
            <p className="mt-1 break-all text-[13px] text-muted-foreground">
              {page.url}
            </p>
          </div>
          {page.fetchError ? (
            <Badge tone="critical">{page.fetchError}</Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[12px] text-subtle-foreground">{label}</dt>
                <dd className="text-[14px] break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Issues</CardTitle>
            <Badge tone={sortedIssues.length ? "warning" : "success"}>
              {sortedIssues.length}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {sortedIssues.length === 0 ? (
              <p className="px-5 pb-5 text-[13px] text-muted-foreground">
                No issues detected on this page.
              </p>
            ) : (
              <Table>
                <Tbody>
                  {sortedIssues.map((issue) => (
                    <Tr key={issue.id}>
                      <Td>
                        <div className="flex items-start gap-2">
                          <Badge tone={severityTone[issue.definition!.severity]}>
                            {issue.definition!.severity}
                          </Badge>
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium">
                              {issue.definition!.label}
                            </p>
                            {issue.detail ? (
                              <p className="mt-0.5 break-words text-[13px] text-muted-foreground">
                                {issue.detail}
                              </p>
                            ) : null}
                          </div>
                        </div>
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
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {meta.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] text-subtle-foreground">
                    {label}
                    {value ? ` · ${value.length} chars` : ""}
                  </dt>
                  <dd className="break-words text-[14px]">
                    {value ?? (
                      <span className="text-subtle-foreground">Not set</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Linked from</CardTitle>
            <Badge tone="outline">{inlinks.length}</Badge>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {inlinks.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                Nothing in this crawl links here — an orphan page.
              </p>
            ) : (
              <ul className="space-y-2">
                {inlinks.map((link, index) => (
                  <li key={`${link.fromId}-${index}`} className="text-[13px]">
                    <Link
                      href={`/${slug}/pages/${link.fromId}`}
                      className="break-all hover:text-accent"
                    >
                      {link.fromUrl}
                    </Link>
                    {link.anchorText ? (
                      <span className="text-subtle-foreground">
                        {" "}
                        — “{link.anchorText}”
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Links out</CardTitle>
            <Badge tone="outline">{outlinks.length}</Badge>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {outlinks.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                This page links nowhere.
              </p>
            ) : (
              <ul className="space-y-2">
                {outlinks.map((link, index) => (
                  <li key={index} className="text-[13px]">
                    <span className="break-all">{link.toUrl}</span>
                    {!link.isInternal ? (
                      <Badge tone="outline" className="ml-2">
                        external
                      </Badge>
                    ) : null}
                    {link.rel?.includes("nofollow") ? (
                      <Badge tone="neutral" className="ml-1">
                        nofollow
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
