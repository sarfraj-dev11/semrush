import { eq, inArray } from "drizzle-orm";
import { ExternalLink, Link2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { db } from "@/db";
import { backlinks, projects } from "@/db/schema";
import { hostnameOf } from "@/lib/utils";
import { CompareDomainsForm } from "../compare-domains/compare-form";

export const dynamic = "force-dynamic";

export default async function BacklinkGapPage({
  searchParams,
}: {
  searchParams: Promise<{ domains?: string }>;
}) {
  const { domains: domainQuery = "" } = await searchParams;

  const allProjects = await db
    .select({ id: projects.id, name: projects.name, domain: projects.domain })
    .from(projects)
    .orderBy(projects.name);

  const defaultDomain = allProjects[0]
    ? hostnameOf(allProjects[0].domain) || allProjects[0].domain
    : "";
  const domainList = domainQuery
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  const primaryDomain = domainList[0] || defaultDomain;
  const competitorDomains = domainList.slice(1);

  const primaryProject = allProjects.find(
    (p) =>
      hostnameOf(p.domain).toLowerCase() === primaryDomain.toLowerCase() ||
      p.domain.toLowerCase().includes(primaryDomain.toLowerCase()),
  );

  const compProjects = allProjects.filter((p) =>
    competitorDomains.some(
      (cd) =>
        hostnameOf(p.domain).toLowerCase() === cd.toLowerCase() ||
        p.domain.toLowerCase().includes(cd.toLowerCase()),
    ),
  );

  // Find real prospect domains:
  // Domains linking to competitor projects that DO NOT link to the primary project
  const prospectRows: {
    domain: string;
    targetUrl: string;
    anchorText: string | null;
    isFollow: boolean;
    domainRating: number | null;
    linkedCompetitor: string;
  }[] = [];

  if (primaryProject && compProjects.length > 0) {
    const primaryBacklinks = await db
      .select({ sourceDomain: backlinks.sourceDomain })
      .from(backlinks)
      .where(eq(backlinks.projectId, primaryProject.id));

    const primaryDomainsSet = new Set(
      primaryBacklinks.map((b) => b.sourceDomain.toLowerCase()),
    );

    const compBacklinks = await db
      .select({
        sourceDomain: backlinks.sourceDomain,
        targetUrl: backlinks.targetUrl,
        anchorText: backlinks.anchorText,
        isFollow: backlinks.isFollow,
        domainRating: backlinks.domainRating,
        projectId: backlinks.projectId,
      })
      .from(backlinks)
      .where(
        inArray(
          backlinks.projectId,
          compProjects.map((p) => p.id),
        ),
      );

    const seenDomains = new Set<string>();
    for (const b of compBacklinks) {
      const sDomain = b.sourceDomain.toLowerCase();
      if (!primaryDomainsSet.has(sDomain) && !seenDomains.has(sDomain)) {
        seenDomains.add(sDomain);
        const comp = compProjects.find((p) => p.id === b.projectId);
        prospectRows.push({
          domain: b.sourceDomain,
          targetUrl: b.targetUrl || "",
          anchorText: b.anchorText,
          isFollow: b.isFollow,
          domainRating: b.domainRating,
          linkedCompetitor: comp?.name || "Competitor",
        });
      }
    }
  }

  return (
    <div className="space-y-6 pb-24 pt-1 text-foreground animate-in">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span>&gt;</span>
            <Link href="/" className="hover:text-foreground">
              SEO
            </Link>
            <span>&gt;</span>
            <span className="text-foreground font-semibold">Backlink Gap</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Backlink Gap Prospect Finder
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Discover domains that link to your competitors but have not yet linked to your website.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs sm:p-8">
        <p className="mb-5 text-[13px] text-muted-foreground">
          Enter your domain and competitor sites to uncover high-authority backlink prospects.
        </p>
        <CompareDomainsForm
          action="/backlink-gap"
          defaultDomain={defaultDomain}
          initialDomains={domainList.length >= 2 ? domainList : undefined}
          submitLabel="Find backlink prospects"
        />
      </div>

      {prospectRows.length === 0 ? (
        <Empty
          icon={Link2}
          title={
            domainList.length >= 2
              ? `No unlinked competitor backlink prospects found for ${domainList.join(", ")}`
              : "Backlink gap requires tracked competitor backlink profiles"
          }
          description="Backlink gap discovers sites that link to your competitors but not to you. Import competitor backlink exports from Ahrefs or Semrush in CSV format to populate prospects."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" size="sm" className="rounded-[6px]" asChild>
                <Link href="/imports">Import Backlinks CSV</Link>
              </Button>
              <Button variant="secondary" size="sm" className="rounded-[6px]" asChild>
                <Link href="/projects">Manage projects</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-foreground">
              Prospect Opportunities ({prospectRows.length})
            </h3>
            <span className="text-[12px] text-muted-foreground">
              Domains linking to competitors where {primaryDomain} has 0 backlinks
            </span>
          </div>

          <div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px] border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/50 text-[10px] font-semibold text-muted-foreground uppercase">
                    <th className="py-3 px-4">Referring Domain</th>
                    <th className="py-3 px-3 text-center">Authority (DR)</th>
                    <th className="py-3 px-3">Links to Competitor</th>
                    <th className="py-3 px-3 text-center">Link Type</th>
                    <th className="py-3 px-4 text-center">Your Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {prospectRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-surface-muted/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        <a
                          href={`https://${row.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          {row.domain}
                          <ExternalLink className="size-3 opacity-60" />
                        </a>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground">
                        {row.domainRating != null ? row.domainRating : "—"}
                      </td>
                      <td className="py-3 px-3 font-medium text-foreground">
                        <Badge tone="accent" className="text-[10px] py-0 px-1.5">
                          {row.linkedCompetitor}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            row.isFollow
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-surface-muted text-muted-foreground"
                          }`}
                        >
                          {row.isFollow ? "Follow" : "Nofollow"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge tone="critical" className="text-[10px] py-0 px-1.5">
                          Missing Link
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
