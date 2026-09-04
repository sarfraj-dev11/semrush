import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { crawls, jobs, projects, type Job } from "@/db/schema";

export type JobContext = {
  job: Job;
  /** Persists progress so the UI can show it while the job runs. */
  report: (progress: number, label?: string) => Promise<void>;
  /** True once the UI has asked for this job to stop. */
  isCancelled: () => Promise<boolean>;
  log: (line: string) => Promise<void>;
};

export type JobHandler = (ctx: JobContext) => Promise<void>;

const handlers = new Map<Job["type"], JobHandler>();

export function registerHandler(type: Job["type"], handler: JobHandler) {
  handlers.set(type, handler);
}

/** Thrown by handlers when they notice a cancellation request. */
export class JobCancelled extends Error {
  constructor() {
    super("Cancelled");
    this.name = "JobCancelled";
  }
}

async function claimNextJob(): Promise<Job | null> {
  const [candidate] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "queued"))
    .orderBy(asc(jobs.createdAt))
    .limit(1);

  if (!candidate) return null;

  // Conditional update is the claim: if another worker got there first the
  // status is no longer 'queued' and this affects zero rows.
  const result = await db
    .update(jobs)
    .set({
      status: "running",
      startedAt: new Date(),
      attempts: candidate.attempts + 1,
      error: null,
      progress: 0,
    })
    .where(and(eq(jobs.id, candidate.id), eq(jobs.status, "queued")));

  if (result.rowsAffected === 0) return null;

  return { ...candidate, status: "running", attempts: candidate.attempts + 1 };
}

function makeContext(job: Job): JobContext {
  return {
    job,
    report: async (progress, label) => {
      await db
        .update(jobs)
        .set({
          progress: Math.max(0, Math.min(100, Math.round(progress))),
          progressLabel: label ?? null,
        })
        .where(eq(jobs.id, job.id));
    },
    isCancelled: async () => {
      const [row] = await db
        .select({ cancelRequested: jobs.cancelRequested })
        .from(jobs)
        .where(eq(jobs.id, job.id));
      return row?.cancelRequested ?? false;
    },
    log: async (line) => {
      const [row] = await db
        .select({ log: jobs.log })
        .from(jobs)
        .where(eq(jobs.id, job.id));
      const stamped = `${new Date().toISOString()}  ${line}`;
      // Keep the tail only; a long crawl would otherwise grow this unbounded.
      const next = [...(row?.log ?? "").split("\n"), stamped]
        .filter(Boolean)
        .slice(-200)
        .join("\n");
      await db.update(jobs).set({ log: next }).where(eq(jobs.id, job.id));
    },
  };
}

async function runJob(job: Job) {
  const handler = handlers.get(job.type);
  const ctx = makeContext(job);

  if (!handler) {
    await db
      .update(jobs)
      .set({
        status: "failed",
        error: `No handler registered for job type "${job.type}".`,
        finishedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));
    return;
  }

  try {
    await handler(ctx);
    await db
      .update(jobs)
      .set({
        status: "completed",
        progress: 100,
        progressLabel: null,
        finishedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));
    console.log(`[job ${job.id}] ${job.type} completed`);
  } catch (error) {
    const cancelled = error instanceof JobCancelled;
    const message = error instanceof Error ? error.message : String(error);

    await db
      .update(jobs)
      .set({
        status: cancelled ? "cancelled" : "failed",
        error: cancelled ? null : message,
        progressLabel: null,
        finishedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));

    console.log(
      `[job ${job.id}] ${job.type} ${cancelled ? "cancelled" : `failed: ${message}`}`,
    );
  }
}

/**
 * A crashed worker leaves jobs stuck in 'running'. They are marked failed
 * rather than requeued: a half-written crawl should be retried deliberately.
 */
async function recoverOrphanedJobs() {
  const result = await db
    .update(jobs)
    .set({
      status: "failed",
      error: "Worker stopped while this job was running.",
      finishedAt: new Date(),
    })
    .where(eq(jobs.status, "running"));

  if (result.rowsAffected > 0) {
    console.log(`Recovered ${result.rowsAffected} interrupted job(s).`);
  }
}

let lastScheduleCheck = 0;
async function checkScheduledAudits() {
  const now = Date.now();
  // Check periodically (every 60s)
  if (now - lastScheduleCheck < 60_000) return;
  lastScheduleCheck = now;

  try {
    const allProjects = await db.select().from(projects);
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    for (const project of allProjects) {
      // Check if there is already an active crawl job for this project
      const [activeJob] = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            eq(jobs.projectId, project.id),
            eq(jobs.type, "crawl"),
          ),
        )
        .limit(1);

      if (activeJob) continue;

      // Check last finished crawl
      const [lastCrawl] = await db
        .select({ finishedAt: crawls.finishedAt })
        .from(crawls)
        .where(
          and(
            eq(crawls.projectId, project.id),
            eq(crawls.status, "completed"),
          ),
        )
        .orderBy(desc(crawls.finishedAt))
        .limit(1);

      const lastFinished = lastCrawl?.finishedAt
        ? new Date(lastCrawl.finishedAt).getTime()
        : 0;

      // If project has never been crawled or is due for weekly audit, enqueue
      if (lastFinished > 0 && now - lastFinished > ONE_WEEK_MS) {
        const [crawl] = await db
          .insert(crawls)
          .values({ projectId: project.id, status: "queued" })
          .returning();
        if (crawl) {
          await db.insert(jobs).values({
            type: "crawl",
            projectId: project.id,
            payload: { crawlId: crawl.id, projectId: project.id },
            status: "queued",
          });
          console.log(`[scheduler] Auto-enqueued weekly scheduled audit for project ${project.name}`);
        }
      }
    }
  } catch (err) {
    console.error("❌ Schedule check error:", err);
  }
}

export async function startWorker({ intervalMs = 1000 } = {}) {
  await recoverOrphanedJobs();
  console.log("Worker ready. Polling for jobs…");

  let stopping = false;
  const stop = () => {
    stopping = true;
    console.log("Worker shutting down…");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopping) {
    let job: Job | null = null;
    try {
      await checkScheduledAudits();
      job = await claimNextJob();
    } catch (error) {
      console.error("❌ Failed to claim a job:", error);
    }

    if (job) {
      console.log(`[job ${job.id}] ${job.type} started`);
      await runJob(job);
      continue; // Drain the queue before sleeping again.
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  process.exit(0);
}
