"use client";

import { Fragment, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  Filter,
  Layers,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table as TableIcon,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface VerboseWarningItem {
  id: number;
  code: string;
  label: string;
  category: string;
  description: string;
  howToFix: string;
  detail: string | null;
  pageId: number;
  url: string;
  path: string;
  title: string | null;
  statusCode: number | null;
  depth: number;
}

interface WarningsVerboseClientProps {
  slug: string;
  projectName: string;
  domain: string;
  crawlDate: string;
  healthScore: number | null;
  warnings: VerboseWarningItem[];
}

export function WarningsVerboseClient({
  slug,
  projectName,
  domain,
  crawlDate,
  healthScore,
  warnings,
}: WarningsVerboseClientProps) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"verbose" | "table">("table");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Group counts by code
  const typeCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number; category: string }>();
    for (const w of warnings) {
      const cur = counts.get(w.code) || { label: w.label, count: 0, category: w.category };
      cur.count++;
      counts.set(w.code, cur);
    }
    return counts;
  }, [warnings]);

  // Unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const w of warnings) {
      if (w.category) cats.add(w.category);
    }
    return Array.from(cats);
  }, [warnings]);

  // Unique affected pages
  const affectedPagesCount = useMemo(() => {
    return new Set(warnings.map((w) => w.url)).size;
  }, [warnings]);

  // Filtered warnings
  const filteredWarnings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return warnings.filter((w) => {
      if (selectedType !== "ALL" && w.code !== selectedType) return false;
      if (selectedCategory !== "ALL" && w.category !== selectedCategory) return false;
      if (!query) return true;

      return (
        w.url.toLowerCase().includes(query) ||
        (w.title && w.title.toLowerCase().includes(query)) ||
        w.label.toLowerCase().includes(query) ||
        (w.detail && w.detail.toLowerCase().includes(query)) ||
        w.description.toLowerCase().includes(query) ||
        w.howToFix.toLowerCase().includes(query)
      );
    });
  }, [warnings, search, selectedType, selectedCategory]);

  // Export to CSV
  const exportCsv = () => {
    const headers = ["ID", "Warning", "Category", "URL", "Page Title", "HTTP Status", "Detail", "Description", "How To Fix"];
    const rows = filteredWarnings.map((w) => [
      w.id,
      `"${w.label.replace(/"/g, '""')}"`,
      `"${w.category.replace(/"/g, '""')}"`,
      `"${w.url.replace(/"/g, '""')}"`,
      `"${(w.title || "").replace(/"/g, '""')}"`,
      w.statusCode || "",
      `"${(w.detail || "").replace(/"/g, '""')}"`,
      `"${w.description.replace(/"/g, '""')}"`,
      `"${w.howToFix.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${slug}-site-audit-warnings-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-24 pt-1 text-foreground animate-in">
      {/* 1. Breadcrumbs & Top Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span>&gt;</span>
            <Link href="/site-audit" className="hover:text-foreground">
              Site Audit
            </Link>
            <span>&gt;</span>
            <Link href={`/${slug}/audit`} className="hover:text-foreground">
              {projectName}
            </Link>
            <span>&gt;</span>
            <span className="font-semibold text-amber-500 dark:text-amber-400">Warnings</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/site-audit"
              className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
              title="Back to Site Audit Directory"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                <span>Site Audit Warnings:</span>
                <span className="text-amber-500 dark:text-amber-400 font-black">{domain}</span>
              </h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Detailed technical log of all medium-priority warnings detected during the crawl on {crawlDate}.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={exportCsv}
            className="rounded-[6px] text-[12px] h-8.5 px-3 border border-border shadow-xs cursor-pointer"
          >
            <Download className="size-3.5 mr-1.5" />
            Export Warnings CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="rounded-[6px] text-[12px] h-8.5 px-3 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold shadow-xs"
            asChild
          >
            <Link href={`/${slug}/audit`}>View Full Audit Overview</Link>
          </Button>
        </div>
      </div>

      {/* 2. Key Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Warnings Card */}
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Total Warnings
            </span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-[32px] font-extrabold text-amber-500 dark:text-amber-400 tabular-nums leading-none">
            {warnings.length}
          </div>
          <span className="mt-1 text-[11px] text-muted-foreground block">
            Medium priority SEO items
          </span>
        </div>

        {/* Affected Pages Card */}
        <div className="rounded-xl border border-border bg-surface p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Affected Pages
            </span>
            <Layers className="size-4 text-blue-500" />
          </div>
          <div className="mt-2 text-[32px] font-extrabold text-foreground tabular-nums leading-none">
            {affectedPagesCount}
          </div>
          <span className="mt-1 text-[11px] text-muted-foreground block">
            Unique crawled URLs
          </span>
        </div>

        {/* Warning Types Card */}
        <div className="rounded-xl border border-border bg-surface p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Issue Types
            </span>
            <Wrench className="size-4 text-purple-500" />
          </div>
          <div className="mt-2 text-[32px] font-extrabold text-foreground tabular-nums leading-none">
            {typeCounts.size}
          </div>
          <span className="mt-1 text-[11px] text-muted-foreground block">
            Distinct check failures
          </span>
        </div>

        {/* Overall Site Health Card */}
        <div className="rounded-xl border border-border bg-surface p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Site Health
            </span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-[32px] font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">
            {healthScore !== null ? `${Math.round(healthScore)}%` : "—"}
          </div>
          <span className="mt-1 text-[11px] text-muted-foreground block">
            Overall crawl health score
          </span>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by URL, page title, issue name, or detail..."
              className="w-full rounded-[6px] border border-border bg-surface-muted/60 pl-9 pr-4 py-2 text-[12px] text-foreground placeholder:text-muted-foreground shadow-2xs focus:border-amber-500 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Toggles & Filters */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-[6px] border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-foreground cursor-pointer focus:outline-none"
            >
              <option value="ALL">All Categories ({warnings.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-surface-muted p-0.5 text-[11px]">
              <button
                onClick={() => setViewMode("verbose")}
                className={`flex items-center gap-1.5 px-3 py-1 font-semibold rounded-[5px] transition-all cursor-pointer ${
                  viewMode === "verbose"
                    ? "bg-amber-500 text-zinc-950 font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <SlidersHorizontal className="size-3" />
                Verbose Cards
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1 font-semibold rounded-[5px] transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-amber-500 text-zinc-950 font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TableIcon className="size-3" />
                Data Table
              </button>
            </div>
          </div>
        </div>

        {/* Warning Type Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/60">
          <button
            onClick={() => setSelectedType("ALL")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer border ${
              selectedType === "ALL"
                ? "border-amber-500 bg-amber-500/20 text-amber-500 dark:text-amber-400 font-bold"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            All Types ({warnings.length})
          </button>
          {Array.from(typeCounts.entries()).map(([code, item]) => (
            <button
              key={code}
              onClick={() => setSelectedType(code)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                selectedType === code
                  ? "border-amber-500 bg-amber-500/20 text-amber-500 dark:text-amber-400 font-bold"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{item.label}</span>
              <span className="rounded-full bg-surface-muted px-1.5 py-0.2 text-[10px] tabular-nums">
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Filter Results Info */}
      <div className="flex items-center justify-between text-[12px] text-muted-foreground px-1">
        <span>
          Showing <strong className="text-foreground">{filteredWarnings.length}</strong> of{" "}
          <strong className="text-foreground">{warnings.length}</strong> warnings
        </span>
        {filteredWarnings.length !== warnings.length && (
          <button
            onClick={() => {
              setSearch("");
              setSelectedType("ALL");
              setSelectedCategory("ALL");
            }}
            className="text-amber-500 hover:underline font-medium cursor-pointer"
          >
            Reset all filters
          </button>
        )}
      </div>

      {/* 5. VERBOSE CARDS VIEW */}
      {viewMode === "verbose" && (
        <div className="space-y-4">
          {filteredWarnings.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-xs">
              <CheckCircle2 className="size-10 text-emerald-500 mx-auto" />
              <h3 className="mt-3 text-[15px] font-bold text-foreground">No matching warnings found</h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Try refining your search query or selecting a different warning type filter.
              </p>
            </div>
          ) : (
            filteredWarnings.map((w) => (
              <div
                key={w.id}
                className="rounded-xl border border-border bg-surface p-5 shadow-xs space-y-3.5 hover:border-amber-500/40 transition-all group"
              >
                {/* Card Header: Warning Type & Page URL */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="size-3" />
                        {w.label}
                      </span>
                      <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {w.category}
                      </span>
                      {w.statusCode && (
                        <span className="rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                          HTTP {w.statusCode}
                        </span>
                      )}
                      {w.depth !== null && (
                        <span className="text-[10px] text-muted-foreground">
                          Depth {w.depth}
                        </span>
                      )}
                    </div>

                    <div className="pt-1">
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[14px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 break-all"
                      >
                        <span>{w.url}</span>
                        <ExternalLink className="size-3.5 shrink-0 opacity-70" />
                      </a>
                      {w.title && (
                        <p className="text-[12px] text-foreground font-medium mt-0.5">
                          {w.title}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-[6px] h-7.5 px-2.5 text-[11px] font-semibold"
                      asChild
                    >
                      <Link href={`/${slug}/pages/${w.pageId}`}>Audit Page</Link>
                    </Button>
                  </div>
                </div>

                {/* Verbose Detail Box (If crawler recorded specific detail) */}
                {w.detail && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[12px]">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
                      Captured Technical Detail:
                    </span>
                    <div className="font-mono text-[11px] bg-surface-muted px-2 py-1 rounded text-foreground break-all border border-border/80">
                      {w.detail}
                    </div>
                  </div>
                )}

                {/* Technical Description & How to Fix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px] pt-1">
                  <div className="rounded-lg bg-surface-muted/40 p-3 border border-border/50">
                    <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">
                      Why this matters:
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      {w.description}
                    </p>
                  </div>

                  <div className="rounded-lg bg-emerald-500/5 p-3 border border-emerald-500/20">
                    <span className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                      <Sparkles className="size-3" />
                      How to fix:
                    </span>
                    <p className="text-foreground font-medium leading-relaxed">
                      {w.howToFix}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 6. DENSE TABLE VIEW */}
      {viewMode === "table" && (
        <div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px] border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-[10px] font-bold text-muted-foreground uppercase">
                  <th className="py-3 px-4 w-12">#</th>
                  <th className="py-3 px-3">Warning Type</th>
                  <th className="py-3 px-3">Affected Page URL</th>
                  <th className="py-3 px-3">Detail Captured</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredWarnings.map((w, i) => {
                  const isExpanded = expandedId === w.id;
                  return (
                    <Fragment key={w.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : w.id)}
                        className={`hover:bg-surface-muted/40 transition-colors cursor-pointer ${
                          isExpanded ? "bg-surface-muted/30" : ""
                        }`}
                        title="Click to expand full verbose details"
                      >
                        <td className="py-3 px-4 text-muted-foreground text-[11px] tabular-nums">
                          <div className="flex items-center gap-1.5">
                            <ChevronDown
                              className={`size-3.5 text-muted-foreground transition-transform ${
                                isExpanded ? "rotate-180 text-amber-500" : ""
                              }`}
                            />
                            <span>{i + 1}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-amber-500 dark:text-amber-400">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="size-3.5 shrink-0" />
                            <span>{w.label}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium max-w-sm truncate">
                          <a
                            href={w.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 dark:text-blue-400 hover:underline truncate block"
                            title={w.url}
                          >
                            {w.path || w.url}
                          </a>
                          {w.title && (
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {w.title}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground max-w-xs truncate">
                          {w.detail || "—"}
                        </td>
                        <td className="py-3 px-3">
                          <span className="rounded bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {w.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" asChild>
                            <Link href={`/${slug}/pages/${w.pageId}`}>Audit</Link>
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-surface-muted/20 border-b border-border">
                          <td colSpan={6} className="p-4 pl-10">
                            <div className="space-y-3">
                              {w.detail && (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[12px]">
                                  <span className="font-bold text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
                                    Captured Technical Detail:
                                  </span>
                                  <div className="font-mono text-[11px] bg-surface-muted px-2 py-1 rounded text-foreground break-all border border-border/80">
                                    {w.detail}
                                  </div>
                                </div>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                                <div className="rounded-lg bg-surface-muted/40 p-3 border border-border/50">
                                  <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">
                                    Why this matters:
                                  </span>
                                  <p className="text-muted-foreground leading-relaxed">
                                    {w.description}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-emerald-500/5 p-3 border border-emerald-500/20">
                                  <span className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                                    <Sparkles className="size-3" />
                                    How to fix:
                                  </span>
                                  <p className="text-foreground font-medium leading-relaxed">
                                    {w.howToFix}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
