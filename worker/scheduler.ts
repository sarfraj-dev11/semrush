import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { jobs, keywords, projects } from "@/db/schema";

export function getISTDate(): {
  year: number;
  month: number;
  date: number;
  hours: number;
  minutes: number;
  dayString: string;
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value || 0);
  const year = get("year");
  const month = get("month");
  const date = get("day");
  const hours = get("hour");
  const minutes = get("minute");
  const dayString = `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
  return { year, month, date, hours, minutes, dayString };
}

let lastScheduledDay: string | null = null;

export async function queueDailyRankTracking(scheduledDate?: string) {
  const day = scheduledDate ?? getISTDate().dayString;
  console.log(`⏰ [Scheduler] Triggering Daily 6:00 PM IST rank check for ${day}...`);

  // Find all projects that currently have tracked keywords
  const trackedKeywords = await db
    .select({ projectId: keywords.projectId })
    .from(keywords);

  const projectIds = Array.from(
    new Set(
      trackedKeywords
        .map((k) => k.projectId)
        .filter((id): id is number => id !== null && id > 0),
    ),
  );

  if (projectIds.length === 0) {
    console.log("⏰ [Scheduler] No projects with tracked keywords found.");
    return;
  }

  for (const projectId of projectIds) {
    // Check if a tracking job is already queued or running for this project
    const [existing] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.projectId, projectId),
          eq(jobs.type, "tracking"),
          inArray(jobs.status, ["queued", "running"]),
        ),
      )
      .limit(1);

    if (existing) {
      console.log(`⏰ [Scheduler] Project ${projectId} already has a pending tracking job.`);
      continue;
    }

    await db.insert(jobs).values({
      type: "tracking",
      projectId,
      payload: { projectId, scheduledAt: "18:00 IST", scheduledDate: day },
      status: "queued",
    });
    console.log(`⏰ [Scheduler] Queued tracking job for Project ID ${projectId}`);
  }
}

export function startScheduler() {
  console.log("⏰ Rank Tracking Scheduler active. Next check target: Everyday at 6:00 PM IST (Asia/Kolkata).");

  // Check every 30 seconds
  const interval = setInterval(async () => {
    try {
      const ist = getISTDate();

      // Check if it's 18:00 (6:00 PM) IST and hasn't run yet today
      if (ist.hours === 18 && lastScheduledDay !== ist.dayString) {
        lastScheduledDay = ist.dayString;
        await queueDailyRankTracking(ist.dayString);
      }
    } catch (error) {
      console.error("❌ Scheduler interval error:", error);
    }
  }, 30_000);

  return () => clearInterval(interval);
}
