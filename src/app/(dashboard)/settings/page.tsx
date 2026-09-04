import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { db } from "@/db";
import { backlinks, crawlPages, keywords, projects, settings } from "@/db/schema";
import { formatNumber } from "@/lib/utils";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [allSettings, allProjects, allPages, allKeywords, allBacklinks] =
    await Promise.all([
      db.select().from(settings),
      db.select().from(projects),
      db.select({ id: crawlPages.id }).from(crawlPages),
      db.select({ id: keywords.id }).from(keywords),
      db.select({ id: backlinks.id }).from(backlinks),
    ]);

  const settingsMap = new Map(allSettings.map((s) => [s.key, s.value ?? ""]));
  const initialPsiKey =
    settingsMap.get("psi_api_key") || settingsMap.get("pagespeed_api_key") || "";
  const defaultDepth = settingsMap.get("default_crawl_depth") || "3";
  const defaultLimit = settingsMap.get("default_crawl_limit") || "500";
  const defaultConcurrency = settingsMap.get("default_crawl_concurrency") || "4";
  const defaultUserAgent =
    settingsMap.get("default_user_agent") ||
    "Mozilla/5.0 (compatible; AntigravitySEO/1.0; +https://antigravity.io)";

  return (
    <div className="space-y-6 pb-24 pt-1 text-foreground animate-in">
      <PageHeader
        title="Workspace Settings"
        description="Configure your SEO crawler defaults, API integrations, and inspect real database storage metrics."
      />

      {/* Real Workspace Portfolio Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="Managed Projects"
          value={formatNumber(allProjects.length)}
          hint="Active websites monitored"
        />
        <Stat
          label="Crawled Pages"
          value={formatNumber(allPages.length)}
          hint="Stored in local database"
        />
        <Stat
          label="Tracked Keywords"
          value={formatNumber(allKeywords.length)}
          hint="Keyword ranking items"
        />
        <Stat
          label="Monitored Backlinks"
          value={formatNumber(allBacklinks.length)}
          hint="Active link profiles"
        />
      </div>

      {/* Settings Form connected to SQLite */}
      <SettingsForm
        initialPsiKey={initialPsiKey}
        defaultDepth={defaultDepth}
        defaultLimit={defaultLimit}
        defaultConcurrency={defaultConcurrency}
        defaultUserAgent={defaultUserAgent}
      />
    </div>
  );
}
