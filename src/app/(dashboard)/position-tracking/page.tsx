import { Globe, Laptop, Mail, Plus, Search, Smartphone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { ALL_COUNTRIES, getCountryFlag, getCountryFlagUrl } from "@/lib/countries";
import { summarizeKeywords, type KeywordSummary } from "@/lib/keyword-stats";
import { getKeywordRows } from "@/lib/queries";
import { getSearchProvider } from "@/lib/search/registry";
import "@/lib/search/providers";
import { toProjectSlug } from "@/lib/slug-utils";
import { formatDate, hostnameOf } from "@/lib/utils";

export const dynamic = "force-dynamic";

const countryName = new Map(ALL_COUNTRIES.map((c) => [c.code, c.name]));

/**
 * Share of checked keywords ranking in the top 10. Semrush's "visibility" is a
 * CTR-weighted estimate; this is the unweighted fact behind it, which is the
 * honest version when there is no click-through model to weight by.
 */
function topTenShare(summary: KeywordSummary): number | null {
  const checked = summary.ranking + summary.notRanking;
  if (checked === 0) return null;
  return Math.round((summary.top10 / checked) * 1000) / 10;
}

function Movement({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground">0</span>;
  const good = value > 0;
  return (
    <span
      className={
        good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      }
    >
      {good ? "+" : ""}
      {value}
    </span>
  );
}

/** Device icon component based on device type */
function DeviceBadge({ device }: { device: string }) {
  if (device === "both") {
    return (
      <span className="inline-flex items-center gap-1 font-medium">
        <Smartphone className="size-3 shrink-0" />
        <Laptop className="size-3 shrink-0" />
        <span>Mobile &amp; Desktop</span>
      </span>
    );
  }
  if (device === "mobile") {
    return (
      <span className="inline-flex items-center gap-1">
        <Smartphone className="size-3 shrink-0" />
        <span>Mobile</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Laptop className="size-3 shrink-0" />
      <span>Desktop</span>
    </span>
  );
}



export default async function PositionTrackingDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; device?: string }>;
}) {
  const { q = "", device: deviceFilter } = await searchParams;
  const filter = q.trim().toLowerCase();

  const [allProjects, provider] = await Promise.all([
    db.select().from(projects).orderBy(projects.name),
    getSearchProvider(),
  ]);

  const visible = filter
    ? allProjects.filter(
        (p) =>
          p.name.toLowerCase().includes(filter) ||
          p.domain.toLowerCase().includes(filter),
      )
    : allProjects;

  const summaries = await Promise.all(
    visible.map(async (p) => {
      const rows = await getKeywordRows(p.id);

      // Group rows by device for breakdown
      const mobileRows = rows.filter((r) => r.device === "mobile");
      const desktopRows = rows.filter((r) => r.device === "desktop");
      const allSummary = summarizeKeywords(rows);
      const mobileSummary = mobileRows.length > 0 ? summarizeKeywords(mobileRows) : null;
      const desktopSummary = desktopRows.length > 0 ? summarizeKeywords(desktopRows) : null;

      const latest = rows.reduce<string | null>(
        (max, row) => (row.date && (!max || row.date > max) ? row.date : max),
        null,
      );

      // Collect unique countries from ranking data
      const rankedCountries = [
        ...new Set(rows.filter((r) => r.country).map((r) => r.country!)),
      ];
      // Collect unique devices from ranking data
      const rankedDevices = [
        ...new Set(rows.filter((r) => r.device).map((r) => r.device!)),
      ];

      return {
        project: p,
        summary: allSummary,
        mobileSummary,
        desktopSummary,
        latest,
        rankedCountries,
        rankedDevices,
      };
    }),
  );

  return (
    <div className="space-y-6 pb-20 pt-1 text-foreground animate-in">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span>&gt;</span>
            <Link href="/" className="hover:text-foreground">
              SEO
            </Link>
            <span>&gt;</span>
            <span className="font-semibold text-foreground">Position Tracking</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Position Tracking
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {provider
              ? `Automated daily Google rank checks across Top 10 Pages (Positions 1–100) for all targeted countries & devices at 6:00 PM IST via ${provider.label}. Instant on-demand checks available in each project's Rankings tab.`
              : "No search provider is configured; positions shown here come from CSV imports."}
          </p>
        </div>

        <button className="hidden items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:underline sm:inline-flex dark:text-blue-400">
          <Mail className="size-3.5" />
          Send feedback
        </button>
      </div>

      <div className="flex flex-col flex-wrap items-center justify-between gap-3 sm:flex-row">
        <form method="get" className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Project name or domain"
            className="w-full rounded-[6px] border border-border bg-surface py-2 pl-9 pr-4 text-[13px] text-foreground shadow-2xs placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </form>

        <Button
          variant="primary"
          size="sm"
          className="h-8.5 w-full rounded-[6px] bg-zinc-950 px-4 font-bold text-white shadow-sm sm:w-auto dark:bg-white dark:text-zinc-950"
          asChild
        >
          <Link href="/projects">
            <Plus className="mr-1 size-3.5" />
            Create SEO project
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="w-48 px-4 py-3">Project</th>
                <th className="w-56 px-4 py-3">Device &amp; Location</th>
                <th className="px-3 py-3 text-center" title="Tracking devices">
                  Tracked Devices
                </th>
                <th
                  className="px-3 py-3 text-center"
                  title="Share of checked keywords ranking in the top 10"
                >
                  Top-10 share
                </th>
                <th className="px-3 py-3 text-center">Net change</th>
                <th className="px-3 py-3 text-center">Improved</th>
                <th className="px-3 py-3 text-center">Declined</th>
                <th className="px-3 py-3 text-center">Keywords</th>
                <th className="px-4 py-3 text-right">Last checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summaries.length > 0 ? (
                summaries.map(({ project: p, summary, mobileSummary, desktopSummary, latest, rankedCountries, rankedDevices }) => {
                  const slug = toProjectSlug(p.name);
                  const pDomain = hostnameOf(p.domain) || p.domain;
                  const share = topTenShare(summary);

                  const countryCodes = (p.targetCountry || "US")
                    .split(",")
                    .map((c) => c.trim().toUpperCase())
                    .filter(Boolean);

                  return (
                    <tr key={p.id} className="transition-colors hover:bg-surface-muted/40">
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/${slug}/rankings`}
                          className="block truncate text-[13px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {p.name}
                        </Link>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {pDomain}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                          {countryCodes.map((c) => (
                            <span key={c} className="inline-flex items-center gap-1.5">
                              {c !== "WW" ? (
                                <img
                                  src={getCountryFlagUrl(c)}
                                  alt={c}
                                  className="h-3.5 w-5 shrink-0 rounded-[2px] border border-border/50 object-cover shadow-xs"
                                  loading="lazy"
                                />
                              ) : (
                                <Globe className="size-4 shrink-0 text-muted-foreground" />
                              )}
                              <span>{countryName.get(c) ?? c}</span>
                            </span>
                          ))}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] capitalize text-muted-foreground">
                          <DeviceBadge device={p.targetDevice} />
                          {provider ? <span>· {provider.label}</span> : ""}
                        </div>
                      </td>

                      {/* Tracked Devices breakdown */}
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {rankedDevices.length > 0 ? (
                            rankedDevices.map((d) => {
                              const devSummary = d === "mobile" ? mobileSummary : desktopSummary;
                              const devShare = devSummary ? topTenShare(devSummary) : null;
                              return (
                                <span
                                  key={d}
                                  className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium"
                                >
                                  {d === "mobile" ? (
                                    <Smartphone className="size-2.5 text-blue-500" />
                                  ) : (
                                    <Laptop className="size-2.5 text-purple-500" />
                                  )}
                                  <span className="capitalize">{d}</span>
                                  {devShare !== null && (
                                    <span className="text-[9px] text-muted-foreground">
                                      ({devShare}%)
                                    </span>
                                  )}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-center text-[13px] font-bold tabular-nums text-blue-600 dark:text-blue-400">
                        {share === null ? (
                          <span className="font-normal text-muted-foreground">—</span>
                        ) : (
                          `${share}%`
                        )}
                      </td>

                      <td className="px-3 py-3.5 text-center font-bold tabular-nums">
                        <Movement value={summary.improved - summary.declined} />
                      </td>

                      <td className="px-3 py-3.5 text-center font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {summary.improved}
                      </td>

                      <td className="px-3 py-3.5 text-center font-bold tabular-nums text-red-600 dark:text-red-400">
                        {summary.declined}
                      </td>

                      <td className="px-3 py-3.5 text-center font-bold tabular-nums text-foreground">
                        {summary.total}
                        {summary.unchecked > 0 ? (
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            ({summary.unchecked} unchecked)
                          </span>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-muted-foreground">
                        {latest ? formatDate(latest) : "Never"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    {filter
                      ? `No projects match "${q}".`
                      : "No projects yet. Create one to start tracking positions."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
