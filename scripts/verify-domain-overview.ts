import { analyzeDomain } from "../src/lib/domain-overview";
import { ISSUE_BY_CODE } from "../src/lib/crawler/issue-catalog";

/**
 * Runs the live domain overview against a real site.
 *
 * Usage: tsx scripts/verify-domain-overview.ts <domain> [--search]
 * --search spends API credits; without it the run is entirely first-party.
 */
async function main() {
  const domain = process.argv[2] ?? "example.com";
  const includeSearch = process.argv.includes("--search");

  const started = Date.now();
  const report = await analyzeDomain(domain, { includeSearch });
  const elapsed = Date.now() - started;

  console.log(`\n=== ${report.host} (${elapsed}ms) ===`);

  if (report.error) {
    console.log(`UNREACHABLE: ${report.error}`);
    return;
  }

  const page = report.homepage;
  console.log(`status        ${page?.statusCode}  ${page?.responseTimeMs}ms`);
  console.log(`title         ${page?.title ?? "(none)"}`);
  console.log(`canonical     ${page?.canonical ?? "(none)"}  self=${page?.isSelfCanonical}`);
  console.log(`words         ${page?.wordCount}   links ${page?.internalLinks} internal / ${page?.externalLinks} external`);
  console.log(`https/hsts    ${page?.isHttps} / ${page?.hasHsts}`);
  console.log(`security      ${report.security?.present}/${report.security?.total} headers`);
  console.log(`cdn / cache   ${report.cache?.cdn ?? "none"} / ${report.cache?.cacheControl ?? "not set"}`);
  console.log(`robots.txt    ${report.robotsTxtFound}  (${report.declaredSitemaps} sitemaps declared)`);
  console.log(`sitemap URLs  ${report.sitemapUrlCount}`);
  console.log(`llms.txt      ${report.llmsTxtFound}`);
  console.log(`structured    ${page?.structuredDataTypes.join(", ") || "none"}`);
  console.log(`geo           ${JSON.stringify(report.geo)}`);
  console.log(
    `bots blocked  ${report.botAccess.filter((b) => !b.allowed).map((b) => b.label).join(", ") || "none"}`,
  );
  console.log(
    `parity        ${report.parityChecked ? (report.parity.length === 0 ? "identical" : report.parity.map((d) => d.field).join(", ")) : "not checked"}`,
  );

  console.log(`\nissues (${report.issues.length}):`);
  for (const issue of report.issues) {
    const definition = ISSUE_BY_CODE.get(issue.code);
    console.log(
      `  [${definition?.severity ?? "?"}] ${definition?.label ?? issue.code}` +
        (issue.detail ? ` — ${issue.detail}` : ""),
    );
  }

  console.log(`\nsearch: ${report.search.state}`);
  if (report.search.state === "ok") {
    console.log(`  brand "${report.search.brandQuery}" → ${report.search.brandPosition ?? "not ranking"}`);
    for (const result of report.search.indexedSample.slice(0, 5)) {
      console.log(`  #${result.position} ${result.url}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
