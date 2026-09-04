import { defineConfig } from "drizzle-kit";

// Only `generate` is run through drizzle-kit — migrations are applied by
// scripts/migrate.ts, so no database credentials are needed here.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  strict: true,
  verbose: true,
});
