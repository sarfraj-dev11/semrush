import { pool } from "./link-checker";
import type { RenderDiagnostics, Renderer } from "./renderer";
import type { HostThrottle } from "./throttle";

/**
 * Browser probe.
 *
 * Loads pages in a real browser and records what happened while they loaded.
 * This is transport, not analysis: the console bot and the accessibility bot
 * both read from one visit rather than each opening the page themselves, which
 * matters because a browser visit is by far the most expensive thing the
 * crawler can do.
 */

export type BrowserProbeTarget = {
  pageId: number;
  url: string;
};

export type BrowserProbeResult = {
  diagnosticsByPage: Map<number, RenderDiagnostics>;
  checked: number;
  failed: number;
  /** False when no renderer capable of reporting diagnostics is configured. */
  available: boolean;
  /** Why it is unavailable, for surfacing in the UI rather than silence. */
  unavailableReason: string | null;
};

export type BrowserProbeOptions = {
  limit?: number;
  concurrency?: number;
  timeoutMs?: number;
  throttle?: HostThrottle;
  isCancelled?: () => boolean;
  /** Adds an axe-core pass to the same visit. */
  includeAccessibility?: boolean;
  userAgent?: string;
};

export async function collectBrowserDiagnostics(
  targets: BrowserProbeTarget[],
  renderer: Renderer,
  options: BrowserProbeOptions = {},
): Promise<BrowserProbeResult> {
  const {
    limit = 20,
    // A browser visit is heavy and the target host is the same for all of
    // them, so this stays deliberately low.
    concurrency = 2,
    timeoutMs = 45_000,
    throttle,
    isCancelled,
    includeAccessibility = false,
    userAgent,
  } = options;

  const diagnosticsByPage = new Map<number, RenderDiagnostics>();

  if (!renderer.supportsDiagnostics || !renderer.diagnose) {
    return {
      diagnosticsByPage,
      checked: 0,
      failed: 0,
      available: false,
      unavailableReason: renderer.rendersJavaScript
        ? `${renderer.label} can render pages but not report execution — set CRAWLER_RENDER_FUNCTION_URL`
        : "No JavaScript-capable renderer configured — set CRAWLER_RENDER_URL",
    };
  }

  const sample = targets.slice(0, limit);
  let checked = 0;
  let failed = 0;

  await pool(sample, concurrency, async (target) => {
    if (isCancelled?.()) return;

    const run = () =>
      renderer.diagnose!(target.url, {
        timeoutMs,
        includeAccessibility,
        userAgent,
      });

    const result = throttle ? await throttle.run(target.url, run) : await run();

    if (!result.diagnostics || result.error) {
      failed++;
      return;
    }

    checked++;
    diagnosticsByPage.set(target.pageId, result.diagnostics);
  });

  return {
    diagnosticsByPage,
    checked,
    failed,
    available: true,
    unavailableReason: null,
  };
}
