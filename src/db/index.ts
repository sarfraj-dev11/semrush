import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/lib/env";
import * as schema from "./schema";

export const DATABASE_URL = env.DATABASE_URL;

import { BOOTSTRAP_SCHEMA } from "./bootstrap-schema";

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

  const originalExecute = client.execute.bind(client);
  const originalBatch = client.batch.bind(client);

  let schemaInitialized = false;
  let initPromise: Promise<void> | null = null;

  async function ensureInitialized() {
    if (schemaInitialized) return;
    if (!initPromise) {
      initPromise = (async () => {
        try {
          const check = await originalExecute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='projects' LIMIT 1"
          );
          if (check.rows.length === 0) {
            console.log("⚡ [DB] Initializing database schema...");
            for (const statement of BOOTSTRAP_SCHEMA) {
              try {
                await originalExecute(statement);
              } catch {
                // statement might already exist
              }
            }
          }

          try {
            await originalExecute(
              "INSERT OR IGNORE INTO clients (id, name, status) VALUES (12, 'Primary Organization', 'active')"
            );
            const checkProj = await originalExecute("SELECT id FROM projects LIMIT 1");
            let defaultProjId = 20;
            if (checkProj.rows.length === 0) {
              try {
                const { syncProjectsFromFirebase, syncKeywordsAndRankingsFromFirebase } = await import("@/lib/firebase-tracking");
                const synced = await syncProjectsFromFirebase();
                if (synced > 0) {
                  await syncKeywordsAndRankingsFromFirebase();
                }
              } catch (fbErr) {
                console.error("⚠️ [DB] Firebase bootstrap sync error:", fbErr);
              }

              const checkProjAgain = await originalExecute("SELECT id FROM projects LIMIT 1");
              if (checkProjAgain.rows.length === 0) {
                await originalExecute(
                  "INSERT OR IGNORE INTO projects (id, client_id, name, domain, target_country, target_device) VALUES (20, 12, 'Vazautosolutions', 'https://vazautosolutions.com', 'US', 'desktop')"
                );
              } else {
                defaultProjId = Number(checkProjAgain.rows[0].id) || 20;
              }
            } else {
              defaultProjId = Number(checkProj.rows[0].id) || 20;
            }

            const checkKw = await originalExecute("SELECT 1 FROM keywords LIMIT 1");
            if (checkKw.rows.length === 0) {
              await originalExecute(
                `INSERT OR IGNORE INTO keywords (id, project_id, keyword, country) VALUES (1, ${defaultProjId}, 'vaz autosolutions', 'US')`
              );
            }
          } catch (seedErr) {
            console.error("⚠️ [DB] Seed data error:", seedErr);
          }

          schemaInitialized = true;
        } catch (err) {
          console.error("❌ [DB] Schema initialization error:", err);
        }
      })();
    }
    await initPromise;
  }

  client.execute = async function (...args: Parameters<typeof originalExecute>) {
    await ensureInitialized();
    return originalExecute(...args);
  };

  client.batch = async function (...args: Parameters<typeof originalBatch>) {
    await ensureInitialized();
    return originalBatch(...args);
  };

  return client;
}

// Dev hot-reload re-evaluates modules; without this each reload leaks a client.
const globalForDb = globalThis as unknown as { __dbClient?: Client };
const client = globalForDb.__dbClient ?? createDbClient();
if (process.env.NODE_ENV !== "production") globalForDb.__dbClient = client;

export const db = drizzle(client, { schema });
export { schema };
