import { fetchPage, isProxyFault, type RequestContext } from "./fetcher";
import { pickIdentity, type DeviceClass, type IdentityProfile } from "./identity";
import type { ProxyPool } from "./proxy";
import type { HostThrottle } from "./throttle";
import type { FetchOutcome } from "./types";

/**
 * Fetching with retry and proxy rotation.
 *
 * The whole design turns on one distinction:
 *
 *   A proxy fault  — 407, connection refused, socket hang up — is our
 *                    infrastructure failing. Bench the proxy, take another,
 *                    retry. The site never saw a valid request.
 *
 *   A site refusal — 403, 429, 503 — is the site's answer. It is retried with
 *                    backoff on the SAME proxy, because retrying from a fresh
 *                    IP is not fault tolerance, it is working around a decision
 *                    the site made. A 429 means slow down, and the throttle
 *                    already does that.
 *
 * Collapsing those two cases is what turns a crawler into something that gets
 * an entire IP range permanently blocked instead of temporarily throttled.
 */

export type ResilientOptions = {
  pool?: ProxyPool | null;
  throttle?: HostThrottle;
  /** ISO 3166-1 country to route through, when the pool has one. */
  country?: string;
  /** Keeps multi-step flows on one IP. */
  sessionKey?: string;
  device?: DeviceClass;
  identityId?: string;
  identityIndex?: number;
  identifyAsBot?: boolean;
  acceptLanguage?: string;
  userAgent?: string;
  timeoutMs?: number;
  auth?: { user: string; pass: string } | null;
  /** Attempts against proxy faults. Site refusals are not retried here. */
  maxProxyRetries?: number;
  /** Attempts against a 429/503, spaced by the throttle's backoff. */
  maxBackoffRetries?: number;
};

export type ResilientResult = {
  outcome: FetchOutcome;
  identity: IdentityProfile;
  proxyId: string | null;
  attempts: number;
  /** True when the pool had no exit node in the requested country. */
  countryUnavailable: boolean;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchWithRotation(
  url: string,
  options: ResilientOptions = {},
): Promise<ResilientResult> {
  const {
    pool,
    throttle,
    country,
    sessionKey,
    device,
    identityId,
    identityIndex = 0,
    identifyAsBot = true,
    acceptLanguage,
    userAgent,
    timeoutMs,
    auth,
    maxProxyRetries = 3,
    maxBackoffRetries = 2,
  } = options;

  const identity = pickIdentity({
    device,
    id: identityId,
    index: identityIndex,
    identifyAsBot,
  });

  let attempts = 0;
  let proxyRetries = 0;
  let backoffRetries = 0;
  let countryUnavailable = false;
  let lastOutcome: FetchOutcome | null = null;
  let lastProxyId: string | null = null;

  for (;;) {
    const proxy = pool?.next({ country, sessionKey }) ?? null;

    if (country && pool && pool.size > 0 && !proxy) {
      // Better to report honestly than silently return a result from the
      // wrong country — that is a wrong answer wearing a right answer's hat.
      countryUnavailable = true;
    }

    const context: RequestContext = { identity, acceptLanguage, proxy, pool, auth };
    lastProxyId = proxy?.id ?? null;
    attempts++;

    const run = () => fetchPage(url, { userAgent, timeoutMs, context });
    const outcome = throttle ? await throttle.run(url, run) : await run();
    lastOutcome = outcome;

    throttle?.observe(url, outcome.statusCode, outcome.headers["retry-after"]);

    /* -- our infrastructure failed: rotate ------------------------------- */
    if (proxy && isProxyFault(outcome.statusCode, outcome.error)) {
      pool?.reportFailure(proxy.id, { hard: outcome.statusCode === 407 });
      if (proxyRetries++ < maxProxyRetries) continue;
      break;
    }

    if (proxy) pool?.reportSuccess(proxy.id);

    /* -- the site asked us to slow down: wait, same proxy ---------------- */
    const rateLimited = outcome.statusCode === 429 || outcome.statusCode === 503;
    if (rateLimited && backoffRetries < maxBackoffRetries) {
      backoffRetries++;
      // Exponential, and the throttle has already pushed this host out.
      await sleep(2_000 * 2 ** (backoffRetries - 1));
      continue;
    }

    break;
  }

  return {
    outcome: lastOutcome!,
    identity,
    proxyId: lastProxyId,
    attempts,
    countryUnavailable,
  };
}
