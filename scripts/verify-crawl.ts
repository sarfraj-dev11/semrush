import { desc, eq } from "drizzle-orm";
import { db } from "../src/db";
import { clients, crawls, pageIssues, projects } from "../src/db/schema";
import { runCrawl } from "../src/lib/crawler/runner";

/**
 * Runs a real crawl in-process and prints every stored field, so a change to
 * the crawler can be checked against a live site without the worker loop in
 * the way.
 *
 * Usage: tsx scripts/verify-crawl.ts <projectId|url> [pageLimit]
 */
async function findOrCreateProject(target: string) {
  const [existing] = await db
    .select()
    .from(projects)
    .where(eq(projects.domain, target))
    .limit(1);
  if (existing) return existing;

  let [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.name, "Audit sandbox"))
    .limit(1);
  if (!client) {
    [client] = await db.insert(clients).values({ name: "Audit sandbox" }).returning();
  }

  const [created] = await db
    .insert(projects)
    .values({
      clientId: client.id,
      name: `Sandbox ${new URL(target).host}`,
      domain: target,
      crawlDepth: 3,
      crawlLimit: 50,
      crawlConcurrency: 4,
    })
    .returning();

  return created;
}

async function main() {
  const targetArg = process.argv[2];
  const limit = Number(process.argv[3] ?? 25);

  const project = /^https?:\/\//i.test(targetArg)
    ? await findOrCreateProject(targetArg)
    : (
        await db
          .select()
          .from(projects)
          .where(eq(projects.id, Number(targetArg)))
          .limit(1)
      )[0];

  if (!project) throw new Error(`No project for "${targetArg}"`);

  // Override in memory only — the project's saved settings are left alone.
  const target = { ...project, crawlLimit: limit };

  const [crawl] = await db
    .insert(crawls)
    .values({ projectId: project.id, status: "queued" })
    .returning({ id: crawls.id });

  console.log(`Crawling ${project.domain} (limit ${limit}) as crawl ${crawl.id}\n`);
  const startedAt = Date.now();

  await runCrawl(crawl.id, target, {
    report: async (progress, label) => console.log(`  [${progress}%] ${label}`),
    isCancelled: async () => false,
    log: async (line) => console.log(`  · ${line}`),
  });

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const [row] = await db.select().from(crawls).where(eq(crawls.id, crawl.id));

  console.log(`\nFinished in ${elapsed}s\n`);
  console.log("=== CRAWL ROW ===");
  console.log(
    JSON.stringify(
      {
        status: row.status,
        pagesCrawled: row.pagesCrawled,
        pagesFound: row.pagesFound,
        healthScore: row.healthScore,
        classification: {
          healthy: row.healthyPages,
          broken: row.brokenPages,
          withIssues: row.pagesWithIssues,
          redirects: row.redirectPages,
          blocked: row.blockedPages,
        },
        scores: {
          crawlability: row.crawlabilityScore,
          https: row.httpsScore,
          internalLinking: row.internalLinkingScore,
          markup: row.markupScore,
          intlSeo: row.intlSeoScore,
          performance: row.performanceScore,
          aiSearch: row.aiSearchScore,
          cwv: row.cwvScore,
        },
        country: {
          targeted: row.countriesTargeted,
          sources: row.countrySources,
          hreflangLanguages: row.hreflangLanguages,
          hreflangPages: row.hreflangPages,
          hreflangProblems: row.hreflangProblems,
          localeForcesRedirect: row.localeForcesRedirect,
        },
        crawlProfile: row.crawlProfile,
        protectionDetected: row.protectionDetected,
        avgResponseMs: row.avgResponseMs,
        robotsTxtFound: row.robotsTxtFound,
        llmsTxtFound: row.llmsTxtFound,
        sitemapUrls: row.sitemapUrls,
        sitemapInvalidUrls: row.sitemapInvalidUrls,
        externalLinks: `${row.externalLinksBroken}/${row.externalLinksChecked} broken`,
        images: `${row.imagesBroken} broken, ${row.imagesOversized} oversized of ${row.imagesChecked}`,
        errors: row.criticalCount,
        warnings: row.warningCount,
        notices: row.noticeCount,
      },
      null,
      2,
    ),
  );

  console.log("\n=== BOT ACCESS ===");
  for (const bot of row.botAccess ?? []) {
    console.log(
      `  ${bot.allowed ? "OK     " : "BLOCKED"} ${bot.label} (${bot.group})` +
        (bot.blockedSample.length ? ` → ${bot.blockedSample.join(", ")}` : ""),
    );
  }

  console.log("\n=== ISSUES FOUND ===");
  const issues = await db
    .select({ code: pageIssues.code })
    .from(pageIssues)
    .where(eq(pageIssues.crawlId, crawl.id));

  const byCode = new Map<string, number>();
  for (const issue of issues) {
    byCode.set(issue.code, (byCode.get(issue.code) ?? 0) + 1);
  }
  for (const [code, count] of [...byCode.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${code}`);
  }

  const [latest] = await db
    .select({ id: crawls.id })
    .from(crawls)
    .orderBy(desc(crawls.id))
    .limit(1);
  console.log(`\nLatest crawl id is now ${latest.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
