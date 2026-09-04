import {
  InvalidCredentialsError,
  QuotaExhaustedError,
  RateLimitedError,
  type SearchOptions,
  type SearchProvider,
  type SearchResponse,
  type SearchResult,
} from "../types";

/**
 * Serper adapter.
 *
 * A licensed Google SERP API with a free credit pool, which makes it the
 * cheapest way to turn rank tracking on. Same contract as the other providers,
 * so switching is a config value.
 *
 * One honest limitation: Serper's search endpoint has no device parameter, so
 * `options.device` cannot be honoured — every result set is desktop. That is
 * reported through `supportsDevice` rather than silently ignored, because a
 * mobile ranking and a desktop ranking are different numbers and quietly
 * serving one as the other is how a tracker starts lying.
 *
 * Credentials: SERPER_API_KEY.
 */

const ENDPOINT = "https://google.serper.dev/search";

type SerperOrganic = {
  position?: number;
  link?: string;
  title?: string;
  snippet?: string;
};

type SerperResponse = {
  organic?: SerperOrganic[];
  answerBox?: unknown;
  knowledgeGraph?: unknown;
  peopleAlsoAsk?: unknown[];
  relatedSearches?: unknown[];
  topStories?: unknown[];
  images?: unknown[];
  searchInformation?: { totalResults?: number };
  /** Credits this query consumed, when the plan reports it. */
  credits?: number;
  message?: string;
};

/**
 * Serper signals an empty balance with 402, and sometimes with a 403 whose
 * body mentions credits. Both mean "stop"; a 429 means "slow down".
 */
function classifyFailure(
  status: number,
  body: string,
): QuotaExhaustedError | InvalidCredentialsError | RateLimitedError | Error {
  const detail = body.trim().slice(0, 200) || `HTTP ${status}`;
  const mentionsCredits = /credit|quota|limit|balance|exhaust/i.test(body);

  if (status === 402) return new QuotaExhaustedError("Serper", detail, status);
  if (status === 403 && mentionsCredits) {
    return new QuotaExhaustedError("Serper", detail, status);
  }
  if (status === 401 || status === 403) {
    return new InvalidCredentialsError("Serper", detail);
  }
  if (status === 429) {
    // A metered API can answer 429 for either reason; the body is what
    // separates "you are too fast" from "you are out".
    return mentionsCredits
      ? new QuotaExhaustedError("Serper", detail, status)
      : new RateLimitedError("Serper");
  }

  // Last resort: the body says the allowance is gone even though the status
  // did not. Serper reports some plan errors as a 200 with a bare message, and
  // treating that as a generic failure would let the run continue against a
  // dead key.
  if (mentionsCredits) return new QuotaExhaustedError("Serper", detail, status);

  return new Error(`Serper returned ${status}: ${detail}`);
}

export class SerperProvider implements SearchProvider {
  readonly id = "serper";
  readonly label = "Serper";
  readonly countries = null;
  /** Serper's search endpoint is desktop-only. */
  readonly supportsDevice = false;

  constructor(private readonly apiKey = process.env.SERPER_API_KEY ?? "") {}

  async isConfigured(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async search(keyword: string, options: SearchOptions): Promise<SearchResponse> {
    if (!(await this.isConfigured())) {
      throw new Error("SERPER_API_KEY is not set");
    }

    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: keyword,
        gl: options.country.toLowerCase(),
        hl: options.language ?? "en",
        num: Math.min(options.limit ?? 100, 100),
        ...(options.location ? { location: options.location } : {}),
      }),
    });

    if (!response.ok) {
      throw classifyFailure(response.status, await response.text().catch(() => ""));
    }

    const payload = (await response.json()) as SerperResponse;

    // A 200 carrying only a message is still a failure; Serper does this for
    // some plan-level errors.
    if (payload.message && !payload.organic) {
      throw classifyFailure(200, payload.message);
    }

    const results: SearchResult[] = (payload.organic ?? [])
      .filter((item) => item.link)
      .map((item, index) => ({
        position: item.position ?? index + 1,
        url: item.link!,
        title: item.title ?? null,
        description: item.snippet ?? null,
        displayUrl: null,
      }));

    const features: string[] = [];
    if (payload.answerBox) features.push("answer_box");
    if (payload.knowledgeGraph) features.push("knowledge_graph");
    if (payload.peopleAlsoAsk?.length) features.push("people_also_ask");
    if (payload.relatedSearches?.length) features.push("related_searches");
    if (payload.topStories?.length) features.push("top_stories");
    if (payload.images?.length) features.push("images");

    return {
      keyword,
      results,
      features,
      totalResults: payload.searchInformation?.totalResults ?? null,
      source: this.id,
      fetchedAt: new Date(),
    };
  }
}

export { classifyFailure as classifySerperFailure };
