import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import {
  parseProxyConfig,
  ProxyPool,
  type ProxyPoolOptions,
  type RotationStrategy,
} from "./proxy";

/**
 * Proxy configuration lives in the settings table so it can be changed without
 * a redeploy, with an env var override for deployments that inject secrets that
 * way. Proxy URLs carry credentials, so they are never logged.
 */

export const PROXY_SETTINGS_KEY = "proxy_endpoints";
export const PROXY_STRATEGY_KEY = "proxy_strategy";

async function readSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    return row?.value ?? null;
  } catch {
    // A missing settings table should not stop a crawl; it just means no proxy.
    return null;
  }
}

export async function loadProxyPool(
  overrides: Partial<ProxyPoolOptions> = {},
): Promise<ProxyPool | null> {
  const raw = process.env.CRAWLER_PROXIES ?? (await readSetting(PROXY_SETTINGS_KEY));
  const endpoints = parseProxyConfig(raw);
  if (endpoints.length === 0) return null;

  const strategy =
    (process.env.CRAWLER_PROXY_STRATEGY as RotationStrategy | undefined) ??
    ((await readSetting(PROXY_STRATEGY_KEY)) as RotationStrategy | null) ??
    "per-request";

  return new ProxyPool(endpoints, { strategy, ...overrides });
}

/** Redacts credentials so a pool can be described in a log line. */
export function describePool(pool: ProxyPool): string {
  const byType = new Map<string, number>();
  for (const entry of pool.stats()) {
    byType.set(entry.type, (byType.get(entry.type) ?? 0) + 1);
  }

  const types = [...byType.entries()]
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");

  const countries = pool.countries;
  return (
    `${pool.size} proxies (${types})` +
    (countries.length > 0 ? ` across ${countries.join(", ")}` : " with no country data")
  );
}
