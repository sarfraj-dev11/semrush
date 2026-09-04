import { Agent, type Dispatcher } from "undici";
import { BOT_IDENTITY, headersFor, type IdentityProfile } from "./identity";
import type { ProxyEndpoint, ProxyPool } from "./proxy";
import type { FetchOutcome } from "./types";

export const DEFAULT_USER_AGENT =
  "SEOConsoleBot/1.0 (+internal site audit; respects robots.txt)";

// Persistent high-performance socket pool with TCP Keep-Alive
const globalCrawlerAgent = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  pipelining: 1,
  connections: 50,
});

/**
 * Everything a request needs beyond its URL. Passed through every fetch helper
 * so proxy routing and identity selection are decided once, at the top.
 */
export type RequestContext = {
  identity?: IdentityProfile;
  acceptLanguage?: string;
  auth?: { user: string; pass: string } | null;
  /** Chosen by the caller from the pool, so rotation policy lives in one place. */
  proxy?: ProxyEndpoint | null;
  pool?: ProxyPool | null;
};

/** undici accepts a dispatcher per request; this is where a proxy takes effect. */
function dispatcherFor(context: RequestContext | undefined): Dispatcher | undefined {
  if (context?.proxy && context.pool) {
    return context.pool.dispatcherFor(context.proxy);
  }
  return globalCrawlerAgent;
}

function requestHeaders(
  context: RequestContext | undefined,
  fallbackUserAgent: string,
): Record<string, string> {
  const baseHeaders = context?.identity
    ? headersFor(context.identity, {
        acceptLanguage: context.acceptLanguage,
      })
    : headersFor(
        { ...BOT_IDENTITY, userAgent: fallbackUserAgent },
        { acceptLanguage: context?.acceptLanguage },
      );

  const auth = context?.auth;
  if (auth?.user && auth.pass) {
    const creds = Buffer.from(`${auth.user}:${auth.pass}`).toString("base64");
    baseHeaders["authorization"] = `Basic ${creds}`;
  }

  return baseHeaders;
}

/**
 * Distinguishes "this proxy is broken" from "this site said no". A proxy fault
 * is worth benching the proxy over; a 403 from the origin is not — that is the
 * site's answer, and swapping IPs to get a different one is exactly the
 * behaviour this crawler does not implement.
 */
export function isProxyFault(statusCode: number | null, error: string | null): boolean {
  if (statusCode === 407) return true;
  if (statusCode !== null) return false;
  if (!error) return false;
  return /ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|socket hang up|proxy/i.test(
    error,
  );
}

export const FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;
/** Beyond this the HTML is almost certainly not a page worth parsing. */
const MAX_HTML_BYTES = 5_000_000;

function isHtml(contentType: string | null) {
  return Boolean(contentType && /text\/html|application\/xhtml/i.test(contentType));
}

function collectHeaders(response: Response): Record<string, string> {
  const out: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

/**
 * Follows redirects by hand so the chain length is observable — the audit
 * reports it, and `fetch`'s automatic mode hides it.
 */
export async function fetchPage(
  url: string,
  options: {
    userAgent?: string;
    timeoutMs?: number;
    context?: RequestContext;
  } = {},
): Promise<FetchOutcome> {
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const startedAt = Date.now();
  const headers = requestHeaders(options.context, userAgent);
  const dispatcher = dispatcherFor(options.context);

  let current = url;
  let redirectChain = 0;
  let redirectTo: string | null = null;

  try {
    for (;;) {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers,
        ...(dispatcher ? { dispatcher } : {}),
      } as RequestInit);

      const location = response.headers.get("location");
      const isRedirect = response.status >= 300 && response.status < 400;

      if (isRedirect && location) {
        if (redirectChain >= MAX_REDIRECTS) {
          return {
            requestedUrl: url,
            finalUrl: current,
            statusCode: response.status,
            contentType: null,
            html: null,
            redirectChain,
            redirectTo: location,
            responseTimeMs: Date.now() - startedAt,
            sizeBytes: null,
            headers: collectHeaders(response),
            error: `Too many redirects (over ${MAX_REDIRECTS})`,
          };
        }

        const next = new URL(location, current).toString();
        redirectChain++;
        redirectTo = next;
        current = next;
        // Drain the body so the socket can be reused.
        await response.arrayBuffer().catch(() => undefined);
        continue;
      }

      const contentType = response.headers.get("content-type");
      let html: string | null = null;
      let sizeBytes: number | null = null;

      if (isHtml(contentType) && response.ok) {
        const buffer = await response.arrayBuffer();
        sizeBytes = buffer.byteLength;
        html =
          buffer.byteLength > MAX_HTML_BYTES
            ? null
            : new TextDecoder("utf-8").decode(buffer);
      } else {
        const length = response.headers.get("content-length");
        sizeBytes = length ? Number(length) : null;
        await response.arrayBuffer().catch(() => undefined);
      }

      return {
        requestedUrl: url,
        finalUrl: current,
        statusCode: response.status,
        contentType,
        html,
        redirectChain,
        redirectTo: redirectChain > 0 ? redirectTo : null,
        responseTimeMs: Date.now() - startedAt,
        sizeBytes,
        headers: collectHeaders(response),
        error: null,
      };
    }
  } catch (error) {
    const message = describeFetchError(error, timeoutMs);

    return {
      requestedUrl: url,
      finalUrl: current,
      statusCode: null,
      contentType: null,
      html: null,
      redirectChain,
      redirectTo,
      responseTimeMs: Date.now() - startedAt,
      sizeBytes: null,
      headers: {},
      error: message,
    };
  }
}

/**
 * Plain-language explanations for the transport failures worth distinguishing.
 * Everything here is a different action for the operator, which is the whole
 * reason for not reporting them all as one message.
 */
const TRANSPORT_ERRORS: Record<string, string> = {
  ENOTFOUND: "Domain does not resolve (DNS)",
  EAI_AGAIN: "DNS lookup failed — the resolver did not answer",
  ECONNREFUSED: "Connection refused by the server",
  ECONNRESET: "Connection reset by the server",
  EHOSTUNREACH: "Host unreachable",
  ETIMEDOUT: "Connection timed out",
  EPROTO: "TLS protocol error",
  CERT_HAS_EXPIRED: "TLS certificate has expired",
  DEPTH_ZERO_SELF_SIGNED_CERT: "TLS certificate is self-signed",
  SELF_SIGNED_CERT_IN_CHAIN: "TLS certificate chain contains a self-signed certificate",
  ERR_TLS_CERT_ALTNAME_INVALID:
    "TLS certificate does not cover this hostname",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE:
    "TLS certificate could not be verified — the server may be omitting an intermediate certificate, or a proxy is re-signing traffic",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY:
    "TLS issuer certificate is not trusted — often a corporate proxy intercepting HTTPS",
};

/**
 * `fetch` reports nearly every transport failure as the string "fetch failed",
 * and puts the part that identifies the problem on `error.cause`. Reporting
 * only the message turns a bad certificate, a refused connection and a dead
 * domain into the same useless line in the audit.
 */
export function describeFetchError(error: unknown, timeoutMs?: number): string {
  if (!(error instanceof Error)) return String(error);

  if (error.name === "TimeoutError" || error.name === "AbortError") {
    return timeoutMs
      ? `Timed out after ${timeoutMs / 1000}s`
      : "Request timed out";
  }

  const cause = error.cause as { code?: string; message?: string } | undefined;
  const code = cause?.code;

  if (code) {
    const explanation = TRANSPORT_ERRORS[code];
    return explanation ? `${explanation} (${code})` : `${error.message} (${code})`;
  }

  // No cause to add — fall back to the message, poor as it may be.
  return cause?.message ? `${error.message}: ${cause.message}` : error.message;
}

/**
 * Cheap liveness probe for URLs we do not want to parse — outbound links,
 * mostly. HEAD first because it costs almost nothing, falling back to a ranged
 * GET for the many servers that answer HEAD with 405 or 501.
 */
export type ProbeResult = {
  statusCode: number | null;
  /** From Content-Range or Content-Length; null when the server omits both. */
  contentLength: number | null;
  contentType: string | null;
  retryAfter: string | null;
  error: string | null;
};

export async function probeUrl(
  url: string,
  options: {
    userAgent?: string;
    timeoutMs?: number;
    context?: RequestContext;
  } = {},
): Promise<ProbeResult> {
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const dispatcher = dispatcherFor(options.context);

  const attempt = async (method: "HEAD" | "GET") => {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": options.context?.identity?.userAgent ?? userAgent,
        Accept: "*/*",
        // Keeps the fallback GET from pulling down whole documents.
        ...(method === "GET" ? { Range: "bytes=0-2047" } : {}),
      },
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
    await response.arrayBuffer().catch(() => undefined);

    // A ranged GET reports the true size in Content-Range, not Content-Length.
    const range = response.headers.get("content-range");
    const totalFromRange = range?.match(/\/(\d+)\s*$/)?.[1];
    const length = totalFromRange ?? response.headers.get("content-length");

    return {
      statusCode: response.status,
      contentLength: length ? Number(length) : null,
      contentType: response.headers.get("content-type"),
      retryAfter: response.headers.get("retry-after"),
      error: null,
    };
  };

  try {
    const head = await attempt("HEAD");
    if (
      head.statusCode !== 405 &&
      head.statusCode !== 501 &&
      head.statusCode !== 403
    ) {
      return head;
    }
    return await attempt("GET");
  } catch (error) {
    const message = describeFetchError(error, timeoutMs);
    return {
      statusCode: null,
      contentLength: null,
      contentType: null,
      retryAfter: null,
      error: message,
    };
  }
}

/** Plain text fetch used for robots.txt, llms.txt and sitemaps. */
export async function fetchText(
  url: string,
  options: {
    userAgent?: string;
    timeoutMs?: number;
    context?: RequestContext;
    auth?: { user: string; pass: string } | null;
  } = {},
): Promise<{
  ok: boolean;
  status: number | null;
  body: string | null;
  contentType: string | null;
}> {
  const dispatcher = dispatcherFor(options.context);

  try {
    const headers: Record<string, string> = {
      "User-Agent":
        options.context?.identity?.userAgent ||
        options.userAgent ||
        DEFAULT_USER_AGENT,
    };
    const auth = options.auth ?? options.context?.auth;
    if (auth?.user && auth.pass) {
      const creds = Buffer.from(`${auth.user}:${auth.pass}`).toString("base64");
      headers["Authorization"] = `Basic ${creds}`;
    }

    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      headers,
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);

    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      await response.arrayBuffer().catch(() => undefined);
      return { ok: false, status: response.status, body: null, contentType };
    }

    return {
      ok: true,
      status: response.status,
      body: await response.text(),
      contentType,
    };
  } catch {
    return { ok: false, status: null, body: null, contentType: null };
  }
}

/**
 * Guards against soft-404s. A great many sites answer every unknown path with
 * their normal HTML page and a 200, so "the request succeeded" is not evidence
 * that robots.txt or llms.txt exists — the body has to actually be text.
 */
export function isPlainTextBody(
  body: string | null,
  contentType: string | null,
): boolean {
  if (!body || body.trim().length === 0) return false;
  if (contentType && /text\/html|application\/xhtml/i.test(contentType)) return false;

  const head = body.slice(0, 512).trimStart().toLowerCase();
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return false;

  return true;
}
