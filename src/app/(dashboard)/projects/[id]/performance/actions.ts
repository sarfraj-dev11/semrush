"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { jobs, projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function startPsiAction(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  const url = (formData.get("url") as string)?.trim() || undefined;
  const strategy = ((formData.get("strategy") as string) || "mobile") as
    | "mobile"
    | "desktop";

  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error("Invalid project ID.");
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new Error("Project not found.");

  await db.insert(jobs).values({
    type: "psi",
    projectId,
    payload: {
      projectId,
      url: url || project.domain,
      strategy,
    },
    status: "queued",
    progress: 0,
    progressLabel: "Queued for audit…",
  });

  revalidatePath(`/projects/${projectId}/performance`);
  revalidatePath("/jobs");
}
