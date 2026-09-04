import { ProxyAgent, type Dispatcher } from "undici";

/**
 * Proxy pool.
 *
 * Routes outbound requests through a set of exit nodes, with rotation, country
 * targeting and health tracking. Three things this deliberately does NOT do:
 *
 *   - It does not disguise the crawler. Rotation exists so that crawling a
 *     large site from one IP does not look like a single-source flood, and so
 *     localized results can be fetched from the right country. The user agent
 *     still identifies the bot unless explicitly configured otherwise.
 *   - It does not treat a block as something to route around. A hard block
 *     benches that proxy and slows the crawl; it does not trigger an attempt
 *     from a fresh identity.
 *   - It does not replace politeness. Every request still goes through the
 *     HostThrottle, because rotating IPs while hammering a host is still
 *     hammering the host — it just spreads the damage.
 */

export type ProxyType = "datacenter" | "residential" | "mobile";

export type ProxyEndpoint = {
  id: string;
  /** Full proxy URL, e.g. http://user:pass@gate.provider.com:7000 */
  url: string;
  type: ProxyType;
  /** ISO 3166-1 alpha-2 country of the exit node, when the provider states it. */
  country: string | null;
  label?: string;
};

export type RotationStrategy =
  /** A different proxy for every request. */
  | "per-request"
  /** The same proxy for all requests sharing a session key, until it expires. */
  | "sticky"
  /** Always the first healthy proxy — useful when a provider rotates for you. */
  | "none";

export type ProxyPoolOptions = {
  strategy: RotationStrategy;
  /** How long a sticky session keeps its proxy. */
  stickyTtlMs: number;
  /** How long a failing proxy sits out before being tried again. */
  cooldownMs: number;
  /** Consecutive failures before a proxy is benched. */
  failureThreshold: number;
  /**
   * When a country is requested but no proxy matches, fall back to any healthy
   * proxy. Off by default: silently returning the wrong country turns a
   * localized result into a wrong answer with no warning.
   */
  allowCountryFallback: boolean;
};

export const DEFAULT_POOL_OPTIONS: ProxyPoolOptions = {
  strategy: "per-request",
  stickyTtlMs: 5 * 60_000,
  cooldownMs: 60_000,
  failureThreshold: 3,
  allowCountryFallback: false,
};

type ProxyHealth = {
  consecutiveFailures: number;
  /** Timestamp before which this proxy is not offered. */
  benchedUntil: number;
  successes: number;
  failures: number;
};

type StickySession = {
  proxyId: string;
  expiresAt: number;
};

export class ProxyPool {
  private readonly endpoints: ProxyEndpoint[];
  private readonly options: ProxyPoolOptions;
  private readonly health = new Map<string, ProxyHealth>();
  private readonly sessions = new Map<string, StickySession>();
  private readonly dispatchers = new Map<string, ProxyAgent>();
  private cursor = 0;

  constructor(
    endpoints: ProxyEndpoint[],
    options: Partial<ProxyPoolOptions> = {},
  ) {
    this.endpoints = endpoints;
    this.options = { ...DEFAULT_POOL_OPTIONS, ...options };
    for (const endpoint of endpoints) {
      this.health.set(endpoint.id, {
        consecutiveFailures: 0,
        benchedUntil: 0,
        successes: 0,
        failures: 0,
      });
    }
  }

  get size() {
    return this.endpoints.length;
  }

  /** Countries this pool can actually reach from. */
  get countries(): string[] {
    return [
      ...new Set(
        this.endpoints
          .map((endpoint) => endpoint.country)
          .filter((country): country is string => Boolean(country)),
      ),
    ].sort();
  }

  private isAvailable(endpoint: ProxyEndpoint, now: number): boolean {
    const health = this.health.get(endpoint.id);
    return !health || health.benchedUntil <= now;
  }

  /**
   * Picks the next proxy. Returns null when the pool is empty or nothing
   * matches the requested country — callers must treat null as "go direct or
   * fail", never as "try again without the constraint".
   */
  next(request: { country?: string; sessionKey?: string } = {}): ProxyEndpoint | null {
    if (this.endpoints.length === 0) return null;
    const now = Date.now();

    /* -- sticky sessions ------------------------------------------------- */
    if (this.options.strategy === "sticky" && request.sessionKey) {
      const existing = this.sessions.get(request.sessionKey);
      if (existing && existing.expiresAt > now) {
        const endpoint = this.endpoints.find((e) => e.id === existing.proxyId);
        if (endpoint && this.isAvailable(endpoint, now)) return endpoint;
        // The pinned proxy died; fall through and pin a new one.
        this.sessions.delete(request.sessionKey);
      }
    }

    /* -- candidate set --------------------------------------------------- */
    let candidates = this.endpoints.filter((endpoint) =>
      this.isAvailable(endpoint, now),
    );

    if (request.country) {
      const inCountry = candidates.filter(
        (endpoint) => endpoint.country === request.country,
      );
      if (inCountry.length > 0) {
        candidates = inCountry;
      } else if (!this.options.allowCountryFallback) {
        return null;
      }
    }

    if (candidates.length === 0) return null;

    /* -- selection ------------------------------------------------------- */
    const chosen =
      this.options.strategy === "none"
        ? candidates[0]
        : candidates[this.cursor++ % candidates.length];

    if (this.options.strategy === "sticky" && request.sessionKey) {
      this.sessions.set(request.sessionKey, {
        proxyId: chosen.id,
        expiresAt: now + this.options.stickyTtlMs,
      });
    }

    return chosen;
  }

  /** An undici dispatcher for this proxy, cached so connections are reused. */
  dispatcherFor(endpoint: ProxyEndpoint): Dispatcher {
    let agent = this.dispatchers.get(endpoint.id);
    if (!agent) {
      agent = new ProxyAgent({ uri: endpoint.url });
      this.dispatchers.set(endpoint.id, agent);
    }
    return agent;
  }

  reportSuccess(proxyId: string) {
    const health = this.health.get(proxyId);
    if (!health) return;
    health.consecutiveFailures = 0;
    health.successes++;
  }

  /**
   * `hard` marks an outright rejection (407, 403, connection refused) rather
   * than a timeout, and benches the proxy immediately.
   */
  reportFailure(proxyId: string, options: { hard?: boolean } = {}) {
    const health = this.health.get(proxyId);
    if (!health) return;

    health.failures++;
    health.consecutiveFailures++;

    if (options.hard || health.consecutiveFailures >= this.options.failureThreshold) {
      // Bench for longer each time a proxy keeps failing, up to ten minutes.
      const multiplier = Math.min(10, health.consecutiveFailures);
      health.benchedUntil = Date.now() + this.options.cooldownMs * multiplier;
    }
  }

  /** Frees a sticky session early, e.g. once a multi-step flow finishes. */
  releaseSession(sessionKey: string) {
    this.sessions.delete(sessionKey);
  }

  stats() {
    const now = Date.now();
    return this.endpoints.map((endpoint) => {
      const health = this.health.get(endpoint.id)!;
      return {
        id: endpoint.id,
        type: endpoint.type,
        country: endpoint.country,
        benched: health.benchedUntil > now,
        successes: health.successes,
        failures: health.failures,
      };
    });
  }

  /** Releases every pooled connection. Call when a crawl finishes. */
  async close() {
    await Promise.all([...this.dispatchers.values()].map((agent) => agent.close()));
    this.dispatchers.clear();
  }
}

/**
 * Parses the stored proxy configuration. One endpoint per line:
 *
 *   residential:GB:http://user:pass@gate.provider.com:7000
 *   datacenter::http://10.0.0.5:3128
 *
 * Blank lines and lines starting with # are ignored, so a config can be
 * commented.
 */
export function parseProxyConfig(raw: string | null | undefined): ProxyEndpoint[] {
  if (!raw) return [];

  const endpoints: ProxyEndpoint[] = [];
  const lines = raw.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = /^(datacenter|residential|mobile):([A-Za-z]{2})?:(.+)$/.exec(trimmed);
    if (!match) continue;

    const [, type, country, url] = match;
    try {
      // Validates the URL and normalises it.
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) continue;

      endpoints.push({
        id: `${type}-${index}`,
        url: parsed.toString(),
        type: type as ProxyType,
        country: country ? country.toUpperCase() : null,
        label: `${type}${country ? ` ${country.toUpperCase()}` : ""} ${parsed.host}`,
      });
    } catch {
      // A malformed line is skipped rather than failing the whole config.
    }
  }

  return endpoints;
}
