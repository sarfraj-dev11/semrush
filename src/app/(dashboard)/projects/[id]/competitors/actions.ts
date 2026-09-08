"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { competitors, projects } from "@/db/schema";
import { toProjectSlug } from "@/lib/slug-utils";

export async function addCompetitorAction(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  const rawDomain = (formData.get("domain") as string)?.trim();
  const name = (formData.get("name") as string)?.trim() || null;

  if (!projectId || !rawDomain) {
    throw new Error("Competitor domain is required.");
  }

  const domain = rawDomain
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  const [existing] = await db
    .select({ id: competitors.id })
    .from(competitors)
    .where(
      and(
        eq(competitors.projectId, projectId),
        eq(competitors.domain, domain),
      ),
    )
    .limit(1);

  if (existing) {
    throw new Error("This competitor domain is already tracked.");
  }

  const [inserted] = await db
    .insert(competitors)
    .values({
      projectId,
      domain,
      name: name || domain,
    })
    .returning({ id: competitors.id });

  // Sync to Cloud Firestore
  try {
    const { syncCompetitorToFirebase } = await import("@/lib/firebase-tracking");
    await syncCompetitorToFirebase({
      id: inserted.id,
      projectId,
      domain,
      name: name || domain,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("❌ [addCompetitorAction] Failed to sync competitor to Firebase:", err);
  }

  // Look up project name to revalidate slug routes
  const [proj] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  revalidatePath(`/projects/${projectId}/competitors`);
  revalidatePath(`/projects/${projectId}`);
  if (proj?.name) {
    const slug = toProjectSlug(proj.name);
    revalidatePath(`/${slug}/competitors`);
    revalidatePath(`/${slug}`);
  }
}

export async function deleteCompetitorAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const [row] = await db
    .select({ projectId: competitors.projectId })
    .from(competitors)
    .where(eq(competitors.id, id))
    .limit(1);

  if (!row) return;

  await db.delete(competitors).where(eq(competitors.id, id));

  // Delete from Cloud Firestore
  try {
    const { deleteFirebaseCompetitor } = await import("@/lib/firebase-tracking");
    await deleteFirebaseCompetitor(row.projectId, id);
  } catch (err) {
    console.error("❌ [deleteCompetitorAction] Failed to delete competitor from Firebase:", err);
  }

  const [proj] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, row.projectId))
    .limit(1);

  revalidatePath(`/projects/${row.projectId}/competitors`);
  revalidatePath(`/projects/${row.projectId}`);
  if (proj?.name) {
    const slug = toProjectSlug(proj.name);
    revalidatePath(`/${slug}/competitors`);
    revalidatePath(`/${slug}`);
  }
}
