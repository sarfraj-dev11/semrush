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

// ─── Projects ─────────────────────────────────────────────────────────────

const PROJECTS_COL = "seo_projects";
const KEYWORDS_COL = "seo_keywords";
const RANKINGS_COL = "seo_rankings";

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
