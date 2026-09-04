import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, type Job } from "@/db/schema";

export type JobType = Job["type"];
export type JobStatus = Job["status"];

export const ACTIVE_STATUSES = ["queued", "running"] as const;

export async function enqueueJob(input: {
  type: JobType;
  projectId?: number | null;
  payload: Record<string, unknown>;
}) {
  const [job] = await db
    .insert(jobs)
    .values({
      type: input.type,
      projectId: input.projectId ?? null,
      payload: input.payload,
    })
    .returning({ id: jobs.id });

  return job.id;
}

/**
 * One job of a given type per project at a time — a second concurrent crawl
 * of the same site would just fight the first one for the same rows.
 */
export async function hasActiveJob(type: JobType, projectId: number) {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(
      and(
        eq(jobs.type, type),
        eq(jobs.projectId, projectId),
        inArray(jobs.status, [...ACTIVE_STATUSES]),
      ),
    );

  return (row?.count ?? 0) > 0;
}

export async function listJobs(limit = 50) {
  return db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(limit);
}

export async function countActiveJobs() {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(inArray(jobs.status, [...ACTIVE_STATUSES]));

  return row?.count ?? 0;
}

export function jobStatusTone(status: JobStatus) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "running":
      return "accent" as const;
    case "queued":
      return "neutral" as const;
    case "failed":
      return "critical" as const;
    case "cancelled":
      return "warning" as const;
  }
}
