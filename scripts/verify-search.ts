import { desc, eq } from "drizzle-orm";
import { db } from "../src/db";
import { keywordRankings, keywords, projects } from "../src/db/schema";
import { DataForSeoProvider } from "../src/lib/search/providers/dataforseo";
import { trackProjectRankings } from "../src/lib/search/rank-tracker";

/**
 * Exercises the real rank-tracking path end to end: provider adapter → SERP
 * parsing → domain matching → keyword_rankings rows.
 *
 * Usage: tsx scripts/verify-search.ts <projectId> [endpoint]
 *
 * With no endpoint it hits the live DataForSEO API and needs real credentials.
 * Pointed at a fixture it runs the same adapter code against a canned response,
 * which is how the pipeline is checked without spending API credits.
 */
async function main() {
  const projectId = Number(process.argv[2]);
  const endpoint = process.argv[3];

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) throw new Error(`No project with id ${projectId}`);

  const provider = endpoint
    ? new DataForSeoProvider("fixture-login", "fixture-password", endpoint)
    : new DataForSeoProvider();

  console.log(`Project: ${project.name} (${project.domain})`);
  console.log(`Target:  ${project.targetCountry} / ${project.targetDevice}`);
  console.log(`Provider: ${provider.label}${endpoint ? ` → ${endpoint}` : " (live)"}\n`);

  const result = await trackProjectRankings(
    project,
    {
      log: async (line) => console.log(`  · ${line}`),
      report: async (done, total, keyword) =>
        console.log(`  [${done}/${total}] ${keyword}`),
    },
    { provider },
  );

  console.log(`\n=== RESULT ===`);
  console.log(JSON.stringify(result, null, 2));

  const rows = await db
    .select({
      keyword: keywords.keyword,
      date: keywordRankings.date,
      position: keywordRankings.position,
      url: keywordRankings.url,
      source: keywordRankings.source,
    })
    .from(keywordRankings)
    .innerJoin(keywords, eq(keywordRankings.keywordId, keywords.id))
    .where(eq(keywords.projectId, project.id))
    .orderBy(desc(keywordRankings.date));

  console.log(`\n=== STORED RANKINGS (${rows.length}) ===`);
  for (const row of rows) {
    const position = row.position === null ? "not ranking" : `#${row.position}`;
    console.log(
      `  ${row.date}  ${position.padEnd(12)} ${row.keyword.padEnd(28)} ${row.url ?? ""}  [${row.source}]`,
    );
  }
}

// No process.exit on success: forcing exit while sockets are still closing
// trips a libuv assertion on Windows. Letting the loop drain is cleaner.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
