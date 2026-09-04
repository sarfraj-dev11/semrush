"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { backlinks } from "@/db/schema";
import { hostnameOf } from "@/lib/utils";

export async function createBacklinkAction(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  const sourceUrl = (formData.get("sourceUrl") as string)?.trim();
  const sourceDomain =
    (formData.get("sourceDomain") as string)?.trim() ||
    (sourceUrl ? hostnameOf(sourceUrl) : "unknown");
  const targetUrl = (formData.get("targetUrl") as string)?.trim() || null;
  const anchorText = (formData.get("anchorText") as string)?.trim() || null;
  const domainRating = formData.get("domainRating")
    ? Number(formData.get("domainRating"))
    : null;
  const isFollow = formData.get("isFollow") === "true";
  const status = ((formData.get("status") as string) || "active") as
    | "new"
    | "active"
    | "lost";

  if (!projectId || !sourceUrl) {
    throw new Error("Source URL is required.");
  }

  const [existing] = await db
    .select({ id: backlinks.id })
    .from(backlinks)
    .where(
      and(
        eq(backlinks.projectId, projectId),
        eq(backlinks.sourceUrl, sourceUrl),
      ),
    )
    .limit(1);

  if (existing) {
    throw new Error("This backlink URL is already tracked for this project.");
  }

  await db.insert(backlinks).values({
    projectId,
    sourceUrl,
    sourceDomain,
    targetUrl,
    anchorText,
    domainRating,
    isFollow,
    firstSeen: new Date().toISOString().split("T")[0],
    lastSeen: new Date().toISOString().split("T")[0],
    status,
  });

  revalidatePath(`/projects/${projectId}/backlinks`);
}

export async function deleteBacklinkAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const [row] = await db
    .select({ projectId: backlinks.projectId })
    .from(backlinks)
    .where(eq(backlinks.id, id))
    .limit(1);

  if (!row) return;

  await db.delete(backlinks).where(eq(backlinks.id, id));
  revalidatePath(`/projects/${row.projectId}/backlinks`);
}
