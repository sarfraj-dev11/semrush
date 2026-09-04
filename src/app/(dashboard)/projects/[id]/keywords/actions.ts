"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { keywords, projects } from "@/db/schema";
import { toProjectSlug } from "@/lib/slug-utils";

async function revalidateProjectKeywords(projectId: number) {
  revalidatePath(`/projects/${projectId}/keywords`);
  revalidatePath(`/projects/${projectId}/rankings`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/position-tracking");

  const [proj] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (proj?.name) {
    const slug = toProjectSlug(proj.name);
    revalidatePath(`/${slug}/keywords`);
    revalidatePath(`/${slug}/rankings`);
    revalidatePath(`/${slug}`);
  }
}

export async function createKeywordAction(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  const keyword = (formData.get("keyword") as string)?.trim();
  const searchVolume = formData.get("searchVolume")
    ? Number(formData.get("searchVolume"))
    : null;
  const difficulty = formData.get("difficulty")
    ? Number(formData.get("difficulty"))
    : null;
  const cpc = formData.get("cpc") ? Number(formData.get("cpc")) : null;
  const intent = (formData.get("intent") as string)?.trim() || null;
  const targetUrl = (formData.get("targetUrl") as string)?.trim() || null;
  const tags = (formData.get("tags") as string)?.trim() || null;

  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error("Invalid project ID.");
  }
  if (!keyword) throw new Error("Keyword is required.");

  const [existing] = await db
    .select({ id: keywords.id })
    .from(keywords)
    .where(and(eq(keywords.projectId, projectId), eq(keywords.keyword, keyword)))
    .limit(1);

  if (existing) {
    throw new Error(`Keyword "${keyword}" is already tracked for this project.`);
  }

  const [inserted] = await db.insert(keywords).values({
    projectId,
    keyword,
    searchVolume,
    difficulty,
    cpc,
    intent,
    targetUrl,
    tags,
  }).returning({ id: keywords.id });

  // Sync to Firebase
  try {
    const { syncKeywordToFirebase } = await import("@/lib/firebase-tracking");
    await syncKeywordToFirebase({
      id: inserted.id,
      projectId,
      keyword,
      searchVolume,
      difficulty,
      cpc,
      intent,
      targetUrl,
      tags,
    });
  } catch (err) {
    console.error("❌ Firebase sync failed (keyword creation):", err);
  }

  await revalidateProjectKeywords(projectId);
}

export async function updateKeywordAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const projectId = Number(formData.get("projectId"));
  const keyword = (formData.get("keyword") as string)?.trim();
  const targetUrl = (formData.get("targetUrl") as string)?.trim() || null;

  if (!id || !keyword) throw new Error("Invalid keyword data.");

  const payload: Record<string, unknown> = {
    keyword,
    targetUrl,
  };

  if (formData.has("searchVolume")) {
    payload.searchVolume = formData.get("searchVolume")
      ? Number(formData.get("searchVolume"))
      : null;
  }
  if (formData.has("difficulty")) {
    payload.difficulty = formData.get("difficulty")
      ? Number(formData.get("difficulty"))
      : null;
  }
  if (formData.has("cpc")) {
    payload.cpc = formData.get("cpc") ? Number(formData.get("cpc")) : null;
  }
  if (formData.has("intent")) {
    payload.intent = (formData.get("intent") as string)?.trim() || null;
  }
  if (formData.has("tags")) {
    payload.tags = (formData.get("tags") as string)?.trim() || null;
  }

  await db
    .update(keywords)
    .set(payload)
    .where(eq(keywords.id, id));

  await revalidateProjectKeywords(projectId);
}

export async function deleteKeywordAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const [row] = await db
    .select({ projectId: keywords.projectId })
    .from(keywords)
    .where(eq(keywords.id, id))
    .limit(1);

  if (!row) return;

  await db.delete(keywords).where(eq(keywords.id, id));

  // Delete from Firebase
  try {
    const { deleteFirebaseKeyword } = await import("@/lib/firebase-tracking");
    await deleteFirebaseKeyword(row.projectId, id);
  } catch (err) {
    console.error("❌ Firebase sync failed (keyword delete):", err);
  }

  await revalidateProjectKeywords(row.projectId);
}
