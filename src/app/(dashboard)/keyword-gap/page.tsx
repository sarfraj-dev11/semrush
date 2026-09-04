import { eq } from "drizzle-orm";
import { Target } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { db } from "@/db";
import { keywordRankings, keywords, projects } from "@/db/schema";
import { formatNumber, hostnameOf } from "@/lib/utils";
import { CompareDomainsForm } from "../compare-domains/compare-form";

export const dynamic = "force-dynamic";

type GapType = "shared" | "missing" | "weak" | "strong" | "untapped";

export default async function KeywordGapPage({
  searchParams,
}: {
  searchParams: Promise<{ domains?: string; country?: string; type?: string }>;
}) {
  const { domains: domainQuery = "", country = "US", type: activeType = "all" } =
    await searchParams;

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
  const competitorDomain = domainList[1] || "";

  // Check if we have matched projects in SQLite for these domains
  const primaryProject = allProjects.find(
    (p) =>
      hostnameOf(p.domain).toLowerCase() === primaryDomain.toLowerCase() ||
      p.domain.toLowerCase().includes(primaryDomain.toLowerCase()),
  );
  const compProject = allProjects.find(
    (p) =>
      competitorDomain &&
      (hostnameOf(p.domain).toLowerCase() === competitorDomain.toLowerCase() ||
        p.domain.toLowerCase().includes(competitorDomain.toLowerCase())),
  );

  // Pull real keyword rankings if matched
  const gapRows: {
    query: string;
    volume: number;
    intent: string | null;
    cpc: number | null;
    primaryPos: number | null;
    compPos: number | null;
    gapType: GapType;
  }[] = [];

  if (primaryProject) {
    const [pKeywords, cKeywords] = await Promise.all([
      db
        .select({
          id: keywords.id,
          query: keywords.keyword,
          searchVolume: keywords.searchVolume,
          cpc: keywords.cpc,
          intent: keywords.intent,
          position: keywordRankings.position,
        })
        .from(keywords)
        .leftJoin(
          keywordRankings,
          eq(keywordRankings.keywordId, keywords.id),
        )
        .where(eq(keywords.projectId, primaryProject.id)),
      compProject
        ? db
            .select({
              id: keywords.id,
              query: keywords.keyword,
              searchVolume: keywords.searchVolume,
              cpc: keywords.cpc,
              intent: keywords.intent,
              position: keywordRankings.position,
            })
            .from(keywords)
            .leftJoin(
              keywordRankings,
              eq(keywordRankings.keywordId, keywords.id),
            )
            .where(eq(keywords.projectId, compProject.id))
        : Promise.resolve([]),
    ]);

    const compMap = new Map<string, { position: number | null }>();
    for (const c of cKeywords) {
      if (!compMap.has(c.query.toLowerCase())) {
        compMap.set(c.query.toLowerCase(), { position: c.position });
      }
    }

    for (const p of pKeywords) {
      const compInfo = compMap.get(p.query.toLowerCase());
      const pPos = p.position;
      const cPos = compInfo ? compInfo.position : null;

      let gapType: GapType = "untapped";
      if (pPos && cPos) {
        if (pPos < cPos) gapType = "strong";
        else if (pPos > cPos) gapType = "weak";
        else gapType = "shared";
      } else if (!pPos && cPos) {
        gapType = "missing";
      } else if (pPos && !cPos) {
        gapType = "strong";
      }

      gapRows.push({
        query: p.query,
        volume: p.searchVolume || 0,
        intent: p.intent,
        cpc: p.cpc,
        primaryPos: pPos,
        compPos: cPos,
        gapType,
      });
    }

    // Add any competitor keywords not in primary
    for (const c of cKeywords) {
      if (
        !gapRows.some(
          (row) => row.query.toLowerCase() === c.query.toLowerCase(),
        )
      ) {
        gapRows.push({
          query: c.query,
          volume: c.searchVolume || 0,
          intent: c.intent,
          cpc: c.cpc,
          primaryPos: null,
          compPos: c.position,
          gapType: "missing",
        });
      }
    }
  }

  const filteredRows =
    activeType === "all"
      ? gapRows
      : gapRows.filter((r) => r.gapType === activeType);

  const sharedCount = gapRows.filter((r) => r.gapType === "shared").length;
  const missingCount = gapRows.filter((r) => r.gapType === "missing").length;
  const weakCount = gapRows.filter((r) => r.gapType === "weak").length;
  const strongCount = gapRows.filter((r) => r.gapType === "strong").length;

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
            <Link href="/domain-overview" className="hover:text-foreground">
              Domain Overview
            </Link>
            <span>&gt;</span>
            <span className="text-foreground font-semibold">Keyword Gap</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Keyword Gap Analysis
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Compare keyword ranking distribution and discover missing search opportunities between your site and competitors.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs sm:p-8">
        <p className="mb-5 text-[13px] text-muted-foreground">
          Enter your domain and up to four competitors to calculate ranking overlaps.
        </p>
        <CompareDomainsForm
          action="/keyword-gap"
          defaultDomain={defaultDomain}
          initialDomains={domainList.length >= 2 ? domainList : undefined}
          initialCountry={country}
          submitLabel="Find keyword gaps"
        />
      </div>

      {gapRows.length === 0 ? (
        <Empty
          icon={Target}
          title={
            domainList.length >= 2
              ? `No keyword ranking data found for ${domainList.join(", ")}`
              : "Keyword gap requires tracked domains"
          }
          description="Keyword gap calculates shared, missing, and weak keywords based on tracked rankings in your database. Track keywords in a project or import a Semrush ranking CSV to see real gaps."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" size="sm" className="rounded-[6px]" asChild>
                <Link href="/imports">Import Semrush Rankings CSV</Link>
              </Button>
              <Button variant="secondary" size="sm" className="rounded-[6px]" asChild>
                <Link href="/projects">Manage projects</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <Link
              href={`/keyword-gap?domains=${encodeURIComponent(domainQuery)}&type=all`}
              className={`px-3 py-1 rounded-[6px] text-[12px] font-semibold transition-colors ${
                activeType === "all"
                  ? "bg-foreground text-background"
                  : "bg-surface border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({gapRows.length})
            </Link>
            <Link
              href={`/keyword-gap?domains=${encodeURIComponent(domainQuery)}&type=shared`}
              className={`px-3 py-1 rounded-[6px] text-[12px] font-semibold transition-colors ${
                activeType === "shared"
                  ? "bg-blue-600 text-white"
                  : "bg-surface border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Shared ({sharedCount})
            </Link>
            <Link
              href={`/keyword-gap?domains=${encodeURIComponent(domainQuery)}&type=missing`}
              className={`px-3 py-1 rounded-[6px] text-[12px] font-semibold transition-colors ${
                activeType === "missing"
                  ? "bg-red-600 text-white"
                  : "bg-surface border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Missing ({missingCount})
            </Link>
            <Link
              href={`/keyword-gap?domains=${encodeURIComponent(domainQuery)}&type=weak`}
              className={`px-3 py-1 rounded-[6px] text-[12px] font-semibold transition-colors ${
                activeType === "weak"
                  ? "bg-amber-600 text-white"
                  : "bg-surface border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Weak ({weakCount})
            </Link>
            <Link
              href={`/keyword-gap?domains=${encodeURIComponent(domainQuery)}&type=strong`}
              className={`px-3 py-1 rounded-[6px] text-[12px] font-semibold transition-colors ${
                activeType === "strong"
                  ? "bg-emerald-600 text-white"
                  : "bg-surface border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Strong ({strongCount})
            </Link>
          </div>

          {/* Gap Matrix Table */}
          <div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px] border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/50 text-[10px] font-semibold text-muted-foreground uppercase">
                    <th className="py-3 px-4">Keyword</th>
                    <th className="py-3 px-3 text-center">Intent</th>
                    <th className="py-3 px-3 text-right">Search Volume</th>
                    <th className="py-3 px-3 text-right">CPC</th>
                    <th className="py-3 px-3 text-center">
                      {primaryDomain}
                    </th>
                    <th className="py-3 px-3 text-center">
                      {competitorDomain || "Competitor"}
                    </th>
                    <th className="py-3 px-4 text-center">Gap Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-surface-muted/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {row.query}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {row.intent ? (
                          <Badge tone="neutral" className="capitalize text-[10px] py-0 px-1.5">
                            {row.intent}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-foreground">
                        {row.volume > 0 ? formatNumber(row.volume) : "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-muted-foreground">
                        {row.cpc ? `$${row.cpc}` : "—"}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-foreground">
                        {row.primaryPos != null ? row.primaryPos : "—"}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-muted-foreground">
                        {row.compPos != null ? row.compPos : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            row.gapType === "strong"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : row.gapType === "weak"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : row.gapType === "missing"
                                  ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                                  : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {row.gapType}
                        </span>
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
