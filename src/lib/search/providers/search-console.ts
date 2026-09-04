/**
 * Google Search Console — Search Analytics API.
 *
 * For a site you own, this is strictly better data than any SERP lookup,
 * scraped or licensed:
 *
 *   - It is Google's own record of where you actually ranked, averaged over
 *     real impressions, rather than one sample of one SERP from one location.
 *   - It carries impressions, clicks and CTR, which a SERP position cannot.
 *   - It reports the queries you rank for, including ones nobody thought to
 *     add to a tracking list.
 *   - It is free, officially sanctioned, and has no blocking to route around.
 *
 * Its one limit is that it only covers properties you have verified — which is
 * exactly the case this tool exists for, and never covers competitors. Use a
 * SERP provider for those.
 *
 * Credentials: GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const API_BASE = "https://searchconsole.googleapis.com/webmasters/v3/sites";

export type SearchConsoleRow = {
  query: string;
  page: string | null;
  country: string | null;
  device: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  /** Average position, 1-based, fractional. */
  position: number;
};

export type SearchConsoleQuery = {
  /** Property URL as verified, e.g. "https://example.com/" or "sc-domain:example.com". */
  siteUrl: string;
  startDate: string;
  endDate: string;
  /** ISO 3166-1 alpha-3, which is what this API expects — not alpha-2. */
  country?: string;
  device?: "DESKTOP" | "MOBILE" | "TABLET";
  dimensions?: ("query" | "page" | "country" | "device" | "date")[];
  rowLimit?: number;
};

type TokenResponse = { access_token?: string; expires_in?: number; error?: string };

type ApiRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

export class SearchConsoleClient {
  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor(
    private readonly clientId = process.env.GSC_CLIENT_ID ?? "",
    private readonly clientSecret = process.env.GSC_CLIENT_SECRET ?? "",
    private readonly refreshToken = process.env.GSC_REFRESH_TOKEN ?? "",
  ) {}

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.refreshToken);
  }

  /** Exchanges the refresh token, caching until shortly before expiry. */
  private async token(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt) return this.accessToken;

    if (!this.isConfigured()) {
      throw new Error("Search Console credentials are not set");
    }

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(30_000),
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const payload = (await response.json()) as TokenResponse;
    if (!response.ok || !payload.access_token) {
      throw new Error(`Search Console auth failed: ${payload.error ?? response.status}`);
    }

    this.accessToken = payload.access_token;
    // Refresh a minute early so a long run never uses a token mid-expiry.
    this.expiresAt = Date.now() + ((payload.expires_in ?? 3600) - 60) * 1000;
    return this.accessToken;
  }

  async searchAnalytics(query: SearchConsoleQuery): Promise<SearchConsoleRow[]> {
    const token = await this.token();
    const dimensions = query.dimensions ?? ["query", "page"];

    const filters: { dimension: string; operator: string; expression: string }[] = [];
    if (query.country) {
      filters.push({
        dimension: "country",
        operator: "equals",
        expression: query.country.toLowerCase(),
      });
    }
    if (query.device) {
      filters.push({
        dimension: "device",
        operator: "equals",
        expression: query.device,
      });
    }

    const response = await fetch(
      `${API_BASE}/${encodeURIComponent(query.siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          startDate: query.startDate,
          endDate: query.endDate,
          dimensions,
          rowLimit: query.rowLimit ?? 1000,
          ...(filters.length > 0
            ? { dimensionFilterGroups: [{ filters }] }
            : {}),
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Search Console returned ${response.status}: ${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as { rows?: ApiRow[] };

    return (payload.rows ?? []).map((row) => {
      const keys = row.keys ?? [];
      const byDimension = new Map(dimensions.map((dim, i) => [dim, keys[i] ?? null]));

      return {
        query: byDimension.get("query") ?? "",
        page: byDimension.get("page") ?? null,
        country: byDimension.get("country") ?? null,
        device: byDimension.get("device") ?? null,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      };
    });
  }

  /** Properties this account has access to — used to match a project domain. */
  async listSites(): Promise<{ siteUrl: string; permissionLevel: string }[]> {
    const token = await this.token();
    const response = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) throw new Error(`Search Console returned ${response.status}`);

    const payload = (await response.json()) as {
      siteEntry?: { siteUrl: string; permissionLevel: string }[];
    };
    return payload.siteEntry ?? [];
  }
}
