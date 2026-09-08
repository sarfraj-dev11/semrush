import { SearchConsoleClient, type SearchConsoleRow } from "./providers/search-console";
import { hostnameOf } from "@/lib/utils";

export interface PageGscStats {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQuery: string;
  queryCount: number;
}

export interface GscDataResult {
  isConfigured: boolean;
  isConnected: boolean;
  siteUrl?: string;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  pageStats: Map<string, PageGscStats>;
  topQueries: { query: string; clicks: number; impressions: number; position: number }[];
  error?: string;
}

// In-memory cache for 5 minutes to avoid redundant Google API hits
const cache = new Map<string, { data: GscDataResult; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getSearchConsoleData(
  rawDomain: string,
  countryAlpha3?: string,
): Promise<GscDataResult> {
  const domain = hostnameOf(rawDomain) || rawDomain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  const cacheKey = `${domain}:${countryAlpha3 || "ALL"}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  let clientId = process.env.GSC_CLIENT_ID;
  let clientSecret = process.env.GSC_CLIENT_SECRET;
  let refreshToken = process.env.GSC_REFRESH_TOKEN;

  try {
    const { existsSync, readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const envPath = resolve(process.cwd(), ".env.local");
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf8");
      const idMatch = content.match(/GSC_CLIENT_ID=["']?([^"'\r\n]+)["']?/);
      const secretMatch = content.match(/GSC_CLIENT_SECRET=["']?([^"'\r\n]+)["']?/);
      const tokenMatch = content.match(/GSC_REFRESH_TOKEN=["']?([^"'\r\n]+)["']?/);
      if (idMatch && idMatch[1]) clientId = idMatch[1].trim();
      if (secretMatch && secretMatch[1]) clientSecret = secretMatch[1].trim();
      if (tokenMatch && tokenMatch[1]) refreshToken = tokenMatch[1].trim();
    }
  } catch (err) {
    // fallback to process.env
  }

  if (!clientId || !clientSecret || !refreshToken) {
    const unconfiguredResult: GscDataResult = {
      isConfigured: false,
      isConnected: false,
      totalClicks: 0,
      totalImpressions: 0,
      avgCtr: 0,
      avgPosition: 0,
      pageStats: new Map(),
      topQueries: [],
    };
    return unconfiguredResult;
  }

  try {
    const client = new SearchConsoleClient(clientId, clientSecret, refreshToken);

    // List verified sites to find the matching property
    let matchedSiteUrl: string | null = null;
    try {
      const sites = await client.listSites();
      for (const s of sites) {
        const url = s.siteUrl.toLowerCase();
        if (
          url === `sc-domain:${domain.toLowerCase()}` ||
          url.includes(domain.toLowerCase())
        ) {
          matchedSiteUrl = s.siteUrl;
          break;
        }
      }
    } catch (siteListErr) {
      console.warn("⚠️ [GSC] Could not list verified sites, falling back to sc-domain:", siteListErr);
    }

    if (!matchedSiteUrl) {
      // Standard GSC Domain Property format or URL prefix
      matchedSiteUrl = `sc-domain:${domain}`;
    }

    // Last 28 days ending 2 days ago (GSC data pipeline delay)
    const end = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const startDate = start.toISOString().split("T")[0];
    const endDate = end.toISOString().split("T")[0];

    const rows: SearchConsoleRow[] = await client.searchAnalytics({
      siteUrl: matchedSiteUrl,
      startDate,
      endDate,
      country: countryAlpha3,
      dimensions: ["page", "query"],
      rowLimit: 2500,
    });

    let totalClicks = 0;
    let totalImpressions = 0;
    const pageStats = new Map<string, PageGscStats>();
    const queryAgg = new Map<string, { clicks: number; impressions: number; positionSum: number; count: number }>();

    for (const r of rows) {
      totalClicks += r.clicks;
      totalImpressions += r.impressions;

      // Group queries
      if (r.query) {
        const q = queryAgg.get(r.query) || { clicks: 0, impressions: 0, positionSum: 0, count: 0 };
        q.clicks += r.clicks;
        q.impressions += r.impressions;
        q.positionSum += r.position;
        q.count += 1;
        queryAgg.set(r.query, q);
      }

      // Group pages
      if (r.page) {
        let normalizedPath = r.page;
        try {
          const parsed = new URL(r.page);
          normalizedPath = parsed.pathname;
        } catch {
          // keep as is
        }

        const existing = pageStats.get(normalizedPath) || pageStats.get(r.page) || {
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
          topQuery: r.query,
          queryCount: 0,
        };

        const newClicks = existing.clicks + r.clicks;
        const newImpressions = existing.impressions + r.impressions;
        const newCtr = newImpressions > 0 ? (newClicks / newImpressions) * 100 : 0;
        const topQuery = r.clicks >= existing.clicks ? r.query : existing.topQuery;

        const updated: PageGscStats = {
          clicks: newClicks,
          impressions: newImpressions,
          ctr: Math.round(newCtr * 10) / 10,
          position: r.position,
          topQuery: topQuery || existing.topQuery,
          queryCount: existing.queryCount + 1,
        };

        pageStats.set(normalizedPath, updated);
        pageStats.set(r.page, updated);
      }
    }

    const topQueries = Array.from(queryAgg.entries())
      .map(([query, data]) => ({
        query,
        clicks: data.clicks,
        impressions: data.impressions,
        position: data.count > 0 ? Math.round((data.positionSum / data.count) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20);

    const avgCtr = totalImpressions > 0 ? Math.round(((totalClicks / totalImpressions) * 100) * 10) / 10 : 0;
    const avgPosition = topQueries.length > 0
      ? Math.round((topQueries.reduce((s, q) => s + q.position, 0) / topQueries.length) * 10) / 10
      : 0;

    const result: GscDataResult = {
      isConfigured: true,
      isConnected: true,
      siteUrl: matchedSiteUrl,
      totalClicks,
      totalImpressions,
      avgCtr,
      avgPosition,
      pageStats,
      topQueries,
    };

    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (err: any) {
    console.error("❌ [GSC] Failed to fetch Search Console analytics:", err);
    let errorMessage = err?.message || "Failed to communicate with Google Search Console API";
    if (errorMessage.includes("User does not have sufficient permission") || errorMessage.includes("403")) {
      errorMessage = `Google account is authorized, but vazautosolutions.com is not yet added or verified in Google Search Console for this account. Add vazautosolutions.com at search.google.com/search-console to view real clicks.`;
    }

    return {
      isConfigured: true,
      isConnected: false,
      totalClicks: 0,
      totalImpressions: 0,
      avgCtr: 0,
      avgPosition: 0,
      pageStats: new Map(),
      topQueries: [],
      error: errorMessage,
    };
  }
}
