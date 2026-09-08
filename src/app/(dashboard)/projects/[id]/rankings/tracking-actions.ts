"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { jobs, keywords, projects } from "@/db/schema";
import { trackProjectRankings } from "@/lib/search/rank-tracker";
import { toProjectSlug } from "@/lib/slug-utils";

export async function runRankCheckAction(projectId: number) {
  if (!Number.isInteger(projectId) || projectId <= 0) {
    console.error("⚠️ [RankCheck] Invalid project ID provided:", projectId);
    return { success: false, message: "Invalid project ID." };
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    console.error(`⚠️ [RankCheck] Project ${projectId} not found in database.`);
    return { success: false, message: `Project ${projectId} not found.` };
  }

  const projectKeywords = await db
    .select({ id: keywords.id, keyword: keywords.keyword })
    .from(keywords)
    .where(eq(keywords.projectId, projectId));

  if (projectKeywords.length === 0) {
    return {
      success: false,
      message: "No keywords are tracked for this project. Add keywords first.",
    };
  }

  try {
    // Execute rank check across Google Top 10 Pages (Positions 1-100)
    const result = await trackProjectRankings(project);

    // Revalidate relevant pages
    revalidatePath(`/projects/${projectId}/rankings`);
    revalidatePath(`/projects/${projectId}/keywords`);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/position-tracking");

    if (project.name) {
      const slug = toProjectSlug(project.name);
      revalidatePath(`/${slug}/rankings`);
      revalidatePath(`/${slug}/keywords`);
      revalidatePath(`/${slug}`);
    }

    // Build a breakdown summary for the feedback message
    const breakdownParts = result.breakdown
      .filter((b) => b.checked > 0)
      .map((b) => `${b.device}/${b.country}: ${b.ranked} ranking`)
      .join(", ");

    return {
      success: true,
      result,
      message: `Checked ${result.checked} keyword×device×country combinations. ` +
        `${result.ranked} ranking in Top 100, ${result.notRanking} not ranking. ` +
        (breakdownParts ? `\nBreakdown: ${breakdownParts}` : ""),
    };
  } catch (error) {
    console.error("❌ Error running rank check:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to run rank check.",
    };
  }
}

export async function syncFirebaseDataAction(projectId: number) {
  try {
    const { syncKeywordsAndRankingsFromFirebase, syncProjectsFromFirebase } = await import(
      "@/lib/firebase-tracking"
    );
    await syncProjectsFromFirebase();
    await syncKeywordsAndRankingsFromFirebase(projectId);

    revalidatePath(`/projects/${projectId}/rankings`);
    revalidatePath(`/projects/${projectId}/keywords`);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/position-tracking");
    revalidatePath("/projects");

    return {
      success: true,
      message: "Successfully synced latest data from Firebase.",
    };
  } catch (error) {
    console.error("❌ [Firebase Sync] Action failed:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to sync with Firebase.",
    };
  }
}
