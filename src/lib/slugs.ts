import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, projects } from "@/db/schema";
import { toProjectSlug } from "./slug-utils";

export { toProjectSlug };

// Defined in slug-utils so client components can share the same list.
export { isReservedSegment, RESERVED_SEGMENTS } from "./slug-utils";

export async function findProjectBySlugOrId(slugOrId: string) {
  try {
    const rows = await db
      .select({
        project: projects,
        client: clients,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id));

    if (!slugOrId) {
      if (rows.length > 0) return { ...rows[0].project, client: rows[0].client };
      return null;
    }

    // Try matching numeric id first
    const numericId = parseInt(slugOrId, 10);
    if (!isNaN(numericId) && String(numericId) === slugOrId) {
      const byId = rows.find((r) => r.project.id === numericId);
      if (byId) return { ...byId.project, client: byId.client };
    }

    // Match by generated slug from project name or domain
    const normalized = decodeURIComponent(slugOrId).toLowerCase().trim();
    const matched = rows.find((r) => {
      const nameSlug = toProjectSlug(r.project.name);
      const host = r.project.domain
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .toLowerCase();
      const domainClean = host.replace(/\./g, "-");
      const domainSlug = toProjectSlug(domainClean);
      const rawDomainClean = r.project.domain.toLowerCase();

      return (
        nameSlug === normalized ||
        domainSlug === normalized ||
        host === normalized ||
        host.replace(/^www\./, "") === normalized.replace(/^www\./, "") ||
        toProjectSlug(host) === normalized ||
        r.project.name.toLowerCase() === normalized ||
        rawDomainClean.includes(normalized) ||
        normalized.includes(nameSlug)
      );
    });

    if (matched) {
      return { ...matched.project, client: matched.client };
    }

    /*
     * No match: return null so the caller can 404.
     *
     * This previously fell back to the first project, and then to a fabricated
     * one carrying `id: 1`. Both were worse than a 404 in the same way — every
     * page keyed off that id, so an unrecognised URL rendered project 1's real
     * keywords, crawls and rankings under a domain name taken from the URL.
     * A visitor could not tell the difference between data about their site and
     * data about someone else's.
     */
    return null;
  } catch (err) {
    console.error("❌ Error finding project by slug or ID:", err);
    return null;
  }
}
