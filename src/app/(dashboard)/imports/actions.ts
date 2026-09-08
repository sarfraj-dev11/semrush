"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  backlinks,
  competitors,
  importMappings,
  imports,
  keywordRankings,
  keywords,
} from "@/db/schema";
import {
  parseCsvText,
  validateImportRows,
  type ImportSourceType,
} from "@/lib/importer/csv";

export async function saveMappingAction(
  name: string,
  sourceType: ImportSourceType,
  mapping: Record<string, string>,
) {
  if (!name.trim()) throw new Error("Preset name is required.");

  const [existing] = await db
    .select({ id: importMappings.id })
    .from(importMappings)
    .where(eq(importMappings.name, name.trim()))
    .limit(1);

  if (existing) {
    await db
      .update(importMappings)
      .set({
        sourceType,
        mapping,
      })
      .where(eq(importMappings.id, existing.id));
  } else {
    await db.insert(importMappings).values({
      name: name.trim(),
      sourceType,
      mapping,
    });
  }

  revalidatePath("/imports");
}

export async function executeImportAction(
  projectId: number,
  sourceType: ImportSourceType,
  fileName: string,
  csvContent: string,
  mapping: Record<string, string>,
): Promise<{ success: boolean; imported: number; skipped: number; error?: string }> {
  try {
    const { rows } = parseCsvText(csvContent);
    const validation = validateImportRows(sourceType, rows, mapping);

    let importedCount = 0;
    let skippedCount = validation.invalidCount;

    if (sourceType === "keywords") {
      for (const row of rows) {
        const kw = mapping.keyword ? row[mapping.keyword]?.trim() : "";
        if (!kw) {
          skippedCount++;
          continue;
        }

        const vol = mapping.search_volume
          ? Number(row[mapping.search_volume]?.replace(/[^0-9.-]/g, "")) || null
          : null;
        const diff = mapping.difficulty
          ? Number(row[mapping.difficulty]?.replace(/[^0-9.-]/g, "")) || null
          : null;
        const cpc = mapping.cpc
          ? Number(row[mapping.cpc]?.replace(/[^0-9.-]/g, "")) || null
          : null;
        const intent = mapping.intent ? row[mapping.intent]?.trim() || null : null;
        const targetUrl = mapping.target_url
          ? row[mapping.target_url]?.trim() || null
          : null;
        const tags = mapping.tags ? row[mapping.tags]?.trim() || null : null;

        // Upsert keyword
        const [existing] = await db
          .select({ id: keywords.id })
          .from(keywords)
          .where(and(eq(keywords.projectId, projectId), eq(keywords.keyword, kw)))
          .limit(1);

        let kwId: number;
        if (existing) {
          kwId = existing.id;
          await db
            .update(keywords)
            .set({
              searchVolume: vol,
              difficulty: diff,
              cpc,
              intent,
              targetUrl,
              tags,
            })
            .where(eq(keywords.id, existing.id));
        } else {
          const [inserted] = await db
            .insert(keywords)
            .values({
              projectId,
              keyword: kw,
              searchVolume: vol,
              difficulty: diff,
              cpc,
              intent,
              targetUrl,
              tags,
            })
            .returning({ id: keywords.id });
          kwId = inserted.id;
        }

        // Sync keyword to Firebase for cloud rank tracking
        try {
          const { syncKeywordToFirebase } = await import("@/lib/firebase-tracking");
          await syncKeywordToFirebase({
            id: kwId,
            projectId,
            keyword: kw,
            searchVolume: vol,
            difficulty: diff,
            cpc,
            intent,
            targetUrl,
            tags,
          });
        } catch (fbErr) {
          console.error("❌ Failed to sync imported keyword to Firebase:", fbErr);
        }

        importedCount++;
      }
    } else if (sourceType === "rankings") {
      for (const row of rows) {
        const kwName = mapping.keyword ? row[mapping.keyword]?.trim() : "";
        const posRaw = mapping.position ? row[mapping.position]?.trim() : "";
        const pos = Number(posRaw.replace(/[^0-9]/g, ""));
        const dateRaw = mapping.date ? row[mapping.date]?.trim() : "";
        const date = dateRaw ? dateRaw.split("T")[0] : new Date().toISOString().split("T")[0];
        const rankingUrl = mapping.url ? row[mapping.url]?.trim() || null : null;

        if (!kwName || isNaN(pos)) {
          skippedCount++;
          continue;
        }

        // Find or create keyword
        let [kwRecord] = await db
          .select({ id: keywords.id })
          .from(keywords)
          .where(and(eq(keywords.projectId, projectId), eq(keywords.keyword, kwName)))
          .limit(1);

        if (!kwRecord) {
          const [inserted] = await db
            .insert(keywords)
            .values({
              projectId,
              keyword: kwName,
            })
            .returning({ id: keywords.id });
          kwRecord = inserted;
        }

        // Upsert ranking by (keywordId, date)
        const [existingRank] = await db
          .select({ id: keywordRankings.id })
          .from(keywordRankings)
          .where(
            and(
              eq(keywordRankings.keywordId, kwRecord.id),
              eq(keywordRankings.date, date),
            ),
          )
          .limit(1);

        if (existingRank) {
          await db
            .update(keywordRankings)
            .set({
              position: pos,
              url: rankingUrl,
            })
            .where(eq(keywordRankings.id, existingRank.id));
        } else {
          await db.insert(keywordRankings).values({
            keywordId: kwRecord.id,
            date,
            position: pos,
            url: rankingUrl,
            source: "import",
          });
        }
        importedCount++;
      }
    } else if (sourceType === "backlinks") {
      for (const row of rows) {
        const srcUrl = mapping.source_url ? row[mapping.source_url]?.trim() : "";
        if (!srcUrl) {
          skippedCount++;
          continue;
        }

        const srcDomain = mapping.source_domain
          ? row[mapping.source_domain]?.trim()
          : srcUrl.replace(/^https?:\/\//i, "").split("/")[0];
        const targetUrl = mapping.target_url ? row[mapping.target_url]?.trim() || null : null;
        const anchor = mapping.anchor_text ? row[mapping.anchor_text]?.trim() || null : null;
        const drRaw = mapping.domain_rating ? row[mapping.domain_rating]?.trim() : "";
        const dr = drRaw ? Number(drRaw.replace(/[^0-9.-]/g, "")) || null : null;
        const isFollowVal = mapping.is_follow
          ? !row[mapping.is_follow]?.toLowerCase().includes("no")
          : true;
        const firstSeen = mapping.first_seen ? row[mapping.first_seen]?.trim() || null : null;
        const lastSeen = mapping.last_seen ? row[mapping.last_seen]?.trim() || null : null;
        const statusVal = ((mapping.status && row[mapping.status]?.toLowerCase()) || "active") as
          | "new"
          | "active"
          | "lost";

        const [existingLink] = await db
          .select({ id: backlinks.id })
          .from(backlinks)
          .where(and(eq(backlinks.projectId, projectId), eq(backlinks.sourceUrl, srcUrl)))
          .limit(1);

        if (existingLink) {
          await db
            .update(backlinks)
            .set({
              sourceDomain: srcDomain || "unknown",
              targetUrl,
              anchorText: anchor,
              domainRating: dr,
              isFollow: isFollowVal,
              firstSeen,
              lastSeen,
              status: ["new", "active", "lost"].includes(statusVal) ? statusVal : "active",
            })
            .where(eq(backlinks.id, existingLink.id));
        } else {
          await db.insert(backlinks).values({
            projectId,
            sourceUrl: srcUrl,
            sourceDomain: srcDomain || "unknown",
            targetUrl,
            anchorText: anchor,
            domainRating: dr,
            isFollow: isFollowVal,
            firstSeen,
            lastSeen,
            status: ["new", "active", "lost"].includes(statusVal) ? statusVal : "active",
          });
        }
        importedCount++;
      }
    } else if (sourceType === "competitors") {
      for (const row of rows) {
        const domRaw = mapping.domain ? row[mapping.domain]?.trim() : "";
        if (!domRaw) {
          skippedCount++;
          continue;
        }
        const dom = domRaw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
        const name = mapping.name ? row[mapping.name]?.trim() || null : null;

        const [existingComp] = await db
          .select({ id: competitors.id })
          .from(competitors)
          .where(and(eq(competitors.projectId, projectId), eq(competitors.domain, dom)))
          .limit(1);

        if (existingComp) {
          await db
            .update(competitors)
            .set({ name: name || dom })
            .where(eq(competitors.id, existingComp.id));
        } else {
          await db.insert(competitors).values({
            projectId,
            domain: dom,
            name: name || dom,
          });
        }
        importedCount++;
      }
    }

    // Record import
    await db.insert(imports).values({
      projectId,
      sourceType,
      fileName,
      mapping,
      rowsTotal: rows.length,
      rowsImported: importedCount,
      rowsSkipped: skippedCount,
      status: "completed",
    });

    revalidatePath("/imports");
    revalidatePath(`/projects/${projectId}/keywords`);
    revalidatePath(`/projects/${projectId}/rankings`);
    revalidatePath(`/projects/${projectId}/backlinks`);
    revalidatePath(`/projects/${projectId}/competitors`);

    return { success: true, imported: importedCount, skipped: skippedCount };
  } catch (err) {
    console.error("❌ CSV import execution failed:", err);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
