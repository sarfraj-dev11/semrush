import { migrate } from "drizzle-orm/libsql/migrator";
import { db, DATABASE_URL } from "../src/db";

async function main() {
  console.log(`Applying migrations to ${DATABASE_URL}`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
