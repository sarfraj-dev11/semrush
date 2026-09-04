import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { crawls, jobs } from "../src/db/schema";

/** Queues a crawl for an existing project and waits for it. Dev helper. */
async function main() {
  const projectId = Number(process.argv[2] ?? 14);

  const [crawl] = await db
    .insert(crawls)
    .values({ projectId, status: "queued" })
    .returning({ id: crawls.id });

  await db.insert(jobs).values({
    type: "crawl",
    projectId,
    payload: { crawlId: crawl.id, projectId },
  });

  console.log(`Queued crawl ${crawl.id} for project ${projectId}`);

  for (let i = 0; i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const [row] = await db.select().from(crawls).where(eq(crawls.id, crawl.id));
    if (["completed", "failed", "cancelled"].includes(row.status)) {
      console.log(
        JSON.stringify(
          {
            status: row.status,
            pagesCrawled: row.pagesCrawled,
            sitemapUrls: row.sitemapUrls,
            robotsTxtFound: row.robotsTxtFound,
            parityChecked: row.parityChecked,
            fragmentsChecked: row.fragmentsChecked,
            issuesFound: row.issuesFound,
            error: row.error,
          },
          null,
          2,
        ),
      );
      return;
    }
  }

  console.log("Timed out waiting for the crawl.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
