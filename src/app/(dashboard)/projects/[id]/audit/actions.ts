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

export async function checkLlmsTxtAction(domain: string) {
  try {
    const origin = domain.startsWith("http") ? domain : `https://${domain}`;
    const url = new URL("/llms.txt", origin).toString();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SEOConsoleBot/1.0; +https://seoconsole.ai)",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const isHtml = /text\/html|application\/xhtml/i.test(contentType);

    if (!response.ok || isHtml) {
      return {
        success: true,
        found: false,
        status: response.status,
        url,
      };
    }

    const text = await response.text();
    const head = text.slice(0, 256).trimStart().toLowerCase();
    const isSoft404 = head.startsWith("<!doctype html") || head.startsWith("<html");

    if (isSoft404) {
      return {
        success: true,
        found: false,
        status: response.status,
        url,
      };
    }

    return {
      success: true,
      found: true,
      status: response.status,
      sizeBytes: Buffer.byteLength(text, "utf-8"),
      url,
    };
  } catch (error) {
    console.error("🚨 Error checking llms.txt availability:", error);
    return {
      success: false,
      found: false,
      status: null,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

