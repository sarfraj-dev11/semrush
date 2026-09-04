/**
 * Environment configuration, read once and validated.
 *
 * Every optional integration is a feature that is either on or off, and the UI
 * needs to know which so it can say "connect a PageSpeed key" instead of
 * rendering an empty chart. Reading process.env in twenty places made that
 * impossible to answer in one place; this is that place.
 *
 * In production a missing DATABASE_URL fails at import time with a message
 * naming the variable, rather than silently writing to a SQLite file inside
 * the container that disappears on the next deploy.
 */

const isProduction = process.env.NODE_ENV === "production";

function optional(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function databaseUrl(): string {
  const value = optional("DATABASE_URL");
  if (value) return value;
  // `next build` sets NODE_ENV=production but deployments often inject secrets
  // only at runtime; failing the build would block exactly those setups.
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (isProduction && !isBuild) {
    throw new Error(
      "DATABASE_URL is not set. Production needs an explicit database — " +
        "a libsql/Turso URL, or file:/absolute/path/app.db on persistent storage.",
    );
  }
  return "file:./data/app.db";
}

export const env = {
  isProduction,

  DATABASE_URL: databaseUrl(),
  DATABASE_AUTH_TOKEN: optional("DATABASE_AUTH_TOKEN"),

  PAGESPEED_API_KEY: optional("PAGESPEED_API_KEY"),

  SEARCH_PROVIDER: optional("SEARCH_PROVIDER"),
  SERPER_API_KEY: optional("SERPER_API_KEY"),
  SERPAPI_KEY: optional("SERPAPI_KEY"),
  DATAFORSEO_LOGIN: optional("DATAFORSEO_LOGIN"),
  DATAFORSEO_PASSWORD: optional("DATAFORSEO_PASSWORD"),

  GSC_CLIENT_ID: optional("GSC_CLIENT_ID"),
  GSC_CLIENT_SECRET: optional("GSC_CLIENT_SECRET"),
  GSC_REFRESH_TOKEN: optional("GSC_REFRESH_TOKEN"),

  CRAWLER_PROXIES: optional("CRAWLER_PROXIES"),
  CRAWLER_RENDER_URL: optional("CRAWLER_RENDER_URL"),
} as const;

/**
 * Which integrations are usable right now. Pages use these to decide between
 * showing a measurement and explaining what would enable one.
 */
export const features = {
  pagespeed: env.PAGESPEED_API_KEY !== null,
  search:
    env.SERPER_API_KEY !== null ||
    env.SERPAPI_KEY !== null ||
    (env.DATAFORSEO_LOGIN !== null && env.DATAFORSEO_PASSWORD !== null),
  searchConsole:
    env.GSC_CLIENT_ID !== null &&
    env.GSC_CLIENT_SECRET !== null &&
    env.GSC_REFRESH_TOKEN !== null,
  proxies: env.CRAWLER_PROXIES !== null,
  jsRendering: env.CRAWLER_RENDER_URL !== null,
} as const;
