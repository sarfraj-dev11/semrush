import {
  AlertTriangle,
  Bot,
  ExternalLink,
  Gauge,
  Globe2,
  Lock,
  Search,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { quickCreateProject } from "@/app/(dashboard)/quick-actions";
import { SubmitButton } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ISSUE_BY_CODE, SEVERITY_ORDER } from "@/lib/crawler/issue-catalog";
import { analyzeDomain } from "@/lib/domain-overview";
import { formatBytes, formatNumber } from "@/lib/utils";

const severityTone = {
  critical: "critical",
  warning: "warning",
  notice: "notice",
} as const;

function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "good" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-success"
      : tone === "bad"
        ? "text-critical"
        : "text-foreground";

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2.5 last:border-0 last:pb-0">
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span className={`text-right text-[13px] font-medium break-all ${toneClass}`}>
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-[24px] leading-none font-extrabold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-[11px] text-subtle-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const yesNo = (value: boolean) => (value ? "Yes" : "No");

export async function DomainReport({
  domain,
  country,
  includeSearch,
}: {
  domain: string;
  country: string;
  includeSearch: boolean;
}) {
  let report;
  try {
    report = await analyzeDomain(domain, { country, includeSearch });
  } catch (error) {
    return (
      <Card className="border-critical/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-critical">
            <AlertTriangle className="size-4" />
            Could not analyse that
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </CardContent>
      </Card>
    );
  }

  const trackButton = (
    <form action={quickCreateProject}>
      <input type="hidden" name="domain" value={report.origin} />
      <input type="hidden" name="country" value={report.country} />
      <SubmitButton variant="secondary">Track this domain</SubmitButton>
    </form>
  );

  if (report.error || !report.homepage) {
    return (
      <div className="space-y-5">
        <Card className="border-critical/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-critical">
              <AlertTriangle className="size-4" />
              {report.host} did not respond
            </CardTitle>
            {trackButton}
          </CardHeader>
          <CardContent>
            <p className="text-[13px] text-muted-foreground">{report.error}</p>
            <p className="mt-2 text-[12px] text-subtle-foreground">
              Checked {report.origin} at {report.fetchedAt.toLocaleTimeString()}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const page = report.homepage;

  const sortedIssues = report.issues
    .map((issue) => ({ ...issue, definition: ISSUE_BY_CODE.get(issue.code) }))
    .filter((issue) => issue.definition)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.definition!.severity] -
        SEVERITY_ORDER[b.definition!.severity],
    );

  const criticalCount = sortedIssues.filter(
    (issue) => issue.definition!.severity === "critical",
  ).length;
  const warningCount = sortedIssues.filter(
    (issue) => issue.definition!.severity === "warning",
  ).length;

  // The slowest sample, not the fastest: a warm connection can make one fetch
  // look impossibly quick, and overstating speed is the worse error here.
  const slowestResponse = Math.max(
    ...(report.responseTimeSamples.length > 0
      ? report.responseTimeSamples
      : [page.responseTimeMs]),
  );

  const blockedBots = report.botAccess.filter((bot) => !bot.allowed);
  const aiBots = report.botAccess.filter((bot) => bot.group === "ai");

  const searchHref = `/domain-overview?domain=${encodeURIComponent(report.input)}&country=${report.country}&search=1`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-6 shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[20px] font-extrabold tracking-tight text-foreground">
              {report.host}
            </h1>
            <Badge tone={page.statusCode === 200 ? "success" : "warning"}>
              {page.statusCode}
            </Badge>
            {page.isNoindex ? <Badge tone="critical">noindex</Badge> : null}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {page.title ?? "No title tag"}
          </p>
          <p className="mt-1 text-[11px] text-subtle-foreground">
            Measured live at {report.fetchedAt.toLocaleTimeString()} · {report.country}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={page.finalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9.5 items-center gap-1.5 rounded-[10px] border border-border px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Open site <ExternalLink className="size-3.5" />
          </a>
          {trackButton}
        </div>
      </div>

      {/* The site answered but refused us — a finding, not a failure. */}
      {report.blocked || (page.statusCode !== null && page.statusCode >= 400) ? (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="size-4" />
              {report.host} returned {page.statusCode}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {report.blocked
                ? "The site responded but refused the request, which usually means bot protection. Everything gathered outside the homepage — robots.txt, sitemaps, the CDN and security headers — is still accurate; the on-page checks below could not run because no HTML was returned."
                : "No HTML was returned, so the on-page checks below could not run. The remaining sections are still measured."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Headline numbers */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Server response"
          value={`${formatNumber(slowestResponse)} ms`}
          hint={
            report.responseTimeSamples.length > 1
              ? `Slowest of ${report.responseTimeSamples.length} live samples (${report.responseTimeSamples.map((ms) => formatNumber(ms)).join(", ")} ms)`
              : "One live sample"
          }
        />
        <Stat
          label="Sitemap URLs"
          value={formatNumber(report.sitemapUrlCount)}
          hint={
            report.robotsTxtFound
              ? `${report.declaredSitemaps} sitemap(s) declared in robots.txt`
              : "No robots.txt"
          }
        />
        <Stat
          label="Issues found"
          value={formatNumber(sortedIssues.length)}
          hint={`${criticalCount} critical · ${warningCount} warning`}
        />
        <Stat
          label="Homepage words"
          value={formatNumber(page.wordCount)}
          hint={`${formatBytes(page.sizeBytes)} of HTML`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Issues */}
        <Card>
          <CardHeader>
            <CardTitle>Homepage issues</CardTitle>
            <Badge tone={sortedIssues.length === 0 ? "success" : "warning"}>
              {sortedIssues.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {sortedIssues.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                Every check passed on the homepage.
              </p>
            ) : (
              <ul className="space-y-3">
                {sortedIssues.map((issue) => (
                  <li
                    key={issue.code}
                    className="border-b border-border pb-2.5 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start gap-2">
                      <Badge tone={severityTone[issue.definition!.severity]}>
                        {issue.definition!.severity}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground">
                          {issue.definition!.label}
                        </p>
                        {issue.detail ? (
                          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                            {issue.detail}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Indexability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="size-4 text-sky-500" />
              Indexability &amp; discovery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Fact
              label="robots.txt"
              value={yesNo(report.robotsTxtFound)}
              tone={report.robotsTxtFound ? "good" : "bad"}
            />
            <Fact label="Sitemap URLs" value={formatNumber(report.sitemapUrlCount)} />
            <Fact
              label="llms.txt"
              value={yesNo(report.llmsTxtFound)}
              tone={report.llmsTxtFound ? "good" : "neutral"}
            />
            <Fact
              label="Canonical"
              value={page.canonical ?? "Not set"}
              tone={page.canonical ? "good" : "bad"}
            />
            <Fact
              label="Meta robots"
              value={page.metaRobots ?? "Not set"}
              tone={page.isNoindex ? "bad" : "neutral"}
            />
            <Fact label="Language" value={page.lang ?? "Not set"} />
            <Fact
              label="hreflang"
              value={
                page.hreflangs.length > 0
                  ? `${page.hreflangs.length} alternates`
                  : "None"
              }
            />
          </CardContent>
        </Card>

        {/* Security & delivery */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4 text-emerald-500" />
              Security &amp; delivery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Fact
              label="HTTPS"
              value={yesNo(page.isHttps)}
              tone={page.isHttps ? "good" : "bad"}
            />
            <Fact
              label="HSTS"
              value={yesNo(page.hasHsts)}
              tone={page.hasHsts ? "good" : "bad"}
            />
            <Fact
              label="Security headers"
              value={`${report.security?.present ?? 0} of ${report.security?.total ?? 6}`}
              tone={(report.security?.present ?? 0) >= 4 ? "good" : "bad"}
            />
            <Fact label="CDN" value={report.cache?.cdn ?? "None detected"} />
            <Fact
              label="Cache-Control"
              value={report.cache?.cacheControl ?? "Not set"}
            />
            <Fact
              label="Revalidation"
              value={report.cache?.revalidatable ? "ETag or Last-Modified" : "None"}
              tone={report.cache?.revalidatable ? "good" : "neutral"}
            />
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-4 text-amber-500" />
              Markup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Fact
              label="Title"
              value={page.title ? `${page.title.length} chars` : "Missing"}
              tone={page.title ? "neutral" : "bad"}
            />
            <Fact
              label="Meta description"
              value={
                page.metaDescription ? `${page.metaDescription.length} chars` : "Missing"
              }
              tone={page.metaDescription ? "neutral" : "bad"}
            />
            <Fact
              label="Open Graph"
              value={page.ogTitle && page.ogImage ? "Complete" : "Incomplete"}
              tone={page.ogTitle && page.ogImage ? "good" : "neutral"}
            />
            <Fact label="Twitter card" value={page.twitterCard ?? "Not set"} />
            <Fact
              label="Structured data"
              value={page.structuredDataTypes.join(", ") || "None"}
              tone={page.structuredDataTypes.length > 0 ? "good" : "neutral"}
            />
            <Fact
              label="Images missing alt"
              value={`${page.imagesMissingAlt} of ${page.imageCount}`}
              tone={page.imagesMissingAlt === 0 ? "good" : "bad"}
            />
            <Fact
              label="Links"
              value={`${page.internalLinks} internal · ${page.externalLinks} external`}
            />
          </CardContent>
        </Card>

        {/* AI crawler access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 text-violet-500" />
              AI &amp; search crawler access
            </CardTitle>
            <Badge tone={blockedBots.length === 0 ? "success" : "warning"}>
              {blockedBots.length === 0 ? "All allowed" : `${blockedBots.length} blocked`}
            </Badge>
          </CardHeader>
          <CardContent>
            {!report.robotsTxtFound ? (
              <p className="text-[13px] text-muted-foreground">
                No robots.txt, so nothing is blocked by it.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {aiBots.map((bot) => (
                  <Badge key={bot.bot} tone={bot.allowed ? "outline" : "critical"}>
                    {bot.label}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Device parity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="size-4 text-teal-500" />
              Mobile vs desktop
            </CardTitle>
            {report.parityChecked ? (
              <Badge tone={report.parity.length === 0 ? "success" : "warning"}>
                {report.parity.length === 0 ? "Identical" : `${report.parity.length} differ`}
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            {!report.parityChecked ? (
              <p className="text-[13px] text-muted-foreground">
                The mobile rendition could not be fetched.
              </p>
            ) : report.parity.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                The homepage serves the same title, canonical, indexing directive and
                content to phones and desktops.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {report.parity.map((difference) => (
                  <li key={difference.field}>
                    <p className="text-[13px] font-medium capitalize text-foreground">
                      {difference.field}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      desktop: {difference.desktop}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      mobile: {difference.mobile}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search visibility — metered, so opt-in */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-4 text-blue-500" />
            Search visibility
          </CardTitle>
          {report.search.state === "ok" ? (
            <Badge tone="outline">{report.search.provider}</Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          {report.search.state === "not_requested" ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted-foreground">
                Everything above is measured first-hand and costs nothing. Looking up
                Google results spends 2 API credits.
              </p>
              <Link
                href={searchHref}
                className="shrink-0 rounded-[10px] bg-accent px-4 py-2 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
              >
                Check search visibility
              </Link>
            </div>
          ) : report.search.state === "unconfigured" ? (
            <p className="text-[13px] text-muted-foreground">
              No search provider configured. Set SEARCH_PROVIDER and its API key to
              enable this.
            </p>
          ) : report.search.state === "quota" ? (
            <p className="text-[13px] text-critical">{report.search.message}</p>
          ) : report.search.state === "error" ? (
            <p className="text-[13px] text-critical">{report.search.message}</p>
          ) : (
            <div className="space-y-4">
              <Fact
                label={`Ranks for "${report.search.brandQuery}"`}
                value={
                  report.search.brandUnavailable
                    ? "Unavailable"
                    : report.search.brandPosition
                      ? `#${report.search.brandPosition}`
                      : "Not in the top results"
                }
                tone={report.search.brandPosition === 1 ? "good" : "neutral"}
              />
              <div>
                <p className="mb-2 text-[12px] font-medium text-muted-foreground">
                  Indexed pages Google returned for site:{report.host}
                </p>
                {report.search.indexedSampleUnavailable ? (
                  <p className="text-[12px] leading-snug text-muted-foreground">
                    {report.search.indexedSampleUnavailable}
                  </p>
                ) : report.search.indexedSample.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    No results returned — the site may not be indexed.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {report.search.indexedSample.map((result) => (
                      <li key={result.url} className="truncate text-[12px]">
                        <span className="text-subtle-foreground">
                          #{result.position}
                        </span>{" "}
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          {result.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="px-1 text-[11px] leading-relaxed text-subtle-foreground">
        Every figure above was measured from {report.host} at request time. Traffic
        volume, authority scores and keyword counts are absent because they require a
        licensed search index this tool does not have — estimating them would be
        inventing numbers.
      </p>
    </div>
  );
}
