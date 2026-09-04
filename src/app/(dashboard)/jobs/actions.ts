"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { jobs } from "@/db/schema";

export async function cancelJobAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  // A queued job has no worker attached, so it can be stopped outright.
  const cancelledDirectly = await db
    .update(jobs)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(and(eq(jobs.id, id), eq(jobs.status, "queued")));

  // A running job has to be asked; the worker checks this between units of work.
  if (cancelledDirectly.rowsAffected === 0) {
    await db
      .update(jobs)
      .set({ cancelRequested: true })
      .where(and(eq(jobs.id, id), eq(jobs.status, "running")));
  }

  revalidatePath("/jobs");
}

export async function retryJobAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await db
    .update(jobs)
    .set({
      status: "queued",
      progress: 0,
      progressLabel: null,
      error: null,
      cancelRequested: false,
      startedAt: null,
      finishedAt: null,
    })
    .where(and(eq(jobs.id, id), inArray(jobs.status, ["failed", "cancelled"])));

  revalidatePath("/jobs");
}

export async function clearFinishedJobsAction() {
  await db
    .delete(jobs)
    .where(inArray(jobs.status, ["completed", "failed", "cancelled"]));

  revalidatePath("/jobs");
}
