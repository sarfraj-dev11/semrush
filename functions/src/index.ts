import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

/**
 * Firebase Cloud Functions for SEO Rank Tracking.
 *
 * Scheduled function runs daily at 6:00 PM IST (12:30 PM UTC) to check
 * Google rankings for all tracked keywords across all projects.
 *
 * Data flow:
 *   Firestore (seo_projects, seo_keywords) → Serper API → Firestore (seo_rankings)
 *
 * The local Next.js app syncs project/keyword data to Firestore whenever
 * they're created/updated, so this function always has up-to-date data.
 */

admin.initializeApp();
const db = admin.firestore();

// Secrets (set via: firebase functions:secrets:set SERPER_API_KEY)
const serperApiKey = defineSecret("SERPER_API_KEY");

// ─── Serper API ───────────────────────────────────────────────────────────

interface SerperOrganic {
  position?: number;
  link?: string;
  title?: string;
  snippet?: string;
}

interface SerperResponse {
  organic?: SerperOrganic[];
  message?: string;
}

async function searchGoogle(
  keyword: string,
  country: string,
  apiKey: string,
): Promise<SerperResponse> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: keyword,
      gl: country.toLowerCase(),
      hl: "en",
      num: 100,
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper API returned ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<SerperResponse>;
}

// ─── Domain matching ──────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function findDomainPosition(
  results: SerperOrganic[],
  domain: string,
): { position: number; url: string } | null {
  const targetHost = extractDomain(domain);

  for (const result of results) {
    if (!result.link) continue;
    const resultHost = extractDomain(result.link);
    if (resultHost === targetHost || resultHost.endsWith(`.${targetHost}`)) {
      return {
        position: result.position ?? 0,
        url: result.link,
      };
    }
  }
  return null;
}

// ─── Scheduled Function: Daily Rank Tracking ──────────────────────────────

/**
 * Runs every day at 12:30 UTC = 6:00 PM IST.
 * Checks Google rankings for all keywords in all projects.
 */
export const dailyRankTracking = onSchedule(
  {
    schedule: "30 12 * * *", // 12:30 UTC = 6:00 PM IST
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540, // 9 minutes max
    memory: "512MiB",
    secrets: [serperApiKey],
  },
  async () => {
    const apiKey = serperApiKey.value();
    if (!apiKey) {
      console.error("❌ SERPER_API_KEY not configured. Set it with: firebase functions:secrets:set SERPER_API_KEY");
      return;
    }

    console.log("⏰ [Cron] Daily rank tracking started at", new Date().toISOString());

    // Get all projects from Firestore
    const projectsSnap = await db.collection("seo_projects").get();
    if (projectsSnap.empty) {
      console.log("⏰ [Cron] No projects found in Firestore.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    let totalChecked = 0;
    let totalRanked = 0;
    let totalFailed = 0;

    for (const projectDoc of projectsSnap.docs) {
      const project = projectDoc.data();
      console.log(`\n📊 Tracking project: ${project.name} (${project.domain})`);

      // Get keywords for this project
      const keywordsSnap = await db
        .collection("seo_keywords")
        .where("projectId", "==", project.id)
        .get();

      if (keywordsSnap.empty) {
        console.log(`  ⚠️ No keywords for project ${project.name}`);
        continue;
      }

      // Resolve countries and devices
      const countries = (project.targetCountry || "US")
        .split(",")
        .map((c: string) => c.trim().toUpperCase())
        .filter(Boolean);

      const devices: string[] =
        project.targetDevice === "both"
          ? ["desktop"] // Serper is desktop-only
          : [project.targetDevice || "desktop"];

      console.log(
        `  📍 ${keywordsSnap.size} keywords × ${countries.length} countries × ${devices.length} devices`,
      );

      for (const country of countries) {
        for (const device of devices) {
          for (const keywordDoc of keywordsSnap.docs) {
            const kw = keywordDoc.data();

            try {
              // Call Serper API
              const result = await searchGoogle(kw.keyword, country, apiKey);

              if (result.message && !result.organic) {
                console.error(`  ❌ Serper error for "${kw.keyword}": ${result.message}`);
                totalFailed++;
                continue;
              }

              // Find our domain in results
              const match = findDomainPosition(result.organic || [], project.domain);

              // Save ranking to Firestore
              const rankingId = `${project.id}_${kw.id}_${today}_${device}_${country}`;
              await db.collection("seo_rankings").doc(rankingId).set(
                {
                  keywordId: kw.id,
                  projectId: project.id,
                  keyword: kw.keyword,
                  date: today,
                  position: match?.position ?? null,
                  url: match?.url ?? null,
                  device,
                  country,
                  source: "serper",
                  checkedAt: new Date().toISOString(),
                },
                { merge: true },
              );

              totalChecked++;
              if (match) {
                totalRanked++;
                console.log(
                  `  ✅ "${kw.keyword}" [${device}/${country}] → Position #${match.position}`,
                );
              } else {
                console.log(`  ⬜ "${kw.keyword}" [${device}/${country}] → Not in Top 100`);
              }

              // Rate limiting: 1 second between requests
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (error) {
              totalFailed++;
              console.error(
                `  ❌ Failed "${kw.keyword}" [${device}/${country}]:`,
                error instanceof Error ? error.message : error,
              );
            }
          }
        }
      }
    }

    console.log(
      `\n⏰ [Cron] Daily tracking complete: ${totalChecked} checked, ` +
        `${totalRanked} ranking, ${totalFailed} failed`,
    );
  },
);

/**
 * HTTP endpoint to manually trigger rank tracking.
 * Call: https://[region]-[project-id].cloudfunctions.net/manualRankCheck
 */
export const manualRankCheck = onRequest(
  {
    timeoutSeconds: 540,
    memory: "512MiB",
    secrets: [serperApiKey],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "POST only" });
      return;
    }

    // Simple auth check
    const authKey = req.headers["x-api-key"];
    const expectedKey = process.env.FUNCTIONS_AUTH_KEY;
    if (expectedKey && authKey !== expectedKey) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const apiKey = serperApiKey.value();
    if (!apiKey) {
      res.status(500).json({ error: "SERPER_API_KEY not configured" });
      return;
    }

    console.log("🔄 Manual rank check triggered");

    // Get all projects
    const projectsSnap = await db.collection("seo_projects").get();
    const today = new Date().toISOString().slice(0, 10);
    let totalChecked = 0;
    let totalRanked = 0;

    for (const projectDoc of projectsSnap.docs) {
      const project = projectDoc.data();
      const keywordsSnap = await db
        .collection("seo_keywords")
        .where("projectId", "==", project.id)
        .get();

      if (keywordsSnap.empty) continue;

      const countries = (project.targetCountry || "US")
        .split(",")
        .map((c: string) => c.trim().toUpperCase())
        .filter(Boolean);

      for (const country of countries) {
        for (const keywordDoc of keywordsSnap.docs) {
          const kw = keywordDoc.data();
          try {
            const result = await searchGoogle(kw.keyword, country, apiKey);
            const match = findDomainPosition(result.organic || [], project.domain);

            const rankingId = `${project.id}_${kw.id}_${today}_desktop_${country}`;
            await db.collection("seo_rankings").doc(rankingId).set(
              {
                keywordId: kw.id,
                projectId: project.id,
                keyword: kw.keyword,
                date: today,
                position: match?.position ?? null,
                url: match?.url ?? null,
                device: "desktop",
                country,
                source: "serper",
                checkedAt: new Date().toISOString(),
              },
              { merge: true },
            );

            totalChecked++;
            if (match) totalRanked++;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Failed "${kw.keyword}":`, error);
          }
        }
      }
    }

    res.json({
      success: true,
      totalChecked,
      totalRanked,
      date: today,
    });
  },
);
