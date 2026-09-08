import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { crawlPages, pageIssues } from "@/db/schema";
import { ISSUE_BY_CODE } from "@/lib/crawler/issue-catalog";
import { getLatestCompletedCrawl } from "@/lib/queries";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";
import { formatDateTime } from "@/lib/utils";
import {
  WarningsVerboseClient,
  type VerboseWarningItem,
} from "./warnings-verbose-client";

export const dynamic = "force-dynamic";

export default async function AuditWarningsPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  try {
    const { project: slugOrId } = await params;
    const project = await findProjectBySlugOrId(slugOrId);
    if (!project) notFound();

    const slug = toProjectSlug(project.name);
    const crawl = await getLatestCompletedCrawl(project.id);

    let warnings: VerboseWarningItem[] = [];

    if (crawl) {
      const rawIssues = await db
        .select({
          id: pageIssues.id,
          code: pageIssues.code,
          detail: pageIssues.detail,
          pageId: pageIssues.pageId,
          url: crawlPages.url,
          path: crawlPages.path,
          title: crawlPages.title,
          statusCode: crawlPages.statusCode,
          depth: crawlPages.depth,
        })
        .from(pageIssues)
        .innerJoin(crawlPages, eq(pageIssues.pageId, crawlPages.id))
        .where(eq(pageIssues.crawlId, crawl.id));

      for (const issue of rawIssues) {
        const def = ISSUE_BY_CODE.get(issue.code);
        // Only show warnings (severity === "warning")
        if (!def || def.severity !== "warning") continue;

        warnings.push({
          id: issue.id,
          code: issue.code,
          label: def.label,
          category: def.category,
          description: def.description,
          howToFix: def.howToFix,
          detail: issue.detail,
          pageId: issue.pageId,
          url: issue.url,
          path: issue.path,
          title: issue.title,
          statusCode: issue.statusCode,
          depth: issue.depth,
        });
      }
    }

    return (
      <WarningsVerboseClient
        slug={slug}
        projectName={project.name}
        domain={project.domain}
        crawlDate={
          crawl
            ? formatDateTime(crawl.finishedAt ?? crawl.createdAt)
            : "No crawl data available"
        }
        healthScore={crawl?.healthScore ?? null}
        warnings={warnings}
      />
    );
  } catch (error) {
    console.error("🚨 Error loading audit warnings verbose page:", error);
    throw error;
  }
}
