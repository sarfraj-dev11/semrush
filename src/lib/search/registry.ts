import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { NoSearchProviderError, type SearchProvider } from "./types";

/**
 * Provider registry.
 *
 * Providers register themselves here so the rank tracker never imports one
 * directly. Adding DataForSEO, SerpApi or Bing is a new file plus one
 * `registerProvider` call; nothing else changes.
 */

const PROVIDERS = new Map<string, SearchProvider>();

export function registerProvider(provider: SearchProvider) {
  PROVIDERS.set(provider.id, provider);
}

export function listProviders(): SearchProvider[] {
  return [...PROVIDERS.values()];
}

export const SEARCH_PROVIDER_KEY = "search_provider";

async function readSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the active provider. Returns null rather than throwing, so callers
 * can degrade to "rankings come from CSV imports" instead of failing.
 */
export async function getSearchProvider(): Promise<SearchProvider | null> {
  const id =
    process.env.SEARCH_PROVIDER ?? (await readSetting(SEARCH_PROVIDER_KEY));

  if (!id) {
    // Exactly one registered provider and no explicit choice: use it.
    const only = PROVIDERS.size === 1 ? [...PROVIDERS.values()][0] : null;
    return only && (await only.isConfigured()) ? only : null;
  }

  const provider = PROVIDERS.get(id);
  if (!provider) return null;
  return (await provider.isConfigured()) ? provider : null;
}

export async function requireSearchProvider(): Promise<SearchProvider> {
  const provider = await getSearchProvider();
  if (!provider) throw new NoSearchProviderError();
  return provider;
}
