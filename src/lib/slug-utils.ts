export function toProjectSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Top-level pages that are not projects.
 *
 * `[project]` sits at the root of the dashboard, so it matches any first
 * segment that is not a literal route. Anything reading a project slug off the
 * URL has to consult this list, or `/domain-overview` reads as a project named
 * "domain-overview" — which is how the sidebar came to build project links like
 * `/domain-overview/keywords`.
 *
 * Lives here rather than in slugs.ts because the sidebar is a client component
 * and slugs.ts pulls in the database.
 *
 * Keep in step with the directories under `src/app/(dashboard)/`.
 */
export const RESERVED_SEGMENTS = new Set([
  "backlink-gap",
  "clients",
  "compare-domains",
  "domain-overview",
  "imports",
  "jobs",
  "keyword-gap",
  "keyword-overview",
  "position-tracking",
  "projects",
  "settings",
  "site-audit",
]);

export function isReservedSegment(segment: string): boolean {
  return RESERVED_SEGMENTS.has(segment.toLowerCase().trim());
}
