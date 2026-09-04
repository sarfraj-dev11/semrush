import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { keywords, projects } from "@/db/schema";
import { trackProjectRankings } from "@/lib/search/rank-tracker";
import { getSearchProvider } from "@/lib/search/registry";
import "@/lib/search/providers";

/**
 * Vercel Cron endpoint — Daily rank tracking at 6:00 PM IST.
 *
 * Vercel calls this route on schedule (configured in vercel.json). It iterates
 * over every project that has tracked keywords and runs rank checks for all
 * device × country combinations.
 *
 * Security: requires CRON_SECRET header to prevent unauthorized triggers.
 */

export const maxDuration = 300; // 5 minutes max execution time
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error("❌ Unauthorized cron request — invalid CRON_SECRET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("⏰ [Cron] Daily rank tracking triggered at", new Date().toISOString());

  // Check if a search provider is configured
  const provider = await getSearchProvider();
  if (!provider) {
    console.log("⚠️ [Cron] No search provider configured, skipping rank tracking");
    return NextResponse.json({
      success: false,
      message: "No search provider configured. Set SERPER_API_KEY, SERPAPI_KEY, or DataForSEO credentials.",
    });
  }

  // Find all projects that have tracked keywords
  const trackedKeywords = await db
    .select({ projectId: keywords.projectId })
    .from(keywords);

  const projectIds = [
    ...new Set(
      trackedKeywords
        .map((k) => k.projectId)
        .filter((id): id is number => id !== null && id > 0),
    ),
  ];

  if (projectIds.length === 0) {
    console.log("⏰ [Cron] No projects with tracked keywords found.");
    return NextResponse.json({
      success: true,
      message: "No projects with keywords to track.",
      projectsTracked: 0,
    });
  }

  console.log(`⏰ [Cron] Tracking ${projectIds.length} projects via ${provider.label}`);

  const results: {
    projectId: number;
    projectName: string;
    success: boolean;
    checked: number;
    ranked: number;
    notRanking: number;
    failed: number;
    error?: string;
  }[] = [];

  for (const projectId of projectIds) {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) continue;

    try {
      console.log(`⏰ [Cron] Tracking project: ${project.name} (${project.domain})`);

      const result = await trackProjectRankings(project, {
        log: async (line) => console.log(`  [${project.name}] ${line}`),
      }, {
        provider,
        pauseMs: 1000, // 1 second pause between keywords to avoid rate limits
      });

      results.push({
        projectId: project.id,
        projectName: project.name,
        success: true,
        checked: result.checked,
        ranked: result.ranked,
        notRanking: result.notRanking,
        failed: result.failed,
      });

      console.log(
        `✅ [Cron] ${project.name}: ${result.checked} checked, ` +
          `${result.ranked} ranking, ${result.notRanking} not ranking`,
      );
    } catch (error) {
      console.error(`❌ [Cron] Failed tracking ${project.name}:`, error);
      results.push({
        projectId: project.id,
        projectName: project.name,
        success: false,
        checked: 0,
        ranked: 0,
        notRanking: 0,
        failed: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const totalChecked = results.reduce((sum, r) => sum + r.checked, 0);
  const totalRanked = results.reduce((sum, r) => sum + r.ranked, 0);
  const totalFailed = results.filter((r) => !r.success).length;

  console.log(
    `⏰ [Cron] Daily tracking complete: ${results.length} projects, ` +
      `${totalChecked} keywords checked, ${totalRanked} ranking, ` +
      `${totalFailed} project failures`,
  );

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    projectsTracked: results.length,
    totalChecked,
    totalRanked,
    projectsFailed: totalFailed,
    results,
  });
}
