import { NextResponse } from "next/server";
import { syncAllToFirebase } from "@/lib/firebase-tracking";

/**
 * POST /api/firebase-sync
 *
 * Bulk-syncs all existing projects and keywords from SQLite to Firestore.
 * Run this once after initial setup to populate Firebase with existing data.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    console.log("🔥 [Firebase Sync] Starting bulk sync...");
    await syncAllToFirebase();
    return NextResponse.json({ success: true, message: "All projects and keywords synced to Firebase." });
  } catch (error) {
    console.error("❌ [Firebase Sync] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
