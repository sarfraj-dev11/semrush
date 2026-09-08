import { asc, desc, eq } from "drizzle-orm";
import {
  ArrowRight,
  ExternalLink,
  Globe,
  Link2,
  Plus,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/db";
import { backlinks, clients, crawls, keywords, projects } from "@/db/schema";
import { toProjectSlug } from "@/lib/slug-utils";
import { getCountryFlagUrl } from "@/lib/countries";
import { formatNumber, hostnameOf } from "@/lib/utils";
import { getFirebaseProjects, syncProjectsFromFirebase } from "@/lib/firebase-tracking";
import { deleteProjectAction } from "./actions";
import { ProjectFormDialog } from "./project-form";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await syncProjectsFromFirebase().catch((err) => {
    console.error("⚠️ [ProjectsPage] Failed to sync Firestore projects:", err);
  });

  const [projectRows, clientOptions, allCrawls, allKeywords, allBacklinks, fbProjects] =
    await Promise.all([
      db
        .select({
          id: projects.id,
          name: projects.name,
          domain: projects.domain,
          targetCountry: projects.targetCountry,
          targetDevice: projects.targetDevice,
          crawlLimit: projects.crawlLimit,
          clientId: clients.id,
          clientName: clients.name,
        })
        .from(projects)
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .orderBy(asc(projects.name)),
      db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .orderBy(asc(clients.name)),
      db
        .select()
        .from(crawls)
        .where(eq(crawls.status, "completed"))
        .orderBy(desc(crawls.finishedAt)),
      db
        .select({
          projectId: keywords.projectId,
          id: keywords.id,
        })
        .from(keywords),
      db
        .select({
          projectId: backlinks.projectId,
          id: backlinks.id,
          sourceDomain: backlinks.sourceDomain,
        })
        .from(backlinks),
      getFirebaseProjects().catch((err) => {
        console.error("❌ [ProjectsPage] Failed to fetch Firestore projects:", err);
        return [];
      }),
    ]);

  const fbProjectIds = new Set(fbProjects.map((p) => p.id));

  // Aggregate latest completed crawl by project
  const latestCrawlByProject = new Map<number, (typeof allCrawls)[0]>();
  for (const crawl of allCrawls) {
    if (!latestCrawlByProject.has(crawl.projectId)) {
      latestCrawlByProject.set(crawl.projectId, crawl);
    }
  }

  // Aggregate keywords count by project
  const kwCountByProject = new Map<number, number>();
  for (const kw of allKeywords) {
    kwCountByProject.set(kw.projectId, (kwCountByProject.get(kw.projectId) ?? 0) + 1);
  }

  // Aggregate backlinks by project
  const blCountByProject = new Map<number, { count: number; domains: Set<string> }>();
  for (const bl of allBacklinks) {
    const entry = blCountByProject.get(bl.projectId) ?? {
      count: 0,
      domains: new Set<string>(),
    };
    entry.count++;
    entry.domains.add(bl.sourceDomain.toLowerCase());
    blCountByProject.set(bl.projectId, entry);
  }

  const newProjectButton =
    clientOptions.length > 0 ? (
      <ProjectFormDialog
        clients={clientOptions}
        defaultClientId={clientOptions[0]?.id}
        trigger={
          <Button variant="primary">
            <Plus className="size-4 mr-1.5" />
            New project
          </Button>
        }
      />
    ) : (
      <Button variant="primary" asChild>
        <Link href="/clients">
          <Plus className="size-4 mr-1.5" />
          Add a client first
        </Link>
      </Button>
    );

  return (
    <div className="space-y-6 pb-20 pt-1 text-foreground animate-in">
      <PageHeader
        title="Projects"
        description={`${projectRows.length} ${projectRows.length === 1 ? "project" : "projects"} monitored across SEO toolkits.`}
        actions={newProjectButton}
      />

      {projectRows.length === 0 ? (
        <Empty
          icon={Globe}
          title="No projects yet"
          description={
            clientOptions.length === 0
              ? "Projects belong to a client, so create a client first."
              : "Add a site to start crawling, auditing, and benchmarking search performance."
          }
          action={newProjectButton}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
          {projectRows.map((project) => {
            const slug = toProjectSlug(project.name);
            const crawl = latestCrawlByProject.get(project.id);
            const kwCount = kwCountByProject.get(project.id) ?? 0;
            const blEntry = blCountByProject.get(project.id);
            const blCount = blEntry?.count ?? 0;
            const refDomainsCount = blEntry?.domains.size ?? 0;

            const healthScore = crawl?.healthScore != null ? Math.round(crawl.healthScore) : null;
            const healthTone =
              healthScore == null
                ? "neutral"
                : healthScore >= 85
                  ? "success"
                  : healthScore >= 70
                    ? "warning"
                    : "critical";

            return (
              <div
                key={project.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-xs transition-all hover:border-zinc-300 hover:shadow-md dark:hover:border-zinc-700"
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/${slug}`}
                          className="text-lg font-bold tracking-tight text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {project.name}
                        </Link>
                        {project.targetCountry
                          .split(",")
                          .map((c) => c.trim().toUpperCase())
                          .filter(Boolean)
                          .map((code) => (
                            <Badge
                              key={code}
                              tone="outline"
                              className="text-[11px] py-0 px-1.5 gap-1.5 inline-flex items-center"
                            >
                              {code !== "WW" ? (
                                <img
                                  src={getCountryFlagUrl(code)}
                                  alt={code}
                                  className="h-2.5 w-4 shrink-0 rounded-[1.5px] border border-border/40 object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <Globe className="size-3 text-muted-foreground" />
                              )}
                              <span>{code}</span>
                            </Badge>
                          ))}
                      </div>
                      <a
                        href={`https://${hostnameOf(project.domain)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground mt-0.5"
                      >
                        <span>{hostnameOf(project.domain)}</span>
                        <ExternalLink className="size-3 opacity-60" />
                      </a>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {project.clientName ? (
                        <Link
                          href={`/clients/${project.clientId}`}
                          className="text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-0.5 transition-colors"
                        >
                          {project.clientName}
                        </Link>
                      ) : null}
                      <ConfirmDelete
                        action={deleteProjectAction}
                        id={project.id}
                        extraInputs={{ redirectTo: "/projects" }}
                        title={`Delete ${project.name}?`}
                        description="Every crawl, audit issue, keyword, ranking and backlink stored for this project is deleted with it. This cannot be undone."
                        confirmLabel="Delete project"
                        trigger={
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 p-1 rounded-md transition-colors cursor-pointer"
                            title="Delete project"
                            aria-label={`Delete ${project.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        }
                      />
                    </div>
                  </div>

                  {/* Toolkit Summary Cards Grid */}
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {/* Site Audit Metric */}
                    <Link
                      href={`/${slug}/audit`}
                      className="rounded-xl border border-border bg-surface-muted/40 p-3 hover:bg-surface-muted/80 transition-colors group/card"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                        <span>Site Audit</span>
                        <ShieldCheck className="size-3.5 text-emerald-500" />
                      </div>
                      <div
                        className={`mt-2 text-xl font-extrabold tabular-nums ${
                          healthTone === "success"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : healthTone === "warning"
                              ? "text-amber-600 dark:text-amber-400"
                              : healthTone === "critical"
                                ? "text-red-600 dark:text-red-400"
                                : "text-foreground"
                        }`}
                      >
                        {healthScore != null ? `${healthScore}%` : "—"}
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground truncate">
                        {crawl
                          ? `${formatNumber(crawl.pagesCrawled)} pages crawled`
                          : "No audit yet"}
                      </p>
                    </Link>

                    {/* Position Tracking Metric */}
                    <Link
                      href={`/${slug}/keywords`}
                      className="rounded-xl border border-border bg-surface-muted/40 p-3 hover:bg-surface-muted/80 transition-colors group/card"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                        <span>Keywords</span>
                        <TrendingUp className="size-3.5 text-blue-500" />
                      </div>
                      <div className="mt-2 text-xl font-extrabold tabular-nums text-foreground">
                        {formatNumber(kwCount)}
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground truncate">
                        {kwCount > 0 ? "Tracked queries" : "Add keywords"}
                      </p>
                    </Link>

                    {/* Backlinks Metric */}
                    <Link
                      href={`/${slug}/backlinks`}
                      className="rounded-xl border border-border bg-surface-muted/40 p-3 hover:bg-surface-muted/80 transition-colors group/card"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                        <span>Backlinks</span>
                        <Link2 className="size-3.5 text-violet-500" />
                      </div>
                      <div className="mt-2 text-xl font-extrabold tabular-nums text-foreground">
                        {formatNumber(blCount)}
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground truncate">
                        {refDomainsCount > 0
                          ? `${formatNumber(refDomainsCount)} ref domains`
                          : "No links"}
                      </p>
                    </Link>
                  </div>
                </div>

                {/* Footer Quick Links */}
                <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Link href={`/${slug}/overview`} className="hover:text-foreground transition-colors">
                      Overview
                    </Link>
                    <span>·</span>
                    <Link href={`/${slug}/audit`} className="hover:text-foreground transition-colors">
                      Site Audit
                    </Link>
                    <span>·</span>
                    <Link href={`/${slug}/competitors`} className="hover:text-foreground transition-colors">
                      Competitors
                    </Link>
                    <span>·</span>
                    <Link href={`/${slug}/report`} className="hover:text-foreground transition-colors">
                      Report
                    </Link>
                  </div>

                  <Button variant="secondary" size="sm" className="h-7 text-[12px]" asChild>
                    <Link href={`/${slug}`} className="inline-flex items-center gap-1">
                      <span>Dashboard</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
