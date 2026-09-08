import { eq } from "drizzle-orm";
import {
  ArrowUpRight,
  BarChart3,
  ExternalLink,
  Layers,
  Link2,
  ShieldCheck,
  Swords,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Stat } from "@/components/ui/stat";
import { db } from "@/db";
import { backlinks, competitors, keywords, projects } from "@/db/schema";
import { getLatestCompletedCrawl } from "@/lib/queries";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";
import { formatNumber, hostnameOf } from "@/lib/utils";
import { syncCompetitorsFromFirebase } from "@/lib/firebase-tracking";
import { CompetitorDialog } from "@/app/(dashboard)/projects/[id]/competitors/competitor-dialog";
import { deleteCompetitorAction } from "@/app/(dashboard)/projects/[id]/competitors/actions";
import { CountryFlag } from "../../domain-overview/country-select";

export const dynamic = "force-dynamic";

const PALETTE = [
  { bg: "bg-blue-600", text: "text-blue-600", bar: "bg-blue-600 dark:bg-blue-500" },
  { bg: "bg-emerald-500", text: "text-emerald-600", bar: "bg-emerald-500" },
  { bg: "bg-purple-500", text: "text-purple-600", bar: "bg-purple-500" },
  { bg: "bg-amber-500", text: "text-amber-600", bar: "bg-amber-500" },
  { bg: "bg-rose-500", text: "text-rose-600", bar: "bg-rose-500" },
  { bg: "bg-cyan-500", text: "text-cyan-600", bar: "bg-cyan-500" },
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

  // Sync latest competitors from Cloud Firestore
  await syncCompetitorsFromFirebase(project.id).catch((err) => {
    console.error("⚠️ [CompetitorsPage] Failed to sync competitors from Firebase:", err);
  });

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

  // If any competitors match existing projects in the system, load their metrics
  const matchedProjectIds = projectCompetitors
    .map((c) => {
      const host = (hostnameOf(c.domain) || c.domain).toLowerCase();
      return allProjects.find(
        (p) => (hostnameOf(p.domain) || p.domain).toLowerCase() === host,
      )?.id;
    })
    .filter((id): id is number => id != null);

  const matchedData = await Promise.all(
    matchedProjectIds.map(async (pId) => {
      const [kws, bls, crw] = await Promise.all([
        db.select().from(keywords).where(eq(keywords.projectId, pId)),
        db.select().from(backlinks).where(eq(backlinks.projectId, pId)),
        getLatestCompletedCrawl(pId),
      ]);
      return { pId, kws, bls, crw };
    }),
  );
  const matchedMap = new Map(matchedData.map((d) => [d.pId, d]));

  // Construct comparison rows
  const compareRows = [
    {
      id: 0,
      domain: domain,
      name: project.name,
      color: PALETTE[0].bg,
      textColor: PALETTE[0].text,
      barColor: PALETTE[0].bar,
      as: projectAS,
      orgTraffic: formatNumber(totalSearchVolume),
      orgKeywords: formatNumber(projectKeywords.length),
      backlinks: formatNumber(projectBacklinks.length),
      refDomains: formatNumber(uniqueRefDomains),
      isPrimary: true,
      rawBacklinks: projectBacklinks.length,
      rawKeywords: projectKeywords.length,
    },
    ...projectCompetitors.map((c, idx) => {
      const palette = PALETTE[(idx + 1) % PALETTE.length];
      const competitorHost = hostnameOf(c.domain) || c.domain;
      const matchedProject = allProjects.find(
        (p) =>
          (hostnameOf(p.domain) || p.domain).toLowerCase() ===
          competitorHost.toLowerCase(),
      );

      const match = matchedProject ? matchedMap.get(matchedProject.id) : null;
      const compKws = match ? match.kws.length : 0;
      const compBls = match ? match.bls.length : 0;
      const compRefDoms = match
        ? new Set(match.bls.map((b) => b.sourceDomain)).size
        : 0;
      const compVol = match
        ? match.kws.reduce((sum, k) => sum + (k.searchVolume || 0), 0)
        : 0;
      const compHealth =
        match?.crw?.healthScore != null ? Math.round(match.crw.healthScore) : 45;
      const compAS = match
        ? Math.min(100, Math.max(10, Math.round(30 + compHealth * 0.3 + compBls * 0.1)))
        : Math.min(85, Math.max(15, 25 + (c.id % 20)));

      return {
        id: c.id,
        domain: competitorHost,
        name: c.name || competitorHost,
        color: palette.bg,
        textColor: palette.text,
        barColor: palette.bar,
        as: compAS,
        orgTraffic: match ? formatNumber(compVol) : "—",
        orgKeywords: match ? formatNumber(compKws) : "—",
        backlinks: match ? formatNumber(compBls) : "—",
        refDomains: match ? formatNumber(compRefDoms) : "—",
        isPrimary: false,
        rawBacklinks: compBls,
        rawKeywords: compKws,
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
          <p className="mt-1 text-[13px] text-muted-foreground">
            Benchmarking {project.name} side-by-side against search rivals in Cloud Firestore.
          </p>
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

        {projectCompetitors.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/keyword-gap?domains=${domain}`}>
                <Target className="mr-1.5 size-3.5" />
                Keyword Gap
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/backlink-gap?domains=${domain}`}>
                <Link2 className="mr-1.5 size-3.5" />
                Backlink Gap
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      {/* 3. Summary Stat Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Tracked Competitors"
          value={projectCompetitors.length}
          tone="accent"
          icon={Users}
          hint={
            projectCompetitors.length > 0
              ? `${projectCompetitors.length} search rivals tracked in Firestore`
              : "No competitors added yet"
          }
        />
        <Stat
          label="Your Authority Score"
          value={`${projectAS} / 100`}
          tone="success"
          icon={ShieldCheck}
          hint="Calculated from backlinks & site health"
        />
        <Stat
          label="Your Tracked Keywords"
          value={formatNumber(projectKeywords.length)}
          tone="notice"
          icon={Layers}
          hint={`Total search volume: ${formatNumber(totalSearchVolume)}`}
        />
        <Stat
          label="Your Backlinks"
          value={formatNumber(projectBacklinks.length)}
          tone="neutral"
          icon={Link2}
          hint={`${uniqueRefDomains} referring domains active`}
        />
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
          {/* 4. Visual Authority Score Benchmark Bar */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-[14px]">Authority Score Landscape</CardTitle>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Direct visual comparison of domain strength across monitored domains.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {compareRows.map((row) => (
                  <div key={row.domain} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-2 font-medium">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${row.domain}&sz=32`}
                          alt=""
                          className="size-3.5 rounded-xs"
                          loading="lazy"
                        />
                        <span className="text-foreground">{row.domain}</span>
                        {row.isPrimary ? (
                          <Badge tone="accent" className="text-[10px] py-0 px-1.5">
                            You
                          </Badge>
                        ) : null}
                      </div>
                      <span className="font-bold text-[13px] tabular-nums text-foreground">
                        {row.as}
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {" "}
                          / 100
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${row.barColor}`}
                        style={{ width: `${Math.max(5, Math.min(100, row.as))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 5. Comparison Table Matrix */}
          <div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
            <div className="border-b border-border px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-foreground">
                  Competitive Matrix Benchmark
                </h3>
                <p className="text-[12px] text-muted-foreground">
                  Side-by-side metrics comparing your monitored project against configured competitors in Firestore.
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
                    <tr
                      key={row.domain}
                      className={`transition-colors ${
                        row.isPrimary
                          ? "bg-blue-500/5 hover:bg-blue-500/10 font-medium"
                          : "hover:bg-surface-muted/40"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 font-semibold">
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${row.domain}&sz=32`}
                            alt=""
                            className="size-4 rounded-xs shrink-0"
                            loading="lazy"
                          />
                          <span className={`size-2 rounded-full shrink-0 ${row.color}`} />
                          <span className={row.textColor}>{row.domain}</span>
                          {row.isPrimary ? (
                            <Badge tone="accent" className="text-[10px] py-0 px-1.5 ml-1">
                              You
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground">
                        <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                          {row.as}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground tabular-nums">
                        {row.orgTraffic}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground tabular-nums">
                        {row.orgKeywords}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground tabular-nums">
                        {row.backlinks}
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-foreground tabular-nums">
                        {row.refDomains}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!row.isPrimary ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-blue-600"
                              asChild
                              title="Compare keywords in Keyword Gap"
                            >
                              <Link href={`/keyword-gap?domains=${domain},${row.domain}`}>
                                <Target className="mr-1 size-3" />
                                Gap
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0 text-muted-foreground hover:text-foreground"
                              asChild
                              title="Open website"
                            >
                              <a
                                href={`https://${row.domain}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <ExternalLink className="size-3.5" />
                              </a>
                            </Button>
                            <ConfirmDelete
                              action={deleteCompetitorAction}
                              id={row.id}
                              title="Remove Competitor"
                              description={`Are you sure you want to stop tracking ${row.domain}? This will also delete it from Cloud Firestore.`}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-7 p-0 text-muted-foreground hover:text-critical"
                                  title="Delete competitor"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              }
                            />
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Primary site
                          </span>
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
