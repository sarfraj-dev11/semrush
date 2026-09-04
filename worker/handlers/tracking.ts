import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { trackProjectRankings } from "@/lib/search/rank-tracker";
import { JobCancelled, registerHandler } from "../runtime";

registerHandler("tracking", async (ctx) => {
  const payload = ctx.job.payload as {
    projectId?: number;
  };

  const projectId = Number(payload.projectId);
  if (!Number.isInteger(projectId)) {
    throw new Error("Tracking job is missing projectId.");
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new Error(`Project ${projectId} no longer exists.`);
  }

  if (await ctx.isCancelled()) throw new JobCancelled();

  await ctx.report(5, `Starting rank tracking for ${project.domain}`);
  await ctx.log(`Starting rank check across Top 10 Google Pages (Positions 1–100) for ${project.name} (${project.domain})…`);

  try {
    const result = await trackProjectRankings(project, {
      report: async (done, total, keyword) => {
        const progress = Math.min(95, Math.round((done / Math.max(total, 1)) * 90) + 5);
        await ctx.report(progress, `Tracking keyword (${done}/${total}): ${keyword}`);
      },
      log: ctx.log,
      isCancelled: ctx.isCancelled,
    });

    if (await ctx.isCancelled()) throw new JobCancelled();

    await ctx.report(100, "Completed");

    const breakdownSummary = result.breakdown
      .filter((b) => b.checked > 0)
      .map((b) => `${b.device}/${b.country}: ${b.ranked}/${b.checked} ranking`)
      .join(", ");

    await ctx.log(
      `Rank check complete: ${result.checked} checks across ` +
        `${result.breakdown.length} device×country segments. ` +
        `${result.ranked} ranking in Top 100, ${result.notRanking} not in Top 100, ${result.failed} failed.` +
        (breakdownSummary ? `\nBreakdown: ${breakdownSummary}` : ""),
    );
  } catch (error) {
    console.error("❌ Tracking worker error:", error);
    await ctx.log(`Rank tracking failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
});
