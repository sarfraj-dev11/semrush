import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/lib/env";
import * as schema from "./schema";

export const DATABASE_URL = env.DATABASE_URL;

function createDbClient(): Client {
  // libsql creates the database file but not the directory above it.
  if (DATABASE_URL.startsWith("file:")) {
    const path = DATABASE_URL.slice("file:".length);
    mkdirSync(dirname(path), { recursive: true });
  }

  const client = createClient({
    url: DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN ?? undefined,
  });

  // Configure WAL mode, busy timeout, and enable foreign keys
  void client.execute("PRAGMA journal_mode = WAL");
  void client.execute("PRAGMA busy_timeout = 5000");
  void client.execute("PRAGMA foreign_keys = ON");

  return client;
}

// Dev hot-reload re-evaluates modules; without this each reload leaks a client.
const globalForDb = globalThis as unknown as { __dbClient?: Client };
const client = globalForDb.__dbClient ?? createDbClient();
if (process.env.NODE_ENV !== "production") globalForDb.__dbClient = client;

export const db = drizzle(client, { schema });
export { schema };
