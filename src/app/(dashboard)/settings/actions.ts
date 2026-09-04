"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { fetchPsiAudit } from "@/lib/psi";

export async function saveSettingAction(key: string, value: string) {
  if (!key.trim()) return;

  const [existing] = await db
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, key.trim()))
    .limit(1);

  if (existing) {
    await db
      .update(settings)
      .set({ value: value.trim() })
      .where(eq(settings.key, key.trim()));
  } else {
    await db.insert(settings).values({
      key: key.trim(),
      value: value.trim(),
    });
  }

  revalidatePath("/settings");
}

export async function testPsiKeyAction(apiKey: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const testUrl = "https://example.com";
    const endpoint = new URL(
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
    );
    endpoint.searchParams.set("url", testUrl);
    endpoint.searchParams.set("strategy", "mobile");
    if (apiKey.trim()) {
      endpoint.searchParams.set("key", apiKey.trim());
    }

    const response = await fetch(endpoint.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      console.error(`❌ PSI Key validation failed (${response.status}):`, err);
      return {
        success: false,
        message: `API request returned status ${response.status}: ${response.statusText}`,
      };
    }

    return {
      success: true,
      message: "Successfully connected to Google PageSpeed Insights API!",
    };
  } catch (err) {
    console.error("❌ PSI test connection failed:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
