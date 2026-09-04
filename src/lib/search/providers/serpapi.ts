import type {
  SearchOptions,
  SearchProvider,
  SearchResponse,
  SearchResult,
} from "../types";

/**
 * SerpApi adapter.
 *
 * Same shape of service as DataForSEO, different pricing and a simpler GET
 * interface. Having two means the provider choice is a config value rather than
 * a rewrite, and neither one is a dependency you cannot swap.
 *
 * Credentials: SERPAPI_KEY.
 */

const ENDPOINT = "https://serpapi.com/search.json";

type SerpApiOrganic = {
  position?: number;
  link?: string;
  title?: string;
  snippet?: string;
  displayed_link?: string;
};

type SerpApiResponse = {
  error?: string;
  organic_results?: SerpApiOrganic[];
  search_information?: { total_results?: number };
  answer_box?: unknown;
  knowledge_graph?: unknown;
  related_questions?: unknown;
  ads?: unknown[];
};

export class SerpApiProvider implements SearchProvider {
  readonly id = "serpapi";
  readonly label = "SerpApi";
  readonly countries = null;

  constructor(private readonly apiKey = process.env.SERPAPI_KEY ?? "") {}

  async isConfigured(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async search(keyword: string, options: SearchOptions): Promise<SearchResponse> {
    if (!(await this.isConfigured())) {
      throw new Error("SERPAPI_KEY is not set");
    }

    const url = new URL(ENDPOINT);
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", keyword);
    url.searchParams.set("gl", options.country.toLowerCase());
    url.searchParams.set("hl", options.language ?? "en");
    url.searchParams.set("device", options.device);
    url.searchParams.set("num", String(options.limit ?? 100));
    url.searchParams.set("api_key", this.apiKey);
    if (options.location) url.searchParams.set("location", options.location);

    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`SerpApi returned ${response.status}`);

    const payload = (await response.json()) as SerpApiResponse;
    if (payload.error) throw new Error(payload.error);

    const results: SearchResult[] = (payload.organic_results ?? [])
      .filter((item) => item.link)
      .map((item, index) => ({
        position: item.position ?? index + 1,
        url: item.link!,
        title: item.title ?? null,
        description: item.snippet ?? null,
        displayUrl: item.displayed_link ?? null,
      }));

    // SERP features matter for rank tracking: position 1 under a featured
    // snippet and an answer box is not the same as position 1 alone.
    const features: string[] = [];
    if (payload.answer_box) features.push("answer_box");
    if (payload.knowledge_graph) features.push("knowledge_graph");
    if (payload.related_questions) features.push("people_also_ask");
    if (payload.ads?.length) features.push("ads");

    return {
      keyword,
      results,
      features,
      totalResults: payload.search_information?.total_results ?? null,
      source: this.id,
      fetchedAt: new Date(),
    };
  }
}
