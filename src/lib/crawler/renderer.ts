import { fetchPage, type RequestContext } from "./fetcher";

/**
 * Page rendering.
 *
 * The crawler reads raw HTML, which is what most search and AI crawlers see.
 * Some pages ship an empty shell and build their content with JavaScript; for
 * those, raw HTML is an honest picture of what a non-rendering crawler gets,
 * but a useless picture of what the page actually says.
 *
 * So rendering is a strategy rather than a switch, and it is applied
 * selectively: a page is only re-rendered once the raw fetch shows it is a
 * JS-only shell. Rendering everything would multiply crawl cost for pages that
 * did not need it, and hide the very problem worth reporting.
 */

export type RenderOptions = {
  timeoutMs?: number;
  userAgent?: string;
  acceptLanguage?: string;
  context?: RequestContext;
};

export type RenderResult = {
  html: string | null;
  statusCode: number | null;
  finalUrl: string;
  /** True when JavaScript actually executed before the HTML was captured. */
  renderedWithJs: boolean;
  error: string | null;
};

export type ConsoleEntry = {
  level: "error" | "warning";
  text: string;
};

export type FailedRequest = {
  url: string;
  /** Null when the request failed before any response arrived. */
  status: number | null;
  reason: string | null;
};

export type AxeViolation = {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  help: string;
  helpUrl: string;
  /** CSS selectors of the offending elements, capped by the collector. */
  nodes: string[];
};

/**
 * What a page does while it loads, as opposed to what it contains. Only a real
 * browser can report any of this, so it is separated from `render` — a renderer
 * may be able to produce HTML without being able to observe execution.
 */
export type RenderDiagnostics = {
  console: ConsoleEntry[];
  failedRequests: FailedRequest[];
  /** Null when accessibility analysis was not requested or not available. */
  axeViolations: AxeViolation[] | null;
};

export type DiagnosticsResult = {
  diagnostics: RenderDiagnostics | null;
  error: string | null;
};

export type DiagnoseOptions = RenderOptions & {
  /** Injects axe-core and runs it. Materially slower, so it is opt-in. */
  includeAccessibility?: boolean;
};

export interface Renderer {
  readonly id: string;
  readonly label: string;
  readonly rendersJavaScript: boolean;
  /** True when `diagnose` can return anything meaningful. */
  readonly supportsDiagnostics: boolean;
  render(url: string, options?: RenderOptions): Promise<RenderResult>;
  diagnose?(url: string, options?: DiagnoseOptions): Promise<DiagnosticsResult>;
  close?(): Promise<void>;
}

/** The default: exactly what the crawler already does. */
export class RawFetchRenderer implements Renderer {
  readonly id = "raw";
  readonly label = "Raw HTML";
  readonly rendersJavaScript = false;
  // Nothing executes, so there is nothing to observe.
  readonly supportsDiagnostics = false;

  async render(url: string, options: RenderOptions = {}): Promise<RenderResult> {
    const outcome = await fetchPage(url, {
      userAgent: options.userAgent,
      timeoutMs: options.timeoutMs,
      context: options.context,
    });

    return {
      html: outcome.html,
      statusCode: outcome.statusCode,
      finalUrl: outcome.finalUrl,
      renderedWithJs: false,
      error: outcome.error,
    };
  }
}

/**
 * Talks to an external rendering endpoint — Browserless, a self-hosted Chrome,
 * or any service that accepts a URL and returns post-JavaScript HTML. Keeping
 * this out of process is why no browser binary has to be installed here.
 */
export class RemoteRenderer implements Renderer {
  readonly id = "remote";
  readonly label: string;
  readonly rendersJavaScript = true;
  readonly supportsDiagnostics: boolean;

  constructor(
    private readonly endpoint: string,
    private readonly token: string | null = null,
    /**
     * A Browserless-compatible `/function` endpoint, which runs supplied code
     * with a `page` handle. Content endpoints return HTML only, so without this
     * the browser can render but not report what happened while it did.
     */
    private readonly functionEndpoint: string | null = null,
  ) {
    this.label = `Remote renderer (${new URL(endpoint).host})`;
    this.supportsDiagnostics = Boolean(functionEndpoint);
  }

  async render(url: string, options: RenderOptions = {}): Promise<RenderResult> {
    const timeoutMs = options.timeoutMs ?? 30_000;

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({
          url,
          gotoOptions: { waitUntil: "networkidle2", timeout: timeoutMs },
          userAgent: options.userAgent,
          ...(options.acceptLanguage
            ? { setExtraHTTPHeaders: { "Accept-Language": options.acceptLanguage } }
            : {}),
        }),
      });

      if (!response.ok) {
        return {
          html: null,
          statusCode: response.status,
          finalUrl: url,
          renderedWithJs: false,
          error: `Renderer returned ${response.status}`,
        };
      }

      return {
        html: await response.text(),
        statusCode: 200,
        finalUrl: url,
        renderedWithJs: true,
        error: null,
      };
    } catch (error) {
      return {
        html: null,
        statusCode: null,
        finalUrl: url,
        renderedWithJs: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async diagnose(
    url: string,
    options: DiagnoseOptions = {},
  ): Promise<DiagnosticsResult> {
    if (!this.functionEndpoint) {
      return { diagnostics: null, error: "Renderer has no function endpoint" };
    }

    const timeoutMs = options.timeoutMs ?? 45_000;

    // axe is injected as source rather than fetched by the page, so it works
    // against sites with a restrictive CSP and needs no outbound access from
    // the browser. It is only sent when asked for — it is ~600KB per request.
    let axeSource: string | null = null;
    if (options.includeAccessibility) {
      try {
        const axe = (await import("axe-core")) as unknown as {
          source?: string;
          default?: { source?: string };
        };
        axeSource = axe.source ?? axe.default?.source ?? null;
      } catch {
        axeSource = null;
      }
    }

    try {
      const response = await fetch(this.functionEndpoint, {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({
          code: DIAGNOSTICS_SCRIPT,
          context: {
            url,
            timeoutMs,
            userAgent: options.userAgent ?? null,
            acceptLanguage: options.acceptLanguage ?? null,
            axeSource,
          },
        }),
      });

      if (!response.ok) {
        return {
          diagnostics: null,
          error: `Renderer function returned ${response.status}`,
        };
      }

      const payload = (await response.json()) as {
        data?: RenderDiagnostics;
      } & Partial<RenderDiagnostics>;

      // Browserless wraps the return value in `data`; a bare function endpoint
      // may return it directly.
      const data = payload.data ?? (payload as RenderDiagnostics);

      return {
        diagnostics: {
          console: data.console ?? [],
          failedRequests: data.failedRequests ?? [],
          axeViolations: data.axeViolations ?? null,
        },
        error: null,
      };
    } catch (error) {
      return {
        diagnostics: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Runs inside the rendering service against a Puppeteer `page`. Kept as a
 * string because it executes in that process, not this one.
 */
const DIAGNOSTICS_SCRIPT = `
export default async function ({ page, context }) {
  const { url, timeoutMs, userAgent, acceptLanguage, axeSource } = context;
  const consoleEntries = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    const level = msg.type();
    if (level === 'error' || level === 'warning') {
      consoleEntries.push({ level, text: String(msg.text()).slice(0, 500) });
    }
  });
  page.on('pageerror', (err) => {
    consoleEntries.push({ level: 'error', text: String((err && err.message) || err).slice(0, 500) });
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure && req.failure();
    failedRequests.push({ url: req.url(), status: null, reason: (failure && failure.errorText) || null });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      failedRequests.push({ url: res.url(), status: res.status(), reason: null });
    }
  });

  if (userAgent) await page.setUserAgent(userAgent);
  if (acceptLanguage) await page.setExtraHTTPHeaders({ 'Accept-Language': acceptLanguage });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs });

  let axeViolations = null;
  if (axeSource) {
    await page.evaluate(axeSource);
    axeViolations = await page.evaluate(async () => {
      const results = await window.axe.run(document, { resultTypes: ['violations'] });
      return results.violations.map((v) => ({
        id: v.id,
        impact: v.impact || null,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
      }));
    });
  }

  return {
    data: {
      console: consoleEntries.slice(0, 50),
      failedRequests: failedRequests.slice(0, 50),
      axeViolations,
    },
    type: 'application/json',
  };
}
`;

/**
 * Reads the configured renderer. Absent configuration means raw HTML, so the
 * crawler keeps working with nothing set up.
 */
export function getRenderer(config: {
  endpoint?: string | null;
  token?: string | null;
  functionEndpoint?: string | null;
}): Renderer {
  const endpoint = config.endpoint ?? process.env.CRAWLER_RENDER_URL ?? null;
  if (!endpoint) return new RawFetchRenderer();

  try {
    return new RemoteRenderer(
      endpoint,
      config.token ?? process.env.CRAWLER_RENDER_TOKEN ?? null,
      config.functionEndpoint ?? process.env.CRAWLER_RENDER_FUNCTION_URL ?? null,
    );
  } catch {
    // A malformed endpoint should degrade to raw HTML, not kill the crawl.
    return new RawFetchRenderer();
  }
}
