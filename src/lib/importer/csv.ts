import { hostnameOf } from "@/lib/utils";

export type ImportSourceType =
  | "keywords"
  | "rankings"
  | "backlinks"
  | "competitors";

export interface FieldDefinition {
  key: string;
  label: string;
  required?: boolean;
  type: "string" | "number" | "boolean" | "date";
  aliases: string[];
}

export const SOURCE_FIELD_DEFINITIONS: Record<ImportSourceType, FieldDefinition[]> = {
  keywords: [
    {
      key: "keyword",
      label: "Keyword",
      required: true,
      type: "string",
      aliases: ["keyword", "query", "search term", "kw"],
    },
    {
      key: "search_volume",
      label: "Search Volume",
      type: "number",
      aliases: ["search volume", "volume", "vol", "monthly searches", "sv", "searches", "msv", "monthly search volume"],
    },
    {
      key: "difficulty",
      label: "Difficulty (KD%)",
      type: "number",
      aliases: ["difficulty", "kd", "keyword difficulty", "kd %", "competition"],
    },
    {
      key: "cpc",
      label: "CPC ($)",
      type: "number",
      aliases: ["cpc", "cost per click", "cpc (usd)"],
    },
    {
      key: "intent",
      label: "Search Intent",
      type: "string",
      aliases: ["intent", "search intent", "intent classification"],
    },
    {
      key: "target_url",
      label: "Target URL",
      type: "string",
      aliases: ["target url", "landing page", "url", "page"],
    },
    {
      key: "tags",
      label: "Tags",
      type: "string",
      aliases: ["tags", "group", "category", "tag"],
    },
  ],
  rankings: [
    {
      key: "keyword",
      label: "Keyword",
      required: true,
      type: "string",
      aliases: ["keyword", "query", "search term", "kw"],
    },
    {
      key: "position",
      label: "Rank Position",
      required: true,
      type: "number",
      aliases: ["position", "rank", "ranking", "pos", "google rank"],
    },
    {
      key: "date",
      label: "Date",
      type: "date",
      aliases: ["date", "ranking date", "checked date", "timestamp"],
    },
    {
      key: "url",
      label: "Ranking URL",
      type: "string",
      aliases: ["url", "ranking url", "page url", "target url"],
    },
    {
      key: "search_volume",
      label: "Search Volume",
      type: "number",
      aliases: ["search volume", "volume", "vol", "monthly searches", "sv", "searches", "msv", "monthly search volume"],
    },
  ],
  backlinks: [
    {
      key: "source_url",
      label: "Source URL",
      required: true,
      type: "string",
      aliases: [
        "source url",
        "referring page",
        "source",
        "backlink url",
        "page url",
      ],
    },
    {
      key: "source_domain",
      label: "Source Domain",
      type: "string",
      aliases: ["source domain", "referring domain", "domain", "root domain"],
    },
    {
      key: "target_url",
      label: "Target URL",
      type: "string",
      aliases: ["target url", "target", "destination url", "link to"],
    },
    {
      key: "anchor_text",
      label: "Anchor Text",
      type: "string",
      aliases: ["anchor text", "anchor", "link text"],
    },
    {
      key: "domain_rating",
      label: "Domain Rating / AS",
      type: "number",
      aliases: [
        "domain rating",
        "dr",
        "authority score",
        "as",
        "da",
        "domain authority",
      ],
    },
    {
      key: "is_follow",
      label: "Follow / Nofollow",
      type: "boolean",
      aliases: ["is follow", "follow", "type", "link type", "attribute"],
    },
    {
      key: "first_seen",
      label: "First Seen",
      type: "string",
      aliases: ["first seen", "first noticed", "discovered"],
    },
    {
      key: "last_seen",
      label: "Last Seen",
      type: "string",
      aliases: ["last seen", "last checked"],
    },
    {
      key: "status",
      label: "Status",
      type: "string",
      aliases: ["status", "link status", "state"],
    },
  ],
  competitors: [
    {
      key: "domain",
      label: "Competitor Domain / URL",
      required: true,
      type: "string",
      aliases: ["domain", "competitor domain", "competitor", "url", "website"],
    },
    {
      key: "name",
      label: "Competitor Name",
      type: "string",
      aliases: ["name", "competitor name", "company", "brand"],
    },
  ],
};

/** Parses standard CSV string into headers and array of row string records */
export function parseCsvText(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter: comma, semicolon, tab
  const firstLine = lines[0];
  const delimiters = [",", ";", "\t"];
  let delimiter = ",";
  let maxCols = 0;
  for (const d of delimiters) {
    const count = firstLine.split(d).length;
    if (count > maxCols) {
      maxCols = count;
      delimiter = d;
    }
  }

  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  const rawHeaders = parseLine(lines[0]);
  // Clean headers (remove UTF-8 BOM if present and quotes)
  const headers = rawHeaders.map((h) =>
    h.replace(/^\uFEFF/, "").replace(/^["']|["']$/g, "").trim(),
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseLine(line);
    // Skip completely empty or delimiter-only separator rows
    const hasAnyContent = values.some((v) => v && v.trim().length > 0);
    if (!hasAnyContent) continue;

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) {
        row[header] = values[j] ?? "";
      }
    }
    rows.push(row);
  }

  return { headers, rows };
}

/** Auto-detects mapping between CSV headers and target schema fields */
export function autoDetectMapping(
  sourceType: ImportSourceType,
  headers: string[],
): Record<string, string> {
  const fields = SOURCE_FIELD_DEFINITIONS[sourceType] ?? [];
  const mapping: Record<string, string> = {};

  const normalizedHeaders = headers.map((h) => ({
    original: h,
    normalized: h.toLowerCase().replace(/[^a-z0-9]/g, ""),
  }));

  for (const field of fields) {
    // Check direct aliases
    for (const alias of field.aliases) {
      const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
      const matched = normalizedHeaders.find(
        (nh) => nh.normalized === normAlias || nh.normalized.includes(normAlias),
      );
      if (matched && !Object.values(mapping).includes(matched.original)) {
        mapping[field.key] = matched.original;
        break;
      }
    }
  }

  return mapping;
}

/** Normalizes date string into YYYY-MM-DD */
export function normalizeDate(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) {
    return new Date().toISOString().split("T")[0];
  }
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return new Date().toISOString().split("T")[0];
}

/** Runs dry-run validation on mapped rows */
export function validateImportRows(
  sourceType: ImportSourceType,
  rawRows: Record<string, string>[],
  mapping: Record<string, string>,
): {
  total: number;
  validCount: number;
  invalidCount: number;
  sampleRows: Record<string, unknown>[];
  errors: string[];
} {
  const fields = SOURCE_FIELD_DEFINITIONS[sourceType];
  const requiredFields = fields.filter((f) => f.required);
  const sampleRows: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const isAllBlank = Object.values(raw).every((v) => !v || v.trim().length === 0);
    if (isAllBlank) continue;

    const item: Record<string, unknown> = {};
    let rowError: string | null = null;

    for (const field of fields) {
      const csvCol = mapping[field.key];
      const val = csvCol ? raw[csvCol]?.trim() : "";

      if (field.required && (!val || val.length === 0)) {
        rowError = `Row #${i + 1}: missing required field "${field.label}"`;
        break;
      }

      if (!val) {
        item[field.key] = null;
        continue;
      }

      if (field.type === "number") {
        const num = Number(val.replace(/[^0-9.-]/g, ""));
        item[field.key] = isNaN(num) ? null : num;
      } else if (field.type === "boolean") {
        const lower = val.toLowerCase();
        item[field.key] =
          lower === "true" ||
          lower === "yes" ||
          lower === "1" ||
          lower === "follow" ||
          lower === "dofollow";
      } else if (field.type === "date") {
        item[field.key] = normalizeDate(val);
      } else {
        item[field.key] = val;
      }
    }

    if (rowError) {
      invalidCount++;
      if (errors.length < 5) errors.push(rowError);
    } else {
      // Custom source-specific cleanups
      if (sourceType === "backlinks") {
        if (!item.source_domain && typeof item.source_url === "string") {
          item.source_domain = hostnameOf(item.source_url as string);
        }
      } else if (sourceType === "competitors") {
        if (typeof item.domain === "string") {
          item.domain = item.domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
        }
      }

      validCount++;
      if (sampleRows.length < 5) {
        sampleRows.push(item);
      }
    }
  }

  return {
    total: rawRows.length,
    validCount,
    invalidCount,
    sampleRows,
    errors,
  };
}
