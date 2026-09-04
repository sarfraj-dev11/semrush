import { eq } from "drizzle-orm";
import { db } from "@/db";
import { crawls, projects } from "@/db/schema";
import { CrawlCancelled, runCrawl, type CrawlConfig } from "@/lib/crawler/runner";
import { JobCancelled, registerHandler } from "../runtime";

registerHandler("crawl", async (ctx) => {
  const payload = ctx.job.payload as {
    crawlId?: number;
    projectId?: number;
    crawlConfig?: CrawlConfig;
  };
  const crawlId = Number(payload.crawlId);
  const projectId = Number(payload.projectId);
  const crawlConfig = payload.crawlConfig;

  if (!Number.isInteger(crawlId) || !Number.isInteger(projectId)) {
    throw new Error("Crawl job is missing crawlId or projectId.");
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new Error(`Project ${projectId} no longer exists.`);

  await ctx.report(0, "Starting crawl");

  try {
    await runCrawl(
      crawlId,
      project,
      {
        report: ctx.report,
        isCancelled: ctx.isCancelled,
        log: ctx.log,
      },
      crawlConfig,
    );
  } catch (error) {
    if (error instanceof CrawlCancelled) {
      // runCrawl already marked the crawl row cancelled.
      throw new JobCancelled();
    }

    console.error("❌ Crawl job failed:", error);

    await db
      .update(crawls)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      })
      .where(eq(crawls.id, crawlId));

    throw error;
  }
});
