import { eq } from "drizzle-orm";
import {
  ExternalLink,
  Swords,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { db } from "@/db";
import { backlinks, competitors, keywords, projects } from "@/db/schema";
import { getLatestCompletedCrawl } from "@/lib/queries";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";
import { formatNumber, hostnameOf } from "@/lib/utils";
import { CompetitorDialog } from "@/app/(dashboard)/projects/[id]/competitors/competitor-dialog";
import { deleteCompetitorAction } from "@/app/(dashboard)/projects/[id]/competitors/actions";
import { CountryFlag } from "../../domain-overview/country-select";

export const dynamic = "force-dynamic";

const PALETTE = [
  { bg: "bg-indigo-600", text: "text-indigo-600" },
  { bg: "bg-emerald-500", text: "text-emerald-600" },
  { bg: "bg-purple-500", text: "text-purple-600" },
  { bg: "bg-amber-500", text: "text-amber-600" },
  { bg: "bg-sky-500", text: "text-sky-600" },
];

export default async function ProjectCompetitorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ country?: string }>;
}) {
  const { project: slugOrId } = await params;
  const { country = "WW" } = await searchParams;

  const project = await findProjectBySlugOrId(slugOrId);
  if (!project) notFound();

  const domain = hostnameOf(project.domain) || project.domain;
  const slug = toProjectSlug(project.name);

  // Fetch real data from database
  const [crawl, projectKeywords, projectBacklinks, projectCompetitors, allProjects] =
    await Promise.all([
      getLatestCompletedCrawl(project.id),
      db.select().from(keywords).where(eq(keywords.projectId, project.id)),
      db.select().from(backlinks).where(eq(backlinks.projectId, project.id)),
      db.select().from(competitors).where(eq(competitors.projectId, project.id)),
      db.select().from(projects),
    ]);

  const validDrs = projectBacklinks
    .map((b) => b.domainRating)
    .filter((d): d is number => d != null);
  const avgDr =
    validDrs.length > 0
      ? Math.round(validDrs.reduce((a, b) => a + b, 0) / validDrs.length)
      : 0;
  const projectHealth = crawl?.healthScore != null ? Math.round(crawl.healthScore) : 50;
  const projectAS = Math.min(
    100,
    Math.max(
      5,
      Math.round(
        (projectBacklinks.length > 0 ? 30 : 10) +
          projectHealth * 0.4 +
          avgDr * 0.3,
      ),
    ),
  );
  const uniqueRefDomains = new Set(projectBacklinks.map((b) => b.sourceDomain)).size;
  const totalSearchVolume = projectKeywords.reduce(
    (sum, k) => sum + (k.searchVolume || 0),
    0,
  );

  // Construct real comparison rows
  const compareRows = [
    {
      id: 0,
      domain: domain,
      color: PALETTE[0].bg,
      textColor: PALETTE[0].text,
      as: projectAS,
      rank: "—",
      orgTraffic: formatNumber(totalSearchVolume),
      orgKeywords: formatNumber(projectKeywords.length),
      backlinks: formatNumber(projectBacklinks.length),
      refDomains: formatNumber(uniqueRefDomains),
      paidKeywords: "0",
      paidCost: "$0",
      isPrimary: true,
    },
    ...projectCompetitors.map((c, idx) => {
      const palette = PALETTE[(idx + 1) % PALETTE.length];
      const competitorHost = hostnameOf(c.domain) || c.domain;
      const matchedProject = allProjects.find(
        (p) =>
          hostnameOf(p.domain).toLowerCase() === competitorHost.toLowerCase(),
      );

      return {
        id: c.id,
        domain: competitorHost,
        color: palette.bg,
        textColor: palette.text,
        as: matchedProject ? 40 : 15,
        rank: "—",
        orgTraffic: matchedProject ? "Tracked" : "—",
        orgKeywords: matchedProject ? "Tracked" : "—",
        backlinks: "—",
        refDomains: "—",
        paidKeywords: "0",
        paidCost: "$0",
        isPrimary: false,
      };
    }),
  ];

  return (
    <div className="space-y-6 pb-24 pt-1 text-foreground animate-in">
      {/* 1. Breadcrumbs & Header */}
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
            <Link href={`/${slug}/overview`} className="hover:text-foreground">
              Domain Overview
            </Link>
            <span>&gt;</span>
            <span className="text-foreground font-semibold">Competitors Benchmark</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Competitors Benchmark:</span>
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {domain}
              <ExternalLink className="size-4 opacity-70" />
            </a>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <CompetitorDialog projectId={project.id} />
        </div>
      </div>

      {/* 2. Country & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/${slug}/competitors?country=WW`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold border transition-all ${
              country === "WW"
                ? "border-blue-500 bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            <CountryFlag code="WW" />
            <span>Worldwide</span>
          </Link>

          <Link
            href={`/${slug}/competitors?country=US`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold border transition-all ${
              country === "US"
                ? "border-blue-500 bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            <CountryFlag code="US" />
            <span>US</span>
          </Link>

          <Link
            href={`/${slug}/competitors?country=GB`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold border transition-all ${
              country === "GB"
                ? "border-blue-500 bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            <CountryFlag code="GB" />
            <span>UK</span>
          </Link>

          <Link
            href={`/${slug}/competitors?country=IN`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold border transition-all ${
              country === "IN"
                ? "border-blue-500 bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            <CountryFlag code="IN" />
            <span>IN</span>
          </Link>
        </div>
      </div>

      {projectCompetitors.length === 0 ? (
        <Empty
          icon={Swords}
          title="No competitors tracked yet"
          description="Add the domains you compete with in search results to benchmark Authority Score, keywords, and backlink metrics side-by-side."
          action={<CompetitorDialog projectId={project.id} />}
        />
      ) : (
        <>
          {/* 3. Comparison Table Matrix */}
          <div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
            <div className="border-b border-border px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-foreground">
                  Competitive Matrix Benchmark
                </h3>
                <p className="text-[12px] text-muted-foreground">
                  Side-by-side metrics comparing your monitored project against configured competitors.
                </p>
              </div>
              <CompetitorDialog projectId={project.id} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px] border-collapse min-w-[950px]">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/50 text-[10px] font-semibold text-muted-foreground uppercase">
                    <th className="py-3 px-4">Domain</th>
                    <th className="py-3 px-3 text-center">Authority Score</th>
                    <th className="py-3 px-3 text-center">Est. Search Volume</th>
                    <th className="py-3 px-3 text-center">Tracked Keywords</th>
                    <th className="py-3 px-3 text-center">Backlinks</th>
                    <th className="py-3 px-3 text-center">Ref. Domains</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {compareRows.map((row) => (
                    <tr key={row.domain} className="hover:bg-surface-muted/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 font-semibold">
                          <span className={`size-2 rounded-full ${row.color}`} />
                          <span className={row.textColor}>{row.domain}</span>
                          {row.isPrimary ? (
                            <Badge tone="accent" className="text-[10px] py-0 px-1.5 ml-1">
                              You
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground">
                        {row.as}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground">
                        {row.orgTraffic}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground">
                        {row.orgKeywords}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground">
                        {row.backlinks}
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-foreground">
                        {row.refDomains}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!row.isPrimary ? (
                          <ConfirmDelete
                            action={deleteCompetitorAction}
                            id={row.id}
                            title="Remove Competitor"
                            description={`Are you sure you want to stop tracking ${row.domain}?`}
                            trigger={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 text-muted-foreground hover:text-critical"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            }
                          />
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Primary site</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
