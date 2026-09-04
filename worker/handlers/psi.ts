import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, psiRuns } from "@/db/schema";
import { fetchPsiAudit } from "@/lib/psi";
import { JobCancelled, registerHandler } from "../runtime";

registerHandler("psi", async (ctx) => {
  const payload = ctx.job.payload as {
    projectId?: number;
    url?: string;
    strategy?: "mobile" | "desktop";
  };

  const projectId = Number(payload.projectId);
  const strategy = payload.strategy === "desktop" ? "desktop" : "mobile";

  if (!Number.isInteger(projectId)) {
    throw new Error("PSI job is missing projectId.");
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) {
    throw new Error(`Project ${projectId} no longer exists.`);
  }

  const targetUrl = payload.url || project.domain;

  if (await ctx.isCancelled()) throw new JobCancelled();

  await ctx.report(10, `Auditing ${targetUrl} (${strategy})`);
  await ctx.log(`Requesting Google PageSpeed Insights for ${targetUrl} (${strategy})…`);

  try {
    const result = await fetchPsiAudit(targetUrl, strategy);

    if (await ctx.isCancelled()) throw new JobCancelled();

    await ctx.report(80, "Saving audit metrics");
    await ctx.log(
      `Received scores: Performance ${result.performanceScore ?? "N/A"}, SEO ${result.seoScore ?? "N/A"}, Accessibility ${result.accessibilityScore ?? "N/A"}, Best Practices ${result.bestPracticesScore ?? "N/A"}`,
    );

    await db.insert(psiRuns).values({
      projectId,
      url: targetUrl,
      strategy,
      performanceScore: result.performanceScore,
      seoScore: result.seoScore,
      accessibilityScore: result.accessibilityScore,
      bestPracticesScore: result.bestPracticesScore,
      lcpMs: result.lcpMs,
      cls: result.cls,
      inpMs: result.inpMs,
      fcpMs: result.fcpMs,
      ttfbMs: result.ttfbMs,
      tbtMs: result.tbtMs,
      speedIndexMs: result.speedIndexMs,
      hasFieldData: result.hasFieldData,
      opportunities: result.opportunities,
    });

    await ctx.report(100, "Completed");
    await ctx.log("PSI audit recorded successfully.");
  } catch (error) {
    console.error("❌ PSI worker error:", error);
    await ctx.log(`Audit failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
});
