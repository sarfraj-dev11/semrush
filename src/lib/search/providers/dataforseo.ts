import { ALL_COUNTRIES } from "@/lib/countries";
import type {
  SearchOptions,
  SearchProvider,
  SearchResponse,
  SearchResult,
} from "../types";

/**
 * DataForSEO SERP adapter.
 *
 * Live Google results with country, language and device targeting as ordinary
 * request parameters. The provider runs the infrastructure and carries the
 * compliance burden, which is the whole point: geo-targeting becomes a field in
 * a JSON body rather than a proxy fleet to maintain, and there is nothing to
 * get blocked.
 *
 * Credentials: DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.
 */

export const DATAFORSEO_ENDPOINT =
  "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

type DfsItem = {
  type?: string;
  rank_absolute?: number;
  url?: string;
  title?: string;
  description?: string;
  domain?: string;
};

type DfsResult = {
  items?: DfsItem[];
  se_results_count?: number;
  item_types?: string[];
};

type DfsTask = {
  status_code?: number;
  status_message?: string;
  result?: DfsResult[];
};

/** DataForSEO wants a full location name, not an ISO code. */
function locationName(country: string): string {
  const match = ALL_COUNTRIES.find((entry) => entry.code === country);
  return match?.name ?? "United States";
}

export class DataForSeoProvider implements SearchProvider {
  readonly id = "dataforseo";
  readonly label = "DataForSEO";
  /** The API covers effectively every country, so no allowlist is imposed. */
  readonly countries = null;

  constructor(
    private readonly login = process.env.DATAFORSEO_LOGIN ?? "",
    private readonly password = process.env.DATAFORSEO_PASSWORD ?? "",
    /** Overridable so the adapter can be exercised against a local fixture. */
    private readonly endpoint = process.env.DATAFORSEO_ENDPOINT ?? DATAFORSEO_ENDPOINT,
  ) {}

  async isConfigured(): Promise<boolean> {
    return Boolean(this.login && this.password);
  }

  private authHeader(): string {
    const encoded = Buffer.from(`${this.login}:${this.password}`).toString("base64");
    return `Basic ${encoded}`;
  }

  async search(keyword: string, options: SearchOptions): Promise<SearchResponse> {
    if (!(await this.isConfigured())) {
      throw new Error("DataForSEO credentials are not set");
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(60_000),
      // The API takes an array of tasks; one keyword per call keeps failures
      // attributable to a single keyword.
      body: JSON.stringify([
        {
          keyword,
          location_name: options.location ?? locationName(options.country),
          language_code: options.language ?? "en",
          device: options.device,
          depth: options.limit ?? 100,
        },
      ]),
    });

    if (!response.ok) {
      throw new Error(`DataForSEO returned ${response.status}`);
    }

    const payload = (await response.json()) as { tasks?: DfsTask[] };
    const task = payload.tasks?.[0];

    // 20000 is the success code; anything else is a task-level failure that
    // still arrives inside a 200 response.
    if (!task || (task.status_code && task.status_code >= 40000)) {
      throw new Error(task?.status_message ?? "DataForSEO returned no task");
    }

    const result = task.result?.[0];
    const items = result?.items ?? [];

    const results: SearchResult[] = items
      .filter((item) => item.type === "organic" && item.url)
      .map((item, index) => ({
        position: item.rank_absolute ?? index + 1,
        url: item.url!,
        title: item.title ?? null,
        description: item.description ?? null,
        displayUrl: item.domain ?? null,
      }));

    return {
      keyword,
      results,
      features: (result?.item_types ?? []).filter((type) => type !== "organic"),
      totalResults: result?.se_results_count ?? null,
      source: this.id,
      fetchedAt: new Date(),
    };
  }
}
