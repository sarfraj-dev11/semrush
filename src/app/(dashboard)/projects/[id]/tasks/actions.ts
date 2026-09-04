"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";

export async function createTaskAction(formData: FormData) {
  const projectId = Number(formData.get("projectId"));
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const status = ((formData.get("status") as string) || "todo") as
    | "todo"
    | "in_progress"
    | "done";
  const priority = ((formData.get("priority") as string) || "medium") as
    | "low"
    | "medium"
    | "high";
  const assignee = (formData.get("assignee") as string)?.trim() || null;
  const dueDate = (formData.get("dueDate") as string)?.trim() || null;
  const issueCode = (formData.get("issueCode") as string)?.trim() || null;
  const pageUrl = (formData.get("pageUrl") as string)?.trim() || null;

  if (!projectId || !title) {
    throw new Error("Task title is required.");
  }

  await db.insert(tasks).values({
    projectId,
    title,
    description,
    status,
    priority,
    assignee,
    dueDate,
    issueCode,
    pageUrl,
    completedAt: status === "done" ? new Date() : null,
  });

  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}/report`);
}

export async function updateTaskStatusAction(
  taskId: number,
  status: "todo" | "in_progress" | "done",
) {
  if (!taskId) return;

  const [task] = await db
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) return;

  await db
    .update(tasks)
    .set({
      status,
      completedAt: status === "done" ? new Date() : null,
    })
    .where(eq(tasks.id, taskId));

  revalidatePath(`/projects/${task.projectId}/tasks`);
  revalidatePath(`/projects/${task.projectId}/report`);
}

export async function deleteTaskAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const [task] = await db
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!task) return;

  await db.delete(tasks).where(eq(tasks.id, id));
  revalidatePath(`/projects/${task.projectId}/tasks`);
  revalidatePath(`/projects/${task.projectId}/report`);
}
