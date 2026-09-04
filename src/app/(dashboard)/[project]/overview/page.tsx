import { ExternalLink, Mail } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DomainReport } from "@/app/(dashboard)/domain-overview/domain-report";
import { ReportSkeleton } from "@/app/(dashboard)/domain-overview/report-skeleton";
import { CountryFlag } from "@/app/(dashboard)/domain-overview/country-select";
import { findProjectBySlugOrId, toProjectSlug } from "@/lib/slugs";
import { hostnameOf } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * The project's Domain Overview is the same live analysis the standalone
 * Domain Overview tool runs, pointed at this project's domain. Reusing that
 * report is what keeps the two from ever disagreeing about the same site.
 */

const COUNTRY_PILLS = [
  { code: "WW", label: "Worldwide" },
  { code: "US", label: "US" },
  { code: "GB", label: "UK" },
  { code: "IN", label: "IN" },
];

export default async function ProjectDomainOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ country?: string; search?: string }>;
}) {
  const { project: slugOrId } = await params;
  const { country = "WW", search } = await searchParams;

  const project = await findProjectBySlugOrId(slugOrId);
  if (!project) notFound();

  const domain = hostnameOf(project.domain) || project.domain;
  const slug = toProjectSlug(project.name);
  const includeSearch = search === "1";

  const pillHref = (code: string) =>
    `/${slug}/overview?country=${code}${includeSearch ? "&search=1" : ""}`;

  return (
    <div className="space-y-6 pb-24 pt-1 text-foreground animate-in">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Link href="/projects" className="hover:text-foreground">
              Projects
            </Link>
            <span>&gt;</span>
            <Link href={`/${slug}`} className="hover:text-foreground">
              {project.name}
            </Link>
            <span>&gt;</span>
            <span className="font-semibold text-foreground">Domain Overview</span>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <span>Domain Overview:</span>
            <a
              href={project.domain}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
            >
              {domain}
              <ExternalLink className="size-4 opacity-70" />
            </a>
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Fetched live on every visit — homepage, robots.txt, sitemaps and the mobile
            rendition. Nothing is estimated or cached.
          </p>
        </div>

        <button className="hidden items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:underline sm:inline-flex dark:text-blue-400">
          <Mail className="size-3.5" />
          Send feedback
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {COUNTRY_PILLS.map((pill) => (
            <Link
              key={pill.code}
              href={pillHref(pill.code)}
              className={`flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-[12px] font-semibold transition-all ${
                country === pill.code
                  ? "border-blue-500 bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              <CountryFlag code={pill.code} />
              <span>{pill.label}</span>
            </Link>
          ))}
        </div>

        <Link
          href={`/${slug}/overview?country=${country}${includeSearch ? "" : "&search=1"}`}
          className={`rounded-[6px] border px-3 py-1.5 text-[12px] font-semibold transition-all ${
            includeSearch
              ? "border-blue-500 bg-blue-50/80 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          }`}
          title="Where the domain ranks for its own name. Spends search API credits."
        >
          {includeSearch ? "Search visibility: on" : "Include search visibility"}
        </Link>
      </div>

      <Suspense
        key={`${project.domain}-${country}-${includeSearch}`}
        fallback={<ReportSkeleton host={domain} />}
      >
        <DomainReport domain={project.domain} country={country} includeSearch={includeSearch} />
      </Suspense>
    </div>
  );
}
