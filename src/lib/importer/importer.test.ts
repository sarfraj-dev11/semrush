import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autoDetectMapping,
  normalizeDate,
  parseCsvText,
  validateImportRows,
} from "./csv";

describe("CSV Parser", () => {
  it("parses standard comma-delimited CSV with quotes", () => {
    const csv = `Keyword,Search Volume,Difficulty,CPC\n"seo agency",2400,45,3.50\n"best technical seo",880,62,5.20`;
    const { headers, rows } = parseCsvText(csv);

    assert.deepEqual(headers, ["Keyword", "Search Volume", "Difficulty", "CPC"]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]["Keyword"], "seo agency");
    assert.equal(rows[0]["Search Volume"], "2400");
    assert.equal(rows[1]["Keyword"], "best technical seo");
  });

  it("handles semicolon-separated CSVs", () => {
    const csv = `Keyword;Volume;Difficulty\nseo tool;1200;30\nrank tracker;5000;70`;
    const { headers, rows } = parseCsvText(csv);

    assert.deepEqual(headers, ["Keyword", "Volume", "Difficulty"]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]["Volume"], "1200");
  });

  it("auto-detects Semrush / Ahrefs column mappings", () => {
    const semrushHeaders = ["Keyword", "Search Volume", "Keyword Difficulty", "CPC (USD)", "Intent"];
    const mapping = autoDetectMapping("keywords", semrushHeaders);

    assert.equal(mapping.keyword, "Keyword");
    assert.equal(mapping.search_volume, "Search Volume");
    assert.equal(mapping.difficulty, "Keyword Difficulty");
    assert.equal(mapping.cpc, "CPC (USD)");
    assert.equal(mapping.intent, "Intent");
  });

  it("validates and parses import rows cleanly", () => {
    const rawRows: Record<string, string>[] = [
      {
        "Keyword": "nextjs seo",
        "Volume": "4500",
        "KD": "40",
        "Intent": "Informational",
      },
      {
        "Keyword": "",
        "Volume": "100",
        "KD": "",
        "Intent": "",
      },
    ];

    const mapping = {
      keyword: "Keyword",
      search_volume: "Volume",
      difficulty: "KD",
      intent: "Intent",
    };

    const validation = validateImportRows("keywords", rawRows, mapping);
    assert.equal(validation.total, 2);
    assert.equal(validation.validCount, 1);
    assert.equal(validation.invalidCount, 1);
    assert.equal(validation.sampleRows[0].keyword, "nextjs seo");
    assert.equal(validation.sampleRows[0].search_volume, 4500);
    assert.equal(validation.sampleRows[0].difficulty, 40);
  });

  it("normalizes date formats into YYYY-MM-DD", () => {
    assert.equal(normalizeDate("2026-04-15"), "2026-04-15");
    assert.equal(normalizeDate("2026-04-15T10:30:00Z"), "2026-04-15");
  });
});
