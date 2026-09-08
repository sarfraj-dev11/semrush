import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { clients, crawls, jobs, projects } from "@/db/schema";
import type { KeywordRow } from "@/lib/keyword-stats";

/**
 * Cached per request so the project layout and its page can both call it
 * without issuing the query twice.
 */
export const getProjectWithClient = cache(async (projectId: number) => {
  if (!Number.isInteger(projectId) || projectId <= 0) return null;

  let rows = await db
    .select({ project: projects, client: clients })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!rows[0]) {
    try {
      const { syncProjectsFromFirebase } = await import("@/lib/firebase-tracking");
      await syncProjectsFromFirebase();
      rows = await db
        .select({ project: projects, client: clients })
        .from(projects)
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(eq(projects.id, projectId))
        .limit(1);
    } catch (err) {
      console.error("❌ [queries] Failed to sync project from Firebase:", err);
    }
  }

  return rows[0] ?? null;
});

export const getClientOptions = cache(async () =>
  db.select({ id: clients.id, name: clients.name }).from(clients),
);

/** Most recent finished crawl, used as the default view on the audit tab. */
export const getLatestCompletedCrawl = cache(async (projectId: number) => {
  const [crawl] = await db
    .select()
    .from(crawls)
    .where(and(eq(crawls.projectId, projectId), eq(crawls.status, "completed")))
    .orderBy(desc(crawls.finishedAt))
    .limit(1);

  return crawl ?? null;
});

/** The completed crawl before `crawlId`, for run-over-run comparison. */
export const getPreviousCompletedCrawl = cache(
  async (projectId: number, crawlId: number) => {
    const [crawl] = await db
      .select()
      .from(crawls)
      .where(
        and(
          eq(crawls.projectId, projectId),
          eq(crawls.status, "completed"),
          ne(crawls.id, crawlId),
        ),
      )
      .orderBy(desc(crawls.finishedAt))
      .limit(1);

    return crawl ?? null;
  },
);

export const getCrawlHistory = cache(async (projectId: number, limit = 20) =>
  db
    .select()
    .from(crawls)
    .where(eq(crawls.projectId, projectId))
    .orderBy(desc(crawls.createdAt))
    .limit(limit),
);

export const getActiveProjectJob = cache(
  async (projectId: number, type: "crawl" | "psi" | "import") => {
    const [job] = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.projectId, projectId),
          eq(jobs.type, type),
          inArray(jobs.status, ["queued", "running"]),
        ),
      )
      .orderBy(desc(jobs.createdAt))
      .limit(1);

    return job ?? null;
  },
);

/**
 * Every keyword for a project with its latest recorded position and the one
 * before it. The correlated subquery is what makes this "latest": a plain join
 * returns one row per keyword per check date and inflates every count.
 *
 * Shared by the project keywords page and the position-tracking directory so
 * "improved" and "declined" mean the same thing on both.
 */
export const getKeywordRows = cache(async (projectId: number) =>
  db.all<KeywordRow>(sql`
    select
      k.id                as id,
      k.keyword           as keyword,
      k.search_volume     as searchVolume,
      k.difficulty        as difficulty,
      k.intent            as intent,
      k.target_url        as targetUrl,
      r.position          as position,
      r.url               as url,
      r.date              as date,
      r.device            as device,
      r.country           as country,
      (
        select r2.position from keyword_rankings r2
        where r2.keyword_id = k.id and r2.date < r.date
        order by r2.date desc limit 1
      )                   as previousPosition
    from keywords k
    left join keyword_rankings r
      on r.keyword_id = k.id
     and r.date = (
       select max(r3.date) from keyword_rankings r3 where r3.keyword_id = k.id
     )
    where k.project_id = ${projectId}
    order by (r.position is null), r.position asc, k.keyword asc
  `),
);
