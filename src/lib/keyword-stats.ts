/**
 * Keyword and ranking summaries.
 *
 * Pure: everything is derived from rows already read from the database, so the
 * bucketing rules are testable without a fixture database.
 *
 * The distinction this file exists to protect: a keyword with no ranking row is
 * *unchecked*, and a keyword with a null position is *checked and not ranking*.
 * Collapsing those two is how a rank tracker starts reporting losses that never
 * happened.
 */

export type RankBucketId = "top3" | "4-10" | "11-20" | "21-50" | "51-100";

export const RANK_BUCKETS: { id: RankBucketId; label: string; max: number }[] = [
  { id: "top3", label: "Top 3", max: 3 },
  { id: "4-10", label: "4–10", max: 10 },
  { id: "11-20", label: "11–20", max: 20 },
  { id: "21-50", label: "21–50", max: 50 },
  { id: "51-100", label: "51–100", max: 100 },
];

/** Null for "not ranking in the tracked range", which is not a bucket. */
export function bucketFor(position: number | null): RankBucketId | null {
  if (position === null || position < 1) return null;
  for (const bucket of RANK_BUCKETS) {
    if (position <= bucket.max) return bucket.id;
  }
  return null;
}

export type KeywordRow = {
  id: number;
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  intent: string | null;
  targetUrl: string | null;
  /** Latest recorded position; null means checked but not ranking. */
  position: number | null;
  /** Position at the previous check, for the movement column. */
  previousPosition: number | null;
  url: string | null;
  /** Date of the latest check; null means never checked. */
  date: string | null;
  /** Device used for this ranking check; null for legacy/imported rows. */
  device: string | null;
  /** Country code used for this ranking check; null for legacy/imported rows. */
  country: string | null;
};

export type KeywordSummary = {
  total: number;
  /** Keywords with a recorded position. */
  ranking: number;
  /** Checked, but outside the tracked range. */
  notRanking: number;
  /** Never checked — no ranking row at all. */
  unchecked: number;
  top3: number;
  top10: number;
  top20: number;
  /** Mean position across ranking keywords only; null when none rank. */
  averagePosition: number | null;
  /** Combined monthly search volume where it is known. */
  totalVolume: number | null;
  improved: number;
  declined: number;
};

export function summarizeKeywords(rows: KeywordRow[]): KeywordSummary {
  const summary: KeywordSummary = {
    total: rows.length,
    ranking: 0,
    notRanking: 0,
    unchecked: 0,
    top3: 0,
    top10: 0,
    top20: 0,
    averagePosition: null,
    totalVolume: null,
    improved: 0,
    declined: 0,
  };

  let positionSum = 0;
  let volumeSum = 0;
  let volumeKnown = 0;

  for (const row of rows) {
    if (row.searchVolume !== null) {
      volumeSum += row.searchVolume;
      volumeKnown++;
    }

    if (row.date === null) {
      summary.unchecked++;
    } else if (row.position === null) {
      summary.notRanking++;
    } else {
      summary.ranking++;
      positionSum += row.position;
      if (row.position <= 3) summary.top3++;
      if (row.position <= 10) summary.top10++;
      if (row.position <= 20) summary.top20++;
    }

    // A keyword entering or leaving the tracked range counts as movement; one
    // that was never checked does not.
    if (row.previousPosition !== null && row.position !== null) {
      if (row.position < row.previousPosition) summary.improved++;
      if (row.position > row.previousPosition) summary.declined++;
    } else if (row.previousPosition === null && row.position !== null && row.date) {
      summary.improved++;
    } else if (row.previousPosition !== null && row.position === null) {
      summary.declined++;
    }
  }

  if (summary.ranking > 0) {
    summary.averagePosition =
      Math.round((positionSum / summary.ranking) * 10) / 10;
  }
  if (volumeKnown > 0) summary.totalVolume = volumeSum;

  return summary;
}

export type RankingPoint = {
  date: string;
  position: number | null;
};

export type DistributionPoint = {
  date: string;
  counts: Record<RankBucketId, number>;
  /** Checked on this date but outside the range. */
  notRanking: number;
  total: number;
};

/**
 * Bucket counts per date, oldest first — the shape a stacked trend needs.
 */
export function distributionByDate(points: RankingPoint[]): DistributionPoint[] {
  const byDate = new Map<string, DistributionPoint>();

  for (const point of points) {
    let entry = byDate.get(point.date);
    if (!entry) {
      entry = {
        date: point.date,
        counts: { top3: 0, "4-10": 0, "11-20": 0, "21-50": 0, "51-100": 0 },
        notRanking: 0,
        total: 0,
      };
      byDate.set(point.date, entry);
    }

    entry.total++;
    const bucket = bucketFor(point.position);
    if (bucket) entry.counts[bucket]++;
    else entry.notRanking++;
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Intent counts, largest first. Keywords with no intent are grouped as unknown. */
export function intentBreakdown(
  rows: KeywordRow[],
): { intent: string; count: number; share: number }[] {
  if (rows.length === 0) return [];

  const counts = new Map<string, number>();
  for (const row of rows) {
    const intent = row.intent?.trim() || "Unknown";
    counts.set(intent, (counts.get(intent) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([intent, count]) => ({
      intent,
      count,
      share: Math.round((count / rows.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}
