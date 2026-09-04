/**
 * Per-host politeness.
 *
 * Every outbound request in the crawler goes through here. The rules are the
 * ones that keep a crawler welcome:
 *
 *   1. Never more than N requests in flight against one host.
 *   2. Never two requests to one host closer together than `minIntervalMs`.
 *   3. Add jitter, so a burst of workers does not settle into a machine-gun
 *      rhythm that looks like an attack to a WAF.
 *   4. Obey robots.txt Crawl-delay when the site states one.
 *   5. When a host answers 429 or 503, slow that host down immediately and
 *      honour Retry-After. Recover gradually, never instantly.
 *
 * Limits are tracked per host, so crawling a site and probing its outbound
 * links never compete for the same budget.
 */

export type ThrottleOptions = {
  /** Requests in flight per host. */
  maxConcurrentPerHost: number;
  /** Floor on the gap between two requests to the same host. */
  minIntervalMs: number;
  /** Random extra delay, 0..jitterMs, added to every gap. */
  jitterMs: number;
  /** Ceiling the adaptive backoff will not exceed. */
  maxIntervalMs: number;
};

export const DEFAULT_THROTTLE: ThrottleOptions = {
  maxConcurrentPerHost: 4,
  minIntervalMs: 200,
  jitterMs: 50,
  maxIntervalMs: 30_000,
};

type HostState = {
  active: number;
  /** Earliest timestamp at which the next request may start. */
  nextAt: number;
  /** Current interval, raised by penalties and decayed by successes. */
  intervalMs: number;
  /** Interval this host started at, the floor for recovery. */
  baseIntervalMs: number;
  consecutiveOk: number;
  penalties: number;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export class HostThrottle {
  private readonly options: ThrottleOptions;
  private readonly hosts = new Map<string, HostState>();
  /** Hosts whose interval was raised by robots.txt Crawl-delay. */
  private readonly crawlDelays = new Map<string, number>();

  constructor(options: Partial<ThrottleOptions> = {}) {
    this.options = { ...DEFAULT_THROTTLE, ...options };
  }

  /**
   * Applies a robots.txt Crawl-delay. A site asking for 10 seconds gets 10
   * seconds — this raises the floor and never lowers it.
   */
  setCrawlDelay(url: string, seconds: number | null | undefined) {
    if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return;
    const host = hostOf(url);
    const ms = Math.min(seconds * 1000, this.options.maxIntervalMs);
    this.crawlDelays.set(host, ms);

    const state = this.hosts.get(host);
    if (state) {
      state.baseIntervalMs = Math.max(state.baseIntervalMs, ms);
      state.intervalMs = Math.max(state.intervalMs, ms);
    }
  }

  private stateFor(host: string): HostState {
    let state = this.hosts.get(host);
    if (!state) {
      const base = Math.max(
        this.options.minIntervalMs,
        this.crawlDelays.get(host) ?? 0,
      );
      state = {
        active: 0,
        nextAt: 0,
        intervalMs: base,
        baseIntervalMs: base,
        consecutiveOk: 0,
        penalties: 0,
      };
      this.hosts.set(host, state);
    }
    return state;
  }

  /**
   * Runs `task` once this host has a free slot and its interval has elapsed.
   * Slots are released even when the task throws, so one failure cannot wedge
   * a host permanently.
   */
  async run<T>(url: string, task: () => Promise<T>): Promise<T> {
    const host = hostOf(url);
    const state = this.stateFor(host);

    for (;;) {
      const now = Date.now();
      if (state.active < this.options.maxConcurrentPerHost && now >= state.nextAt) {
        state.active++;
        const jitter = Math.floor(Math.random() * this.options.jitterMs);
        state.nextAt = now + state.intervalMs + jitter;
        break;
      }
      // Short polls keep the wait responsive when another worker finishes early.
      await sleep(Math.max(10, Math.min(state.nextAt - now, 200)));
    }

    try {
      return await task();
    } finally {
      state.active--;
    }
  }

  /**
   * Called after a response. 429 and 503 mean "you are going too fast" — the
   * interval doubles and the host is parked for Retry-After if it sent one.
   */
  observe(
    url: string,
    statusCode: number | null,
    retryAfterHeader?: string | null,
  ) {
    const state = this.stateFor(hostOf(url));

    const rejected = statusCode === 429 || statusCode === 503;
    if (rejected) {
      state.penalties++;
      state.consecutiveOk = 0;
      state.intervalMs = Math.min(
        this.options.maxIntervalMs,
        Math.max(state.intervalMs * 2, 1000),
      );

      const retryAfterMs = parseRetryAfter(retryAfterHeader);
      state.nextAt = Math.max(
        state.nextAt,
        Date.now() + (retryAfterMs ?? state.intervalMs),
      );
      return;
    }

    if (statusCode !== null && statusCode < 400) {
      state.consecutiveOk++;
      // Ease off only after a sustained clean run, and only part-way.
      if (state.consecutiveOk >= 10 && state.intervalMs > state.baseIntervalMs) {
        state.intervalMs = Math.max(
          state.baseIntervalMs,
          Math.round(state.intervalMs * 0.8),
        );
        state.consecutiveOk = 0;
      }
    }
  }

  /** True once a host has pushed back repeatedly — worth reporting. */
  isStruggling(url: string): boolean {
    return (this.hosts.get(hostOf(url))?.penalties ?? 0) >= 3;
  }

  stats(): { host: string; intervalMs: number; penalties: number }[] {
    return [...this.hosts.entries()].map(([host, state]) => ({
      host,
      intervalMs: state.intervalMs,
      penalties: state.penalties,
    }));
  }
}

/** Retry-After is either delta-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null | undefined): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}
