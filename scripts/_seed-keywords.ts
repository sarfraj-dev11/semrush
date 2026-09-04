import { db } from "../src/db";
import { keywords } from "../src/db/schema";

const PROJECT_ID = 14; // Sandbox localhost:3000 — disposable demo data.

async function main() {
  const rows = ["seo audit tool", "technical seo checklist", "hreflang validator"];

  for (const keyword of rows) {
    await db
      .insert(keywords)
      .values({ projectId: PROJECT_ID, keyword, country: "US" })
      .onConflictDoNothing();
  }

  console.log(`Seeded ${rows.length} keywords into project ${PROJECT_ID}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
