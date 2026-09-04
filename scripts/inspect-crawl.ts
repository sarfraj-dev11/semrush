import { sql } from "drizzle-orm";
import { db } from "../src/db";

/** Prints what a finished crawl actually recorded. Dev helper. */
async function main() {
  const crawlId = Number(process.argv[2] ?? 0);

  // No id: list what there is to inspect.
  if (!crawlId) {
    const list = await db.run(
      sql`select c.id, c.status, c.pages_crawled, p.id as project_id, p.name
          from crawls c join projects p on p.id = c.project_id
          order by c.id desc limit 10`,
    );
    console.log("Usage: inspect-crawl.ts <crawlId>\n\nRecent crawls:");
    for (const row of list.rows) {
      console.log(
        `  crawl ${String(row.id).padEnd(4)} project ${String(row.project_id).padEnd(4)} ` +
          `${String(row.status).padEnd(10)} ${String(row.pages_crawled).padStart(4)} pages  ${row.name}`,
      );
    }
    return;
  }

  const codes = await db.run(
    sql`select code, count(*) as c from page_issues where crawl_id = ${crawlId} group by code order by c desc`,
  );
  console.log("--- issue codes ---");
  for (const row of codes.rows) {
    console.log(String(row.code).padEnd(34), row.c);
  }

  const crawl = await db.run(
    sql`select parity_checked, parity_differing, fragments_checked, fragments_broken,
               render_gap_checked, js_only_pages, browser_probe_checked,
               browser_probe_unavailable, trap_affected_urls, trap_patterns
        from crawls where id = ${crawlId}`,
  );
  console.log("\n--- crawl row ---");
  console.log(JSON.stringify(crawl.rows[0], null, 2));

  const cache = await db.run(
    sql`select cdn_provider, cache_control, count(*) as c from crawl_pages
        where crawl_id = ${crawlId} group by cdn_provider, cache_control limit 5`,
  );
  console.log("\n--- cache/CDN per page ---");
  console.log(JSON.stringify(cache.rows, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
