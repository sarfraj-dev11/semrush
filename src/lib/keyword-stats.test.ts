import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bucketFor,
  distributionByDate,
  intentBreakdown,
  summarizeKeywords,
  type KeywordRow,
} from "./keyword-stats";

const row = (over: Partial<KeywordRow> = {}): KeywordRow => ({
  id: 1,
  keyword: "widgets",
  searchVolume: null,
  difficulty: null,
  intent: null,
  targetUrl: null,
  position: null,
  previousPosition: null,
  url: null,
  date: null,
  device: null,
  country: null,
  ...over,
});

describe("bucketFor", () => {
  it("places positions in the right band", () => {
    assert.equal(bucketFor(1), "top3");
    assert.equal(bucketFor(3), "top3");
    assert.equal(bucketFor(4), "4-10");
    assert.equal(bucketFor(10), "4-10");
    assert.equal(bucketFor(11), "11-20");
    assert.equal(bucketFor(50), "21-50");
    assert.equal(bucketFor(100), "51-100");
  });

  it("returns null for anything outside the tracked range", () => {
    assert.equal(bucketFor(null), null);
    assert.equal(bucketFor(101), null);
    assert.equal(bucketFor(0), null);
  });
});

describe("summarizeKeywords", () => {
  it("separates unchecked from checked-but-not-ranking", () => {
    const summary = summarizeKeywords([
      row({ date: null }),
      row({ date: "2026-08-18", position: null }),
      row({ date: "2026-08-18", position: 7 }),
    ]);

    assert.equal(summary.total, 3);
    assert.equal(summary.unchecked, 1);
    assert.equal(summary.notRanking, 1);
    assert.equal(summary.ranking, 1);
  });

  it("counts the position bands cumulatively", () => {
    const summary = summarizeKeywords([
      row({ date: "d", position: 2 }),
      row({ date: "d", position: 8 }),
      row({ date: "d", position: 15 }),
    ]);

    assert.equal(summary.top3, 1);
    assert.equal(summary.top10, 2);
    assert.equal(summary.top20, 3);
  });

  it("averages only over keywords that actually rank", () => {
    const summary = summarizeKeywords([
      row({ date: "d", position: 10 }),
      row({ date: "d", position: 20 }),
      row({ date: "d", position: null }),
      row({ date: null }),
    ]);

    assert.equal(summary.averagePosition, 15);
  });

  it("has no average when nothing ranks", () => {
    assert.equal(
      summarizeKeywords([row({ date: "d", position: null })]).averagePosition,
      null,
    );
  });

  it("sums volume only where it is known, and reports null when never", () => {
    assert.equal(
      summarizeKeywords([
        row({ searchVolume: 100 }),
        row({ searchVolume: null }),
      ]).totalVolume,
      100,
    );
    assert.equal(summarizeKeywords([row()]).totalVolume, null);
  });

  it("counts a lower position number as an improvement", () => {
    const summary = summarizeKeywords([
      row({ date: "d", position: 4, previousPosition: 9 }),
      row({ date: "d", position: 12, previousPosition: 6 }),
    ]);

    assert.equal(summary.improved, 1);
    assert.equal(summary.declined, 1);
  });

  it("treats entering and leaving the range as movement", () => {
    const entered = summarizeKeywords([
      row({ date: "d", position: 40, previousPosition: null }),
    ]);
    assert.equal(entered.improved, 1);

    const left = summarizeKeywords([
      row({ date: "d", position: null, previousPosition: 40 }),
    ]);
    assert.equal(left.declined, 1);
  });

  it("does not count an unchecked keyword as movement", () => {
    const summary = summarizeKeywords([row({ date: null })]);
    assert.equal(summary.improved, 0);
    assert.equal(summary.declined, 0);
  });

  it("reports zeroes for an empty list rather than throwing", () => {
    const summary = summarizeKeywords([]);
    assert.equal(summary.total, 0);
    assert.equal(summary.averagePosition, null);
    assert.equal(summary.totalVolume, null);
  });
});

describe("distributionByDate", () => {
  it("groups by date, oldest first", () => {
    const points = distributionByDate([
      { date: "2026-08-18", position: 2 },
      { date: "2026-08-01", position: 5 },
      { date: "2026-08-18", position: 4 },
    ]);

    assert.deepEqual(
      points.map((point) => point.date),
      ["2026-08-01", "2026-08-18"],
    );
    // Position 2 and position 4 land in different bands.
    assert.equal(points[1].counts.top3, 1);
    assert.equal(points[1].counts["4-10"], 1);
    assert.equal(points[1].total, 2);
  });

  it("counts out-of-range positions separately from buckets", () => {
    const [point] = distributionByDate([
      { date: "d", position: null },
      { date: "d", position: 200 },
      { date: "d", position: 1 },
    ]);

    assert.equal(point.notRanking, 2);
    assert.equal(point.counts.top3, 1);
    assert.equal(point.total, 3);
  });

  it("returns nothing for no input", () => {
    assert.deepEqual(distributionByDate([]), []);
  });
});

describe("intentBreakdown", () => {
  it("counts and ranks intents, largest first", () => {
    const breakdown = intentBreakdown([
      row({ intent: "Informational" }),
      row({ intent: "Informational" }),
      row({ intent: "Commercial" }),
      row({ intent: null }),
    ]);

    assert.equal(breakdown[0].intent, "Informational");
    assert.equal(breakdown[0].count, 2);
    assert.equal(breakdown[0].share, 50);
    assert.ok(breakdown.some((entry) => entry.intent === "Unknown"));
  });

  it("returns nothing for no keywords instead of a fake 100% slice", () => {
    assert.deepEqual(intentBreakdown([]), []);
  });
});
