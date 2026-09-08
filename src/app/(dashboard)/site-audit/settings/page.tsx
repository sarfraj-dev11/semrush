import { db } from "@/db";
import { projects } from "@/db/schema";
import { toProjectSlug } from "@/lib/slug-utils";
import { hostnameOf } from "@/lib/utils";
import { SiteAuditSettingsForm } from "./site-audit-settings-form";

export const dynamic = "force-dynamic";

export default async function SiteAuditSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; id?: string }>;
}) {
  const { project: slugParam, id: idParam } = await searchParams;

  const allProjects = await db.select().from(projects).orderBy(projects.name);

  const matchedProject =
    allProjects.find(
      (p) =>
        toProjectSlug(p.name) === slugParam ||
        String(p.id) === idParam ||
        p.domain.toLowerCase().includes(slugParam?.toLowerCase() || "")
    ) || allProjects[0];

  const domain = matchedProject
    ? hostnameOf(matchedProject.domain) || matchedProject.domain
    : "vazautosolutions.com";
  const slug = matchedProject ? toProjectSlug(matchedProject.name) : "vazautosolutions";
  const limit = matchedProject?.crawlLimit ?? 500;

  return (
    <div className="pb-24 pt-1 animate-in">
      <SiteAuditSettingsForm
        initialDomain={domain}
        initialSlug={slug}
        initialLimit={limit}
      />
    </div>
  );
}
