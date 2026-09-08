import {
  firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
} from "./firebase";

/**
 * Firebase Firestore sync layer for SEO tracking data.
 *
 * Mirrors project, keyword, and ranking data to Firestore so the Vercel cron
 * job can run rank checks independently of the local SQLite database.
 *
 * Collections:
 *   seo_projects/{projectId}  — project config (domain, countries, device)
 *   seo_keywords/{projectId}_{keywordId}  — keyword for a project
 *   seo_rankings/{projectId}_{keywordId}_{date}_{device}_{country}  — ranking result
 */

// ─── Types ────────────────────────────────────────────────────────────────

export type FirebaseProject = {
  id: number;
  name: string;
  domain: string;
  targetCountry: string;
  targetDevice: string;
  clientId: number;
  createdAt: string;
  updatedAt: string;
};

export type FirebaseKeyword = {
  id: number;
  projectId: number;
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: string | null;
  targetUrl: string | null;
  tags: string | null;
  country: string;
  createdAt: string;
};

export type FirebaseRanking = {
  keywordId: number;
  projectId: number;
  keyword: string;
  date: string;
  position: number | null;
  url: string | null;
  device: string | null;
  country: string | null;
  source: string;
  checkedAt: string;
};

export type FirebaseCompetitor = {
  id: number;
  projectId: number;
  domain: string;
  name: string | null;
  createdAt: string;
};

// ─── Projects ─────────────────────────────────────────────────────────────

const PROJECTS_COL = "seo_projects";
const KEYWORDS_COL = "seo_keywords";
const RANKINGS_COL = "seo_rankings";
const COMPETITORS_COL = "seo_competitors";

/** Save or update a project in Firestore. */
export async function syncProjectToFirebase(project: {
  id: number;
  name: string;
  domain: string;
  targetCountry: string;
  targetDevice: string;
  clientId: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}) {
  try {
    const docRef = doc(firestore, PROJECTS_COL, String(project.id));
    const data: FirebaseProject = {
      id: project.id,
      name: project.name,
      domain: project.domain,
      targetCountry: project.targetCountry,
      targetDevice: project.targetDevice,
      clientId: project.clientId,
      createdAt: project.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: project.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
    await setDoc(docRef, data, { merge: true });
    console.log(`🔥 [Firebase] Project synced: ${project.name} (ID: ${project.id})`);
  } catch (error) {
    console.error("❌ [Firebase] Failed to sync project:", error);
  }
}

/** Get all projects from Firestore. */
export async function getFirebaseProjects(): Promise<FirebaseProject[]> {
  try {
    const snapshot = await getDocs(collection(firestore, PROJECTS_COL));
    return snapshot.docs.map((d) => d.data() as FirebaseProject);
  } catch (error) {
    console.error("❌ [Firebase] Failed to get projects:", error);
    return [];
  }
}

/** Get a single project from Firestore. */
export async function getFirebaseProject(projectId: number): Promise<FirebaseProject | null> {
  try {
    const docRef = doc(firestore, PROJECTS_COL, String(projectId));
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as FirebaseProject) : null;
  } catch (error) {
    console.error("❌ [Firebase] Failed to get project:", error);
    return null;
  }
}

/** Delete a project and its keywords/rankings from Firestore. */
export async function deleteFirebaseProject(projectId: number) {
  try {
    // Delete project doc
    await deleteDoc(doc(firestore, PROJECTS_COL, String(projectId)));

    // Delete all keywords for this project
    const kwQuery = query(
      collection(firestore, KEYWORDS_COL),
      where("projectId", "==", projectId),
    );
    const kwSnap = await getDocs(kwQuery);
    for (const d of kwSnap.docs) {
      await deleteDoc(d.ref);
    }

    // Delete all rankings for this project
    const rkQuery = query(
      collection(firestore, RANKINGS_COL),
      where("projectId", "==", projectId),
    );
    const rkSnap = await getDocs(rkQuery);
    for (const d of rkSnap.docs) {
      await deleteDoc(d.ref);
    }

    // Delete all competitors for this project
    const compQuery = query(
      collection(firestore, COMPETITORS_COL),
      where("projectId", "==", projectId),
    );
    const compSnap = await getDocs(compQuery);
    for (const d of compSnap.docs) {
      await deleteDoc(d.ref);
    }

    console.log(`🔥 [Firebase] Project deleted: ${projectId}`);
  } catch (error) {
    console.error("❌ [Firebase] Failed to delete project:", error);
  }
}

// ─── Keywords ─────────────────────────────────────────────────────────────

/** Save or update a keyword in Firestore. */
export async function syncKeywordToFirebase(keyword: {
  id: number;
  projectId: number;
  keyword: string;
  searchVolume?: number | null;
  difficulty?: number | null;
  cpc?: number | null;
  intent?: string | null;
  targetUrl?: string | null;
  tags?: string | null;
  country?: string;
  createdAt?: Date | null;
}) {
  try {
    const docId = `${keyword.projectId}_${keyword.id}`;
    const docRef = doc(firestore, KEYWORDS_COL, docId);
    const data: FirebaseKeyword = {
      id: keyword.id,
      projectId: keyword.projectId,
      keyword: keyword.keyword,
      searchVolume: keyword.searchVolume ?? null,
      difficulty: keyword.difficulty ?? null,
      cpc: keyword.cpc ?? null,
      intent: keyword.intent ?? null,
      targetUrl: keyword.targetUrl ?? null,
      tags: keyword.tags ?? null,
      country: keyword.country ?? "US",
      createdAt: keyword.createdAt?.toISOString() ?? new Date().toISOString(),
    };
    await setDoc(docRef, data, { merge: true });
    console.log(`🔥 [Firebase] Keyword synced: "${keyword.keyword}" (Project: ${keyword.projectId})`);
  } catch (error) {
    console.error("❌ [Firebase] Failed to sync keyword:", error);
  }
}

/** Get all keywords for a project from Firestore. */
export async function getFirebaseKeywords(projectId: number): Promise<FirebaseKeyword[]> {
  try {
    const q = query(
      collection(firestore, KEYWORDS_COL),
      where("projectId", "==", projectId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as FirebaseKeyword);
  } catch (error) {
    console.error("❌ [Firebase] Failed to get keywords:", error);
    return [];
  }
}

/** Delete a keyword from Firestore. */
export async function deleteFirebaseKeyword(projectId: number, keywordId: number) {
  try {
    const docId = `${projectId}_${keywordId}`;
    await deleteDoc(doc(firestore, KEYWORDS_COL, docId));
    console.log(`🔥 [Firebase] Keyword deleted: ${docId}`);
  } catch (error) {
    console.error("❌ [Firebase] Failed to delete keyword:", error);
  }
}

// ─── Rankings ─────────────────────────────────────────────────────────────

/** Save a ranking result to Firestore. */
export async function saveRankingToFirebase(ranking: {
  keywordId: number;
  projectId: number;
  keyword: string;
  date: string;
  position: number | null;
  url: string | null;
  device: string | null;
  country: string | null;
  source: string;
}) {
  try {
    const docId = `${ranking.projectId}_${ranking.keywordId}_${ranking.date}_${ranking.device ?? "any"}_${ranking.country ?? "any"}`;
    const docRef = doc(firestore, RANKINGS_COL, docId);
    const data: FirebaseRanking = {
      ...ranking,
      checkedAt: new Date().toISOString(),
    };
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error("❌ [Firebase] Failed to save ranking:", error);
  }
}

/** Get all rankings for a project from Firestore. */
export async function getFirebaseRankings(projectId: number): Promise<FirebaseRanking[]> {
  try {
    const q = query(
      collection(firestore, RANKINGS_COL),
      where("projectId", "==", projectId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as FirebaseRanking);
  } catch (error) {
    console.error("❌ [Firebase] Failed to get rankings:", error);
    return [];
  }
}

/** Get rankings for a specific keyword from Firestore. */
export async function getFirebaseKeywordRankings(
  projectId: number,
  keywordId: number,
): Promise<FirebaseRanking[]> {
  try {
    const q = query(
      collection(firestore, RANKINGS_COL),
      where("projectId", "==", projectId),
      where("keywordId", "==", keywordId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as FirebaseRanking);
  } catch (error) {
    console.error("❌ [Firebase] Failed to get keyword rankings:", error);
    return [];
  }
}

// ─── Competitors ──────────────────────────────────────────────────────────

/** Save or update a competitor in Firestore. */
export async function syncCompetitorToFirebase(competitor: {
  id: number;
  projectId: number;
  domain: string;
  name?: string | null;
  createdAt?: Date | string | null;
}) {
  try {
    const docId = `${competitor.projectId}_${competitor.id}`;
    const docRef = doc(firestore, COMPETITORS_COL, docId);
    const data: FirebaseCompetitor = {
      id: competitor.id,
      projectId: competitor.projectId,
      domain: competitor.domain,
      name: competitor.name ?? null,
      createdAt:
        competitor.createdAt instanceof Date
          ? competitor.createdAt.toISOString()
          : typeof competitor.createdAt === "string"
          ? competitor.createdAt
          : new Date().toISOString(),
    };
    await setDoc(docRef, data, { merge: true });
    console.log(
      `🔥 [Firebase] Competitor synced: ${competitor.domain} (Project: ${competitor.projectId})`,
    );
  } catch (error) {
    console.error("❌ [Firebase] Failed to sync competitor:", error);
  }
}

/** Get all competitors for a project from Firestore. */
export async function getFirebaseCompetitors(
  projectId?: number,
): Promise<FirebaseCompetitor[]> {
  try {
    const q = projectId
      ? query(
          collection(firestore, COMPETITORS_COL),
          where("projectId", "==", projectId),
        )
      : collection(firestore, COMPETITORS_COL);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as FirebaseCompetitor);
  } catch (error) {
    console.error("❌ [Firebase] Failed to get competitors:", error);
    return [];
  }
}

/** Delete a competitor from Firestore. */
export async function deleteFirebaseCompetitor(
  projectId: number,
  competitorId: number,
) {
  try {
    const docId = `${projectId}_${competitorId}`;
    await deleteDoc(doc(firestore, COMPETITORS_COL, docId));
    console.log(`🔥 [Firebase] Competitor deleted: ${docId}`);
  } catch (error) {
    console.error("❌ [Firebase] Failed to delete competitor:", error);
  }
}

// ─── Bulk sync (for initial setup) ────────────────────────────────────────

/** Sync all projects and keywords from SQLite to Firestore. */
export async function syncAllToFirebase() {
  // Dynamic import to avoid circular dependencies
  const { db } = await import("@/db");
  const { projects: projectsTable, keywords: keywordsTable } = await import("@/db/schema");

  console.log("🔥 [Firebase] Starting full sync to Firestore...");

  const allProjects = await db.select().from(projectsTable);
  for (const project of allProjects) {
    await syncProjectToFirebase(project);

    const projectKeywords = await db
      .select()
      .from(keywordsTable)
      .where((await import("drizzle-orm")).eq(keywordsTable.projectId, project.id));

    for (const kw of projectKeywords) {
      await syncKeywordToFirebase(kw);
    }
  }

  console.log(
    `🔥 [Firebase] Full sync complete: ${allProjects.length} projects synced to Firestore.`,
  );
}

// ─── Fetch from Firebase (Cloud to Local Sync) ────────────────────────────

/**
 * Fetch all projects from Firebase Firestore and sync them into the local SQLite database.
 * If a project exists in Firebase but not in local SQLite, it gets inserted.
 */
export async function syncProjectsFromFirebase(): Promise<number> {
  try {
    const { db } = await import("@/db");
    const { projects: projectsTable, clients: clientsTable } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const fbProjects = await getFirebaseProjects();
    if (!fbProjects || fbProjects.length === 0) return 0;

    // Ensure at least one client exists for foreign key constraint
    const [existingClient] = await db.select({ id: clientsTable.id }).from(clientsTable).limit(1);
    let fallbackClientId = existingClient?.id;
    if (!fallbackClientId) {
      const [newClient] = await db
        .insert(clientsTable)
        .values({ name: "Primary Organization", status: "active" })
        .returning({ id: clientsTable.id });
      fallbackClientId = newClient.id;
    }

    let syncedCount = 0;
    for (const p of fbProjects) {
      // Ensure clientId is valid in clients table
      let validClientId = p.clientId;
      if (validClientId) {
        const [clientExists] = await db
          .select({ id: clientsTable.id })
          .from(clientsTable)
          .where(eq(clientsTable.id, validClientId))
          .limit(1);
        if (!clientExists) {
          validClientId = fallbackClientId;
        }
      } else {
        validClientId = fallbackClientId;
      }

      const existing = await db
        .select({ id: projectsTable.id })
        .from(projectsTable)
        .where(eq(projectsTable.id, p.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(projectsTable).values({
          id: p.id,
          clientId: validClientId,
          name: p.name,
          domain: p.domain,
          targetCountry: p.targetCountry || "US",
          targetDevice: (p.targetDevice as "mobile" | "desktop" | "both") || "desktop",
          crawlDepth: 3,
          crawlLimit: 500,
          crawlConcurrency: 4,
          respectRobots: true,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        });
        syncedCount++;
        console.log(`📥 [Firebase] Synced project into local DB: "${p.name}" (ID: ${p.id})`);
      } else {
        await db
          .update(projectsTable)
          .set({
            name: p.name,
            domain: p.domain,
            targetCountry: p.targetCountry || "US",
            targetDevice: (p.targetDevice as "mobile" | "desktop" | "both") || "desktop",
            updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
          })
          .where(eq(projectsTable.id, p.id));
      }
    }

    return syncedCount;
  } catch (error) {
    console.error("❌ [Firebase] Failed to fetch/sync projects from Firebase:", error);
    return 0;
  }
}

/**
 * Fetch keywords and rankings from Firebase and sync them into the local SQLite database.
 */
export async function syncKeywordsAndRankingsFromFirebase(projectId?: number) {
  try {
    const { db } = await import("@/db");
    const {
      keywords: keywordsTable,
      keywordRankings: rankingsTable,
      projects: projectsTable,
    } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");

    // 1. Sync keywords
    const fbKeywords = projectId
      ? await getFirebaseKeywords(projectId)
      : (await getDocs(collection(firestore, KEYWORDS_COL))).docs.map(
          (d) => d.data() as FirebaseKeyword,
        );

    for (const kw of fbKeywords) {
      // Ensure the project exists in local SQLite before attempting to insert keywords
      const [projExists] = await db
        .select({ id: projectsTable.id })
        .from(projectsTable)
        .where(eq(projectsTable.id, kw.projectId))
        .limit(1);

      if (!projExists) {
        continue;
      }

      const [existing] = await db
        .select({ id: keywordsTable.id })
        .from(keywordsTable)
        .where(
          and(
            eq(keywordsTable.projectId, kw.projectId),
            eq(keywordsTable.keyword, kw.keyword),
          ),
        )
        .limit(1);

      if (!existing) {
        try {
          await db.insert(keywordsTable).values({
            id: kw.id,
            projectId: kw.projectId,
            keyword: kw.keyword,
            searchVolume: kw.searchVolume ?? null,
            difficulty: kw.difficulty ?? null,
            cpc: kw.cpc ?? null,
            intent: kw.intent ?? null,
            targetUrl: kw.targetUrl ?? null,
            tags: kw.tags ?? null,
            country: kw.country || "US",
            createdAt: kw.createdAt ? new Date(kw.createdAt) : new Date(),
          });
          console.log(`📥 [Firebase] Synced keyword into local DB: "${kw.keyword}"`);
        } catch (insertErr) {
          console.warn(`⚠️ [Firebase] Could not insert keyword "${kw.keyword}":`, insertErr);
        }
      }
    }

    // 2. Sync rankings
    const fbRankings = projectId
      ? await getFirebaseRankings(projectId)
      : (await getDocs(collection(firestore, RANKINGS_COL))).docs.map(
          (d) => d.data() as FirebaseRanking,
        );

    for (const rk of fbRankings) {
      const checkDateStr = rk.date; // YYYY-MM-DD
      const dev = (rk.device || "desktop") as "mobile" | "desktop";
      const ctry = rk.country || "US";

      // Verify that the keyword exists in local SQLite to satisfy the foreign key constraint
      let targetKeywordId = rk.keywordId;
      const [kwById] = await db
        .select({ id: keywordsTable.id })
        .from(keywordsTable)
        .where(eq(keywordsTable.id, targetKeywordId))
        .limit(1);

      if (!kwById) {
        // Keyword with this ID doesn't exist. Check if we can find it by project & keyword text
        if (rk.projectId && rk.keyword) {
          const [kwByName] = await db
            .select({ id: keywordsTable.id })
            .from(keywordsTable)
            .where(
              and(
                eq(keywordsTable.projectId, rk.projectId),
                eq(keywordsTable.keyword, rk.keyword),
              ),
            )
            .limit(1);

          if (kwByName) {
            targetKeywordId = kwByName.id;
          } else {
            // Keyword does not exist in local DB. Check if project exists so we can auto-create the keyword
            const [projExists] = await db
              .select({ id: projectsTable.id })
              .from(projectsTable)
              .where(eq(projectsTable.id, rk.projectId))
              .limit(1);

            if (projExists) {
              try {
                const [newKw] = await db
                  .insert(keywordsTable)
                  .values({
                    id: rk.keywordId,
                    projectId: rk.projectId,
                    keyword: rk.keyword,
                    country: ctry,
                  })
                  .returning({ id: keywordsTable.id });
                targetKeywordId = newKw.id;
              } catch {
                continue;
              }
            } else {
              // Project doesn't exist locally; this is an orphaned ranking from an old/deleted project
              continue;
            }
          }
        } else {
          // Orphaned ranking without keyword record
          continue;
        }
      }

      const existing = await db
        .select({ id: rankingsTable.id })
        .from(rankingsTable)
        .where(
          and(
            eq(rankingsTable.keywordId, targetKeywordId),
            eq(rankingsTable.date, checkDateStr),
            eq(rankingsTable.device, dev),
            eq(rankingsTable.country, ctry),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        try {
          await db.insert(rankingsTable).values({
            keywordId: targetKeywordId,
            date: checkDateStr,
            position: rk.position,
            url: rk.url,
            source: rk.source || "serper",
            device: dev,
            country: ctry,
          });
        } catch (insertErr) {
          console.warn(
            `⚠️ [Firebase] Could not insert ranking row for keyword ${targetKeywordId}:`,
            insertErr,
          );
        }
      }
    }
  } catch (error) {
    console.error("❌ [Firebase] Failed to fetch/sync rankings from Firebase:", error);
  }
}

/**
 * Fetch competitors from Firebase and sync them into the local SQLite database.
 */
export async function syncCompetitorsFromFirebase(projectId?: number) {
  try {
    const { db } = await import("@/db");
    const { competitors: competitorsTable, projects: projectsTable } =
      await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");

    const fbCompetitors = await getFirebaseCompetitors(projectId);
    for (const comp of fbCompetitors) {
      // Ensure the project exists locally before inserting competitor
      const [projExists] = await db
        .select({ id: projectsTable.id })
        .from(projectsTable)
        .where(eq(projectsTable.id, comp.projectId))
        .limit(1);

      if (!projExists) continue;

      const [existing] = await db
        .select({ id: competitorsTable.id })
        .from(competitorsTable)
        .where(
          and(
            eq(competitorsTable.projectId, comp.projectId),
            eq(competitorsTable.domain, comp.domain),
          ),
        )
        .limit(1);

      if (!existing) {
        try {
          await db.insert(competitorsTable).values({
            id: comp.id,
            projectId: comp.projectId,
            domain: comp.domain,
            name: comp.name || comp.domain,
            createdAt: comp.createdAt ? new Date(comp.createdAt) : new Date(),
          });
          console.log(
            `📥 [Firebase] Synced competitor into local DB: "${comp.domain}"`,
          );
        } catch (insertErr) {
          console.warn(
            `⚠️ [Firebase] Could not insert competitor "${comp.domain}":`,
            insertErr,
          );
        }
      }
    }
  } catch (error) {
    console.error("❌ [Firebase] Failed to fetch/sync competitors from Firebase:", error);
  }
}

export type FirebaseCrawlPage = {
  id: number;
  projectId: number;
  crawlId: number;
  url: string;
  path: string;
  statusCode: number | null;
  title: string | null;
  wordCount: number | null;
  internalLinks: number;
  externalLinks: number;
  depth: number;
  createdAt: string;
};

const CRAWL_PAGES_COL = "seo_crawl_pages";

/** Sync crawled page to Firestore */
export async function syncCrawlPageToFirebase(page: {
  id: number;
  projectId: number;
  crawlId: number;
  url: string;
  path: string;
  statusCode: number | null;
  title: string | null;
  wordCount: number | null;
  internalLinks: number;
  externalLinks: number;
  depth: number;
}) {
  try {
    const docId = `${page.projectId}_${page.id}`;
    const docRef = doc(firestore, CRAWL_PAGES_COL, docId);
    const data: FirebaseCrawlPage = {
      ...page,
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error("❌ [Firebase] Failed to sync crawl page:", error);
  }
}

/**
 * Complete pull from Firebase into local DB: projects, keywords, rankings, and competitors.
 */
export async function syncFromFirebase(projectId?: number) {
  await syncProjectsFromFirebase();
  if (projectId) {
    await syncKeywordsAndRankingsFromFirebase(projectId);
    await syncCompetitorsFromFirebase(projectId);
  } else {
    // Only sync keywords, rankings & competitors for existing projects to prevent orphan foreign-key failures
    const { db } = await import("@/db");
    const { projects: projectsTable } = await import("@/db/schema");
    const localProjects = await db
      .select({ id: projectsTable.id })
      .from(projectsTable);
    for (const p of localProjects) {
      await syncKeywordsAndRankingsFromFirebase(p.id);
      await syncCompetitorsFromFirebase(p.id);
    }
  }
}




