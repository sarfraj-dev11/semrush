import "../src/lib/search/providers";
import { getSearchProvider } from "../src/lib/search/registry";
import { findDomainPosition, QuotaExhaustedError } from "../src/lib/search/types";

/**
 * One live query against the configured provider — the cheapest proof that the
 * credentials, request shape and response mapping all work. Costs one credit.
 *
 * Usage: tsx scripts/verify-serper.ts [keyword] [domain]
 */
async function main() {
  const keyword = process.argv[2] ?? "best project management software";
  const domain = process.argv[3] ?? "asana.com";

  const provider = await getSearchProvider();
  if (!provider) {
    throw new Error(
      "No provider resolved. Check SEARCH_PROVIDER and the matching key in .env.local.",
    );
  }

  console.log(`Provider: ${provider.label} (${provider.id})`);
  console.log(`Device targeting: ${provider.supportsDevice === false ? "not supported — desktop only" : "supported"}`);
  console.log(`Query: "${keyword}"\n`);

  try {
    const response = await provider.search(keyword, {
      country: "US",
      device: "desktop",
    });

    console.log(`Results: ${response.results.length}`);
    console.log(`SERP features: ${response.features.join(", ") || "none"}`);
    console.log(`Total results claimed: ${response.totalResults ?? "not reported"}\n`);

    for (const result of response.results.slice(0, 5)) {
      console.log(`  #${String(result.position).padEnd(3)} ${result.url}`);
    }

    const match = findDomainPosition(response.results, domain);
    console.log(
      `\n${domain}: ${match ? `ranks #${match.position} — ${match.url}` : "not in the tracked range"}`,
    );
  } catch (error) {
    if (error instanceof QuotaExhaustedError) {
      console.error(`\nQUOTA: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
