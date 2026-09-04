import { db } from "../src/db";
import {
  backlinks,
  clients,
  competitors,
  crawlPages,
  crawls,
  jobs,
  keywordRankings,
  keywords,
  pageIssues,
  pageLinks,
  projects,
  psiRuns,
  tasks,
} from "../src/db/schema";

async function main() {
  console.log("🧹 Clearing all mock data from database...");

  // Delete child records first to respect foreign keys
  await db.delete(pageIssues);
  await db.delete(pageLinks);
  await db.delete(crawlPages);
  await db.delete(crawls);
  await db.delete(keywordRankings);
  await db.delete(keywords);
  await db.delete(backlinks);
  await db.delete(competitors);
  await db.delete(psiRuns);
  await db.delete(tasks);
  await db.delete(jobs);
  await db.delete(projects);
  await db.delete(clients);

  console.log("✅ All mock and seeded database records successfully deleted!");
}

main().catch((err) => {
  console.error("❌ Failed to clean database:", err);
  process.exit(1);
});
