"use client";

import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code,
  FileCode,
  Globe,
  HardDrive,
  Info,
  Key,
  Layers,
  Lock,
  Play,
  Save,
  Search,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveSiteAuditSettingsAndRunAction } from "./actions";

export function SiteAuditSettingsForm({
  initialDomain = "nexenbloom.com",
  initialSlug = "nexen-bloom",
  initialLimit = 500,
}: {
  initialDomain?: string;
  initialSlug?: string;
  initialLimit?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Active section tab
  const [activeTab, setActiveTab] = useState<
    "scope" | "limits" | "crawler" | "rules" | "params" | "auth" | "schedule"
  >("scope");

  // Form states
  const [domain, setDomain] = useState(initialDomain);
  const [scopeMode, setScopeMode] = useState<"subdomains" | "exact" | "subfolder">("subdomains");
  const [startUrl, setStartUrl] = useState(`https://${initialDomain}/`);
  const [respectRobots, setRespectRobots] = useState(true);

  // Limits
  const [pageLimit, setPageLimit] = useState(initialLimit);
  const [crawlSource, setCrawlSource] = useState<"site" | "sitemap_auto" | "sitemap_custom" | "file">("sitemap_auto");
  const [sitemapUrl, setSitemapUrl] = useState(`https://${initialDomain}/sitemap.xml`);

  // Crawler
  const [userAgent, setUserAgent] = useState("SemrushBot-Desktop");
  const [crawlDelay, setCrawlDelay] = useState("min");

  // Rules
  const [disallowRules, setDisallowRules] = useState("/cart\n/checkout\n/admin\n*?session_id=*");
  const [allowRules, setAllowRules] = useState("/blog/*\n/products/*");

  // URL Parameters
  const [ignoreParams, setIgnoreParams] = useState(true);
  const [paramsList, setParamsList] = useState("utm_source, utm_medium, utm_campaign, gclid, fbclid, session_id");

  // Authentication
  const [useAuth, setUseAuth] = useState(false);
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");

  // Schedule
  const [schedule, setSchedule] = useState("weekly_monday");
  const [emailNotify, setEmailNotify] = useState(true);
  const [healthAlert, setHealthAlert] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveSiteAuditSettingsAndRunAction({
        slugOrId: initialSlug,
        domain,
        scopeMode,
        startUrl,
        respectRobots,
        pageLimit,
        crawlSource,
        sitemapUrl,
        userAgent,
        crawlDelay,
        disallowRules,
        allowRules,
        ignoreParams,
        paramsList,
        useAuth,
        authUser,
        authPass,
        schedule,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to save settings and run audit.");
        return;
      }

      toast.success("Site Audit settings saved and crawl started!");
      router.push(`/${result.slug || initialSlug}/audit`);
    });
  };

  const navItems = [
    { id: "scope", label: "1. Scope & Domain", icon: Globe },
    { id: "limits", label: "2. Limit of Pages & Source", icon: Layers },
    { id: "crawler", label: "3. Crawler & User-Agent", icon: Sliders },
    { id: "rules", label: "4. URL Disallow / Allow Rules", icon: Shield },
    { id: "params", label: "5. Parameter Stripping", icon: Code },
    { id: "auth", label: "6. HTTP Auth & Staging", icon: Lock },
    { id: "schedule", label: "7. Schedule & Triggers", icon: Clock },
  ] as const;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Top Banner Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span>&gt;</span>
            <Link href="/site-audit" className="hover:text-foreground">Site Audit</Link>
            <span>&gt;</span>
            <span className="text-foreground font-semibold">Settings</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Site Audit Settings:</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">{domain}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/${initialSlug}/audit`}>Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="rounded-[6px] bg-zinc-950 font-bold text-white dark:bg-white dark:text-zinc-950 px-5 h-8.5 shadow-sm"
          >
            <Save className="size-3.5 mr-1.5" />
            {isPending ? "Saving..." : "Save and Run Audit"}
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Tabs Nav & Right Tab Content */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Nav Tabs */}
        <div className="lg:col-span-4 space-y-1">
          <div className="rounded-xl border border-border bg-surface p-2 shadow-xs space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-left text-[13px] font-semibold transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border-l-[3.5px] border-blue-600 pl-3"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <Check className="size-3.5 text-blue-600 dark:text-blue-400" />}
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-4 text-[12px] text-muted-foreground dark:border-blue-900/40 dark:bg-blue-950/20">
            <span className="font-bold text-foreground block mb-1">Crawl Quota Info</span>
            Your plan allows up to 20,000 pages per crawl with unlimited crawls per month.
          </div>
        </div>

        {/* Right Settings Pane */}
        <div className="lg:col-span-8 space-y-6">
          {/* SECTION 1: Scope & Domain */}
          {activeTab === "scope" && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-5 animate-in fade-in-0 duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-[16px] font-bold text-foreground">Domain & Crawl Scope</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Set the primary domain and specify how subdomains and paths should be included.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-foreground">Primary Domain</label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full rounded-[6px] border border-border bg-surface px-3.5 py-2 text-[13px] text-foreground shadow-2xs focus:border-blue-500 focus:outline-none h-10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-foreground">Crawl Scope</label>
                  <div className="grid gap-2">
                    {(
                      [
                        { id: "subdomains", label: "Crawl all subdomains (*.domain.com)", desc: "Includes blog.domain.com, app.domain.com, shop.domain.com" },
                        { id: "exact", label: "Crawl only the entered domain / subdomain", desc: "Strictly stays on www.domain.com and ignores other subdomains" },
                        { id: "subfolder", label: "Crawl specific subfolder only", desc: "Limits the audit to URLs beginning with the start URL path" },
                      ] as const
                    ).map((opt) => (
                      <label
                        key={opt.id}
                        onClick={() => setScopeMode(opt.id)}
                        className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                          scopeMode === opt.id
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                            : "border-border bg-surface hover:bg-surface-muted/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name="scopeMode"
                          checked={scopeMode === opt.id}
                          onChange={() => setScopeMode(opt.id)}
                          className="mt-0.5 text-blue-600"
                        />
                        <div>
                          <span className="text-[13px] font-bold text-foreground block">{opt.label}</span>
                          <span className="text-[11px] text-muted-foreground mt-0.5 block">{opt.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border">
                  <label className="text-[13px] font-semibold text-foreground">Start URL</label>
                  <input
                    type="url"
                    value={startUrl}
                    onChange={(e) => setStartUrl(e.target.value)}
                    className="w-full rounded-[6px] border border-border bg-surface px-3.5 py-2 text-[13px] text-foreground shadow-2xs focus:border-blue-500 focus:outline-none h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">The crawler begins discovery from this starting point.</p>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={respectRobots}
                      onChange={(e) => setRespectRobots(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Respect robots.txt instructions (Recommended)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: Limit of Pages & Crawl Source */}
          {activeTab === "limits" && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-5 animate-in fade-in-0 duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-[16px] font-bold text-foreground">Limit of Pages & Crawl Source</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Choose how many pages to audit and where the crawler should discover URLs.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-foreground">Page Limit per Audit</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[100, 500, 2000, 5000].map((lim) => (
                      <button
                        key={lim}
                        type="button"
                        onClick={() => setPageLimit(lim)}
                        className={`py-2 px-3 rounded-lg border text-center font-bold text-[13px] transition-all ${
                          pageLimit === lim
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                            : "border-border bg-surface text-foreground hover:bg-surface-muted"
                        }`}
                      >
                        {lim.toLocaleString()} pages
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <label className="text-[13px] font-semibold text-foreground">Crawl Source</label>
                  <div className="grid gap-2">
                    {(
                      [
                        { id: "sitemap_auto", label: "Sitemaps on site (Recommended)", desc: "Auto-detects /sitemap.xml and crawls all indexed URLs" },
                        { id: "site", label: "Website (Follow Internal Links)", desc: "Crawls by following HTML hyperlinks found across pages" },
                        { id: "sitemap_custom", label: "Enter custom sitemap URL", desc: "Specifies an exact XML sitemap or sitemap index URL" },
                        { id: "file", label: "URLs from uploaded list", desc: "Upload a text or CSV file containing a list of target URLs" },
                      ] as const
                    ).map((src) => (
                      <label
                        key={src.id}
                        onClick={() => setCrawlSource(src.id)}
                        className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                          crawlSource === src.id
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                            : "border-border bg-surface hover:bg-surface-muted/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name="crawlSource"
                          checked={crawlSource === src.id}
                          onChange={() => setCrawlSource(src.id)}
                          className="mt-0.5 text-blue-600"
                        />
                        <div>
                          <span className="text-[13px] font-bold text-foreground block">{src.label}</span>
                          <span className="text-[11px] text-muted-foreground mt-0.5 block">{src.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {crawlSource === "sitemap_custom" && (
                  <div className="space-y-1.5 pl-6 border-l-2 border-blue-500">
                    <label className="text-[12px] font-semibold text-foreground">Custom Sitemap URL</label>
                    <input
                      type="url"
                      value={sitemapUrl}
                      onChange={(e) => setSitemapUrl(e.target.value)}
                      placeholder="https://example.com/custom-sitemap.xml"
                      className="w-full rounded-[6px] border border-border bg-surface px-3 py-1.5 text-[12px] text-foreground focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 3: Crawler & User-Agent */}
          {activeTab === "crawler" && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-5 animate-in fade-in-0 duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-[16px] font-bold text-foreground">Crawler Details & User-Agent</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Select the bot identity and adjust crawl speed to prevent overloading your web server.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-foreground">User-Agent Identifier</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { id: "SemrushBot-Desktop", label: "SemrushBot-Desktop", desc: "Simulates desktop browser indexing" },
                      { id: "SemrushBot-Mobile", label: "SemrushBot-Mobile", desc: "Mobile-first audit indexing" },
                      { id: "Googlebot-Desktop", label: "Googlebot-Desktop", desc: "Tests response against Googlebot user-agent" },
                      { id: "Googlebot-Mobile", label: "Googlebot-Mobile", desc: "Mobile Googlebot crawler emulation" },
                    ].map((bot) => (
                      <button
                        key={bot.id}
                        type="button"
                        onClick={() => setUserAgent(bot.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          userAgent === bot.id
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                            : "border-border bg-surface hover:bg-surface-muted"
                        }`}
                      >
                        <span className="font-bold text-[13px] text-foreground block">{bot.label}</span>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">{bot.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <label className="text-[13px] font-semibold text-foreground">Crawl Delay & Rate</label>
                  <div className="grid gap-2">
                    {[
                      { id: "min", label: "Minimum delay (Recommended)", desc: "High performance parallel crawling" },
                      { id: "1s", label: "1 URL every second", desc: "Gentle crawling for shared hosting" },
                      { id: "2s", label: "1 URL every 2 seconds", desc: "Ultra-safe mode for fragile APIs" },
                    ].map((rate) => (
                      <label
                        key={rate.id}
                        onClick={() => setCrawlDelay(rate.id)}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                          crawlDelay === rate.id
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                            : "border-border bg-surface hover:bg-surface-muted/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name="crawlDelay"
                          checked={crawlDelay === rate.id}
                          onChange={() => setCrawlDelay(rate.id)}
                          className="mt-0.5 text-blue-600"
                        />
                        <div>
                          <span className="text-[13px] font-bold text-foreground block">{rate.label}</span>
                          <span className="text-[11px] text-muted-foreground block">{rate.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: URL Disallow / Allow Rules */}
          {activeTab === "rules" && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-5 animate-in fade-in-0 duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-[16px] font-bold text-foreground">URL Disallow & Allow Rules</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Exclude non-public sections (cart, checkout, admin) or restrict the audit to specific directories.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-foreground">Disallow URLs (Blacklist)</label>
                  <textarea
                    rows={4}
                    value={disallowRules}
                    onChange={(e) => setDisallowRules(e.target.value)}
                    className="w-full rounded-[6px] border border-border bg-surface p-3 font-mono text-[12px] text-foreground focus:border-blue-500 focus:outline-none"
                    placeholder="/cart&#10;/admin&#10;*?session=*"
                  />
                  <p className="text-[11px] text-muted-foreground">Enter one URL pattern per line. Supports * wildcards.</p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border">
                  <label className="text-[13px] font-semibold text-foreground">Allow URLs (Whitelist)</label>
                  <textarea
                    rows={3}
                    value={allowRules}
                    onChange={(e) => setAllowRules(e.target.value)}
                    className="w-full rounded-[6px] border border-border bg-surface p-3 font-mono text-[12px] text-foreground focus:border-blue-500 focus:outline-none"
                    placeholder="/blog/*&#10;/products/*"
                  />
                  <p className="text-[11px] text-muted-foreground">If specified, only URLs matching these patterns will be crawled.</p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: Parameter Stripping */}
          {activeTab === "params" && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-5 animate-in fade-in-0 duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-[16px] font-bold text-foreground">Removal of URL Parameters</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Avoid duplicate pages by stripping tracking parameters like UTM tags, click IDs, and session IDs.
                </p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ignoreParams}
                    onChange={(e) => setIgnoreParams(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Strip tracking and session URL parameters</span>
                </label>

                {ignoreParams && (
                  <div className="space-y-1.5 pl-6 border-l-2 border-blue-500">
                    <label className="text-[12px] font-semibold text-foreground">Parameters to Ignore</label>
                    <input
                      type="text"
                      value={paramsList}
                      onChange={(e) => setParamsList(e.target.value)}
                      className="w-full rounded-[6px] border border-border bg-surface px-3 py-2 text-[12px] text-foreground focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-muted-foreground">Comma-separated query string parameters to strip during crawl.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 6: HTTP Auth & Staging */}
          {activeTab === "auth" && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-5 animate-in fade-in-0 duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-[16px] font-bold text-foreground">HTTP Authentication & Staging Bypass</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Audit pre-production staging sites or password-protected staging environments.
                </p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAuth}
                    onChange={(e) => setUseAuth(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Website requires HTTP Basic Authentication</span>
                </label>

                {useAuth && (
                  <div className="grid gap-3 sm:grid-cols-2 pl-6 border-l-2 border-blue-500">
                    <div className="space-y-1">
                      <label className="text-[12px] font-semibold text-foreground">HTTP Username</label>
                      <input
                        type="text"
                        value={authUser}
                        onChange={(e) => setAuthUser(e.target.value)}
                        placeholder="staging_user"
                        className="w-full rounded-[6px] border border-border bg-surface px-3 py-1.5 text-[12px] text-foreground focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[12px] font-semibold text-foreground">HTTP Password</label>
                      <input
                        type="password"
                        value={authPass}
                        onChange={(e) => setAuthPass(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-[6px] border border-border bg-surface px-3 py-1.5 text-[12px] text-foreground focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 7: Schedule & Triggers */}
          {activeTab === "schedule" && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-xs space-y-5 animate-in fade-in-0 duration-150">
              <div className="border-b border-border pb-3">
                <h2 className="text-[16px] font-bold text-foreground">Schedule & Notifications</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Set automatic recurring audits and email alert triggers.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-foreground">Audit Frequency</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { id: "weekly_monday", label: "Weekly (Every Monday at 09:00)" },
                      { id: "daily", label: "Daily (Every morning at 06:00)" },
                      { id: "monthly", label: "Monthly (1st of every month)" },
                      { id: "manual", label: "Never (Run manually only)" },
                    ].map((sc) => (
                      <label
                        key={sc.id}
                        onClick={() => setSchedule(sc.id)}
                        className={`flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer ${
                          schedule === sc.id
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-bold"
                            : "border-border bg-surface text-foreground hover:bg-surface-muted"
                        }`}
                      >
                        <input
                          type="radio"
                          name="schedule"
                          checked={schedule === sc.id}
                          onChange={() => setSchedule(sc.id)}
                          className="text-blue-600"
                        />
                        <span className="text-[13px]">{sc.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-border">
                  <label className="text-[13px] font-semibold text-foreground block">Email Notifications</label>
                  <label className="flex items-center gap-2.5 text-[13px] text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailNotify}
                      onChange={(e) => setEmailNotify(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Send me an email summary whenever a crawl completes</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-[13px] text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={healthAlert}
                      onChange={(e) => setHealthAlert(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Send an immediate alert if Site Health drops by more than 5%</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Save Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button variant="secondary" asChild>
              <Link href={`/${initialSlug}/audit`}>Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="rounded-[6px] bg-zinc-950 font-bold text-white dark:bg-white dark:text-zinc-950 px-6 h-9 shadow-sm"
            >
              <Save className="size-3.5 mr-1.5" />
              {isPending ? "Saving..." : "Save and Run Audit"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
