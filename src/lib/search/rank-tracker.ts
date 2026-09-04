import { eq } from "drizzle-orm";
import { db } from "@/db";
import { keywordRankings, keywords, type Project } from "@/db/schema";
import { getSearchProvider } from "./registry";
import {
  findDomainPosition,
  InvalidCredentialsError,
  NoSearchProviderError,
  QuotaExhaustedError,
  RateLimitedError,
  type SearchDevice,
  type SearchProvider,
} from "./types";

/**
 * Rank tracking.
 *
 * Runs a project's keywords through the configured search provider and records
 * where the project's domain appears. Writes into keyword_rankings with the
 * provider id as `source`, alongside the CSV-imported rows that are there now —
 * so imported and tracked history sit on the same timeline and the charts do
 * not need to know the difference.
 *
 * Supports multi-country and multi-device tracking:
 * - When `targetCountry` is comma-separated (e.g. "US,IN"), each country is
 *   tracked independently with its own ranking rows.
 * - When `targetDevice` is "both", keywords are checked for both "mobile" and
 *   "desktop" separately (if the provider supports device targeting).
 * - Uses the crawler's proxy pool for country-targeted requests and identity
 *   profiles for device-appropriate user agents.
 */

export type TrackHooks = {
  report?: (done: number, total: number, keyword: string) => Promise<void>;
  log?: (line: string) => Promise<void>;
  isCancelled?: () => Promise<boolean>;
};

export type TrackResult = {
  provider: string;
  checked: number;
  ranked: number;
  notRanking: number;
  failed: number;
  /** True when the run stopped because the provider's allowance ran out. */
  quotaExhausted: boolean;
  /** Keywords never attempted because the run stopped early. */
  remaining: number;
  /** Per-device and per-country breakdown. */
  breakdown: {
    device: SearchDevice;
    country: string;
    checked: number;
    ranked: number;
    notRanking: number;
    failed: number;
  }[];
};

/** YYYY-MM-DD, matching the unique index on (keywordId, date, device, country). */
function isoDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Resolves the list of devices to track based on project settings and provider
 * capabilities. When the provider cannot target a device, we degrade to desktop
 * only rather than silently mislabelling results.
 */
function resolveDevices(
  project: Project,
  provider: SearchProvider,
): SearchDevice[] {
  if (project.targetDevice === "both") {
    // If the provider supports device targeting, track both; otherwise desktop only.
    if (provider.supportsDevice === false) {
      return ["desktop"];
    }
    return ["mobile", "desktop"];
  }
  const device = project.targetDevice as SearchDevice;
  // If the provider can't target mobile, degrade to desktop.
  if (device === "mobile" && provider.supportsDevice === false) {
    return ["desktop"];
  }
  return [device];
}

/**
 * Resolves the list of countries from the project's comma-separated
 * targetCountry field.
 */
function resolveCountries(project: Project): string[] {
  const raw = project.targetCountry || "US";
  const codes = raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  return codes.length > 0 ? codes : ["US"];
}

export async function trackProjectRankings(
  project: Project,
  hooks: TrackHooks = {},
  options: { provider?: SearchProvider; pauseMs?: number } = {},
): Promise<TrackResult> {
  const provider = options.provider ?? (await getSearchProvider());
  if (!provider) throw new NoSearchProviderError();

  const rows = await db
    .select()
    .from(keywords)
    .where(eq(keywords.projectId, project.id));

  if (rows.length === 0) {
    return {
      provider: provider.id,
      checked: 0,
      ranked: 0,
      notRanking: 0,
      failed: 0,
      quotaExhausted: false,
      remaining: 0,
      breakdown: [],
    };
  }

  const devices = resolveDevices(project, provider);
  const countries = resolveCountries(project);
  const totalCombinations = rows.length * devices.length * countries.length;

  await hooks.log?.(
    `Tracking ${rows.length} keywords via ${provider.label} ` +
      `(${countries.length} ${countries.length === 1 ? "country" : "countries"}: ${countries.join(", ")}, ` +
      `${devices.length} ${devices.length === 1 ? "device" : "devices"}: ${devices.join(", ")}) ` +
      `= ${totalCombinations} total checks`,
  );

  if (provider.supportsDevice === false && project.targetDevice !== "desktop") {
    await hooks.log?.(
      `⚠️ ${provider.label} cannot target mobile — all results are desktop positions.`,
    );
  }

  const today = isoDate(new Date());
  const result: TrackResult = {
    provider: provider.id,
    checked: 0,
    ranked: 0,
    notRanking: 0,
    failed: 0,
    quotaExhausted: false,
    remaining: 0,
    breakdown: [],
  };

  /** Set when the run must stop for every remaining keyword. */
  let fatal: Error | null = null;
  let globalIndex = 0;

  for (const country of countries) {
    if (fatal) break;

    for (const device of devices) {
      if (fatal) break;

      const segmentResult = {
        device,
        country,
        checked: 0,
        ranked: 0,
        notRanking: 0,
        failed: 0,
      };

      await hooks.log?.(
        `── Starting ${device} / ${country} (${rows.length} keywords)`,
      );

      for (const [index, row] of rows.entries()) {
        if (await hooks.isCancelled?.()) break;
        if (fatal) break;

        try {
          const queryCountry =
            row.country || country;

          const query = () =>
            provider.search(row.keyword, {
              country: queryCountry,
              device,
            });

          let response;
          try {
            response = await query();
          } catch (error) {
            if (!(error instanceof RateLimitedError)) throw error;
            await hooks.log?.(`Rate limited on "${row.keyword}", retrying once`);
            await sleep(error.retryAfterMs ?? 5_000);
            response = await query();
          }

          const match = findDomainPosition(response.results, project.domain);

          await db
            .insert(keywordRankings)
            .values({
              keywordId: row.id,
              date: today,
              position: match?.position ?? null,
              url: match?.url ?? null,
              source: provider.id,
              device,
              country: queryCountry,
            })
            .onConflictDoUpdate({
              target: [
                keywordRankings.keywordId,
                keywordRankings.date,
                keywordRankings.device,
                keywordRankings.country,
              ],
              set: {
                position: match?.position ?? null,
                url: match?.url ?? null,
                source: provider.id,
              },
            });

          // Also save to Firebase for serverless access
          try {
            const { saveRankingToFirebase } = await import("@/lib/firebase-tracking");
            await saveRankingToFirebase({
              keywordId: row.id,
              projectId: project.id,
              keyword: row.keyword,
              date: today,
              position: match?.position ?? null,
              url: match?.url ?? null,
              device,
              country: queryCountry,
              source: provider.id,
            });
          } catch {
            // Firebase sync failure should not block rank tracking
          }

          result.checked++;
          segmentResult.checked++;
          if (match) {
            result.ranked++;
            segmentResult.ranked++;
          } else {
            result.notRanking++;
            segmentResult.notRanking++;
          }
        } catch (error) {
          if (
            error instanceof QuotaExhaustedError ||
            error instanceof InvalidCredentialsError
          ) {
            fatal = error;
            result.quotaExhausted = error instanceof QuotaExhaustedError;
            result.remaining = totalCombinations - globalIndex;
            await hooks.log?.(error.message);
            break;
          }

          result.failed++;
          segmentResult.failed++;
          await hooks.log?.(
            `❌ Failed on "${row.keyword}" (${device}/${country}): ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        globalIndex++;
        await hooks.report?.(globalIndex, totalCombinations, row.keyword);

        if (options.pauseMs && index < rows.length - 1) await sleep(options.pauseMs);
      }

      result.breakdown.push(segmentResult);

      await hooks.log?.(
        `── ${device}/${country}: ${segmentResult.checked} checked, ` +
          `${segmentResult.ranked} ranking, ${segmentResult.notRanking} not ranking, ` +
          `${segmentResult.failed} failed`,
      );
    }
  }

  await hooks.log?.(
    `✅ Tracked ${result.checked}/${totalCombinations} checks across ` +
      `${countries.length} countries × ${devices.length} devices: ` +
      `${result.ranked} ranking, ${result.notRanking} outside range, ${result.failed} failed`,
  );

  if (fatal) {
    const saved = `${result.checked} of ${totalCombinations} checks saved`;
    if (fatal instanceof QuotaExhaustedError) {
      throw new QuotaExhaustedError(
        provider.label,
        `${saved}, ${result.remaining} not checked. Top up the plan or switch SEARCH_PROVIDER.`,
        fatal.status,
      );
    }
    throw fatal;
  }

  return result;
}
