"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { projects } from "@/db/schema";
import {
  formToObject,
  projectSchema,
  readCheckbox,
  toActionState,
  type ActionState,
} from "@/lib/validation";

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = projectSchema.safeParse({
    ...formToObject(formData),
    respectRobots: readCheckbox(formData, "respectRobots"),
  });
  if (!parsed.success) return toActionState(parsed.error);

  const [inserted] = await db.insert(projects).values(parsed.data).returning({ id: projects.id });

  // Sync to Firebase for serverless cron access
  try {
    const { syncProjectToFirebase } = await import("@/lib/firebase-tracking");
    await syncProjectToFirebase({
      id: inserted.id,
      name: parsed.data.name,
      domain: parsed.data.domain,
      targetCountry: parsed.data.targetCountry ?? "US",
      targetDevice: parsed.data.targetDevice ?? "mobile",
      clientId: parsed.data.clientId,
    });
  } catch (err) {
    console.error("❌ Firebase sync failed (project creation):", err);
  }

  revalidatePath("/projects");
  revalidatePath(`/clients/${parsed.data.clientId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updateProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Missing project id." };
  }

  const parsed = projectSchema.safeParse({
    ...formToObject(formData),
    respectRobots: readCheckbox(formData, "respectRobots"),
  });
  if (!parsed.success) return toActionState(parsed.error);

  await db
    .update(projects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(projects.id, id));

  // Sync update to Firebase
  try {
    const { syncProjectToFirebase } = await import("@/lib/firebase-tracking");
    await syncProjectToFirebase({
      id,
      name: parsed.data.name,
      domain: parsed.data.domain,
      targetCountry: parsed.data.targetCountry ?? "US",
      targetDevice: parsed.data.targetDevice ?? "mobile",
      clientId: parsed.data.clientId,
      updatedAt: new Date(),
    });
  } catch (err) {
    console.error("❌ Firebase sync failed (project update):", err);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

/** Cascades to crawls, pages, issues, keywords, backlinks and tasks. */
export async function deleteProjectAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db.delete(projects).where(eq(projects.id, id));

  // Delete from Firebase too
  try {
    const { deleteFirebaseProject } = await import("@/lib/firebase-tracking");
    await deleteFirebaseProject(id);
  } catch (err) {
    console.error("❌ Firebase sync failed (project delete):", err);
  }

  revalidatePath("/projects");
  revalidatePath("/");
  redirect("/projects");
}
