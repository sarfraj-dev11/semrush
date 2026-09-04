"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { crawls } from "@/db/schema";
import { enqueueJob, hasActiveJob } from "@/lib/jobs";

export async function startCrawlAction(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  if (!Number.isInteger(projectId) || projectId <= 0) return;

  // Two concurrent crawls of one site would only compete for the same rows.
  if (await hasActiveJob("crawl", projectId)) return;

  const [crawl] = await db
    .insert(crawls)
    .values({ projectId, status: "queued" })
    .returning({ id: crawls.id });

  await enqueueJob({
    type: "crawl",
    projectId,
    payload: { crawlId: crawl.id, projectId },
  });

  revalidatePath(`/projects/${projectId}/audit`);
  revalidatePath("/jobs");
}
