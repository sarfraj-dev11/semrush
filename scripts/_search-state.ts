import { db } from "../src/db";
import { keywordRankings, keywords, projects, settings } from "../src/db/schema";
import "../src/lib/search/providers";
import { getSearchProvider, listProviders } from "../src/lib/search/registry";

async function main() {
  console.log("=== REGISTERED PROVIDERS ===");
  for (const provider of listProviders()) {
    console.log(`  ${provider.id.padEnd(12)} ${provider.label.padEnd(14)} configured=${await provider.isConfigured()}`);
  }

  const active = await getSearchProvider();
  console.log(`\nActive provider: ${active ? active.id : "none"}`);

  console.log("\n=== ENV ===");
  for (const key of ["SEARCH_PROVIDER", "DATAFORSEO_LOGIN", "SERPAPI_KEY", "GSC_REFRESH_TOKEN"]) {
    console.log(`  ${key.padEnd(20)} ${process.env[key] ? "set" : "not set"}`);
  }

  console.log("\n=== SETTINGS ROWS ===");
  const rows = await db.select().from(settings);
  console.log(rows.length ? rows.map((r) => `  ${r.key}`).join("\n") : "  (none)");

  console.log("\n=== KEYWORDS PER PROJECT ===");
  const allProjects = await db.select().from(projects);
  const allKeywords = await db.select().from(keywords);
  for (const p of allProjects) {
    const mine = allKeywords.filter((k) => k.projectId === p.id);
    console.log(`  [${p.id}] ${p.name} (${p.domain}) — ${mine.length} keywords, target ${p.targetCountry}/${p.targetDevice}`);
    for (const k of mine.slice(0, 5)) console.log(`        · ${k.keyword} (${k.country})`);
  }

  const ranks = await db.select().from(keywordRankings);
  console.log(`\n=== RANKING ROWS === ${ranks.length}`);
  const bySource = new Map<string, number>();
  for (const r of ranks) bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
  for (const [source, count] of bySource) console.log(`  ${source}: ${count}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
