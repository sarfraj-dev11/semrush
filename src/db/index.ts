import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/lib/env";
import * as schema from "./schema";

export const DATABASE_URL = env.DATABASE_URL;

function createDbClient(): Client {
  let url = DATABASE_URL;
  if (process.env.VERCEL && url.startsWith("file:./data")) {
    url = "file:/tmp/app.db";
  }

  // libsql creates the database file but not the directory above it.
  if (url.startsWith("file:")) {
    try {
      const path = url.slice("file:".length);
      const dir = dirname(path);
      if (dir && dir !== "." && dir !== "/") {
        mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.error("❌ [DB] Failed to create database directory:", err);
    }
  }

  const client = createClient({
    url,
    authToken: env.DATABASE_AUTH_TOKEN ?? undefined,
  });

  // Configure WAL mode, busy timeout, and enable foreign keys
  try {
    void client.execute("PRAGMA journal_mode = WAL");
    void client.execute("PRAGMA busy_timeout = 5000");
    void client.execute("PRAGMA foreign_keys = ON");
  } catch (err) {
    console.error("❌ [DB] Failed to configure SQLite pragmas:", err);
  }

  return client;
}

// Dev hot-reload re-evaluates modules; without this each reload leaks a client.
const globalForDb = globalThis as unknown as { __dbClient?: Client };
const client = globalForDb.__dbClient ?? createDbClient();
if (process.env.NODE_ENV !== "production") globalForDb.__dbClient = client;

export const db = drizzle(client, { schema });
export { schema };
