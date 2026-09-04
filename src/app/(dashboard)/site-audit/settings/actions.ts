"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { crawls, projects } from "@/db/schema";
import type { CrawlConfig } from "@/lib/crawler/runner";
import { enqueueJob } from "@/lib/jobs";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";

export type SiteAuditSettingsInput = {
  slugOrId: string;
  domain: string;
  scopeMode: "subdomains" | "exact" | "subfolder";
  startUrl: string;
  respectRobots: boolean;
  pageLimit: number;
  crawlSource: "site" | "sitemap_auto" | "sitemap_custom" | "file";
  sitemapUrl: string;
  userAgent: string;
  crawlDelay: string;
  disallowRules: string;
  allowRules: string;
  ignoreParams: boolean;
  paramsList: string;
  useAuth: boolean;
  authUser: string;
  authPass: string;
  schedule: string;
};

export async function saveSiteAuditSettingsAndRunAction(
  input: SiteAuditSettingsInput,
): Promise<{ success: boolean; error?: string; slug?: string; crawlId?: number }> {
  try {
    const project = await findProjectBySlugOrId(input.slugOrId);
    if (!project) {
      return { success: false, error: "Project not found." };
    }

    const projectId = project.id;
    const slug = toProjectSlug(project.name);

    // 1. Update project configuration in database
    await db
      .update(projects)
      .set({
        crawlLimit: Math.max(10, Math.min(50000, Number(input.pageLimit) || 500)),
        respectRobots: input.respectRobots,
        userAgent: input.userAgent || undefined,
        excludePatterns: input.disallowRules || null,
        includePatterns: input.allowRules || null,
      })
      .where(eq(projects.id, projectId));

    // 2. Prepare comprehensive CrawlConfig
    const crawlConfig: CrawlConfig = {
      scopeMode: input.scopeMode,
      crawlSource: input.crawlSource,
      sitemapUrl:
        input.crawlSource === "sitemap_custom" ? input.sitemapUrl : undefined,
      userAgent: input.userAgent,
      disallowRules: input.disallowRules
        ? input.disallowRules
            .split("\n")
            .map((r) => r.trim())
            .filter(Boolean)
        : [],
      allowRules: input.allowRules
        ? input.allowRules
            .split("\n")
            .map((r) => r.trim())
            .filter(Boolean)
        : [],
      ignoreParams: input.ignoreParams,
      paramsList: input.paramsList
        ? input.paramsList
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : [],
      auth:
        input.useAuth && input.authUser
          ? { user: input.authUser, pass: input.authPass }
          : null,
    };

    // 3. Create crawl record
    const [crawl] = await db
      .insert(crawls)
      .values({ projectId, status: "queued" })
      .returning({ id: crawls.id });

    // 4. Enqueue crawl job with complete config
    await enqueueJob({
      type: "crawl",
      projectId,
      payload: {
        crawlId: crawl.id,
        projectId,
        crawlConfig,
      },
    });

    revalidatePath(`/${slug}/audit`);
    revalidatePath(`/projects/${projectId}/audit`);
    revalidatePath("/site-audit");
    revalidatePath("/jobs");

    return { success: true, slug, crawlId: crawl.id };
  } catch (error) {
    console.error("❌ Failed to save site audit settings and start crawl:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to run audit.",
    };
  }
}
