"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  FileCheck2,
  Info,
  Layers,
  Lightbulb,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/* ------------------------------------------------------------------------- */
/* 1. SITE HEALTH INFO MODAL                                                 */
/* ------------------------------------------------------------------------- */
interface SiteHealthInfoModalProps {
  healthScore: number;
  pagesCrawled: number;
  criticalCount: number;
  warningCount: number;
  noticeCount: number;
  slug: string;
}

export function SiteHealthInfoModal({
  healthScore,
  pagesCrawled,
  criticalCount,
  warningCount,
  noticeCount,
  slug,
}: SiteHealthInfoModalProps) {
  const [open, setOpen] = useState(false);

  const rating =
    healthScore >= 80 ? "Good" : healthScore >= 50 ? "Fair" : "Poor";
  const ratingColor =
    healthScore >= 80
      ? "text-emerald-500"
      : healthScore >= 50
        ? "text-amber-500"
        : "text-red-500";
  const ratingBg =
    healthScore >= 80
      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
      : healthScore >= 50
        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
        : "bg-red-500/10 text-red-500 border-red-500/20";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="How is Site Health calculated?"
          className="group rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
          title="Click to learn how Site Health is calculated"
        >
          <Info className="size-3.5 group-hover:scale-110 transition-transform text-muted-foreground group-hover:text-foreground" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-xl p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="border-b border-border bg-surface-muted/30 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-[17px] font-bold text-foreground">
                About Site Health Score
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground mt-0.5">
                How technical SEO health and issue weights are calculated
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5 px-6 py-5">
          {/* Current Score Spotlight */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/20 p-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Current Audit Score
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-black font-display ${ratingColor}`}>
                  {healthScore}%
                </span>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase ${ratingBg}`}
                >
                  {rating}
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Based on{" "}
                <span className="font-semibold text-foreground">
                  {pagesCrawled} crawled pages
                </span>
                .
              </p>
            </div>

            <div className="text-right space-y-1">
              <div className="text-[11px] text-muted-foreground">
                Detected Issues:
              </div>
              <div className="flex items-center gap-2 font-mono text-[12px]">
                <span className="text-red-500 font-bold" title="Critical Errors">
                  {criticalCount} err
                </span>
                <span>·</span>
                <span className="text-amber-500 font-bold" title="Warnings">
                  {warningCount} warn
                </span>
                <span>·</span>
                <span className="text-blue-500 font-bold" title="Notices">
                  {noticeCount} not
                </span>
              </div>
            </div>
          </div>

          {/* What is Site Health */}
          <div className="space-y-2">
            <h4 className="text-[13px] font-bold text-foreground">
              What is Site Health?
            </h4>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Site Health is an industry-standard 0–100% metric that measures
              your website&apos;s technical SEO condition. It evaluates
              crawlability, indexability, metadata completeness, internal link
              architecture, and security.
            </p>
          </div>

          {/* Calculation Methodology & Weights */}
          <div className="space-y-2.5">
            <h4 className="text-[13px] font-bold text-foreground">
              How It&apos;s Calculated
            </h4>
            <div className="rounded-lg bg-surface-muted/40 p-3.5 border border-border/70 text-[12px] space-y-2">
              <p className="text-muted-foreground">
                Each detected issue applies a penalty weight based on severity.
                Scores normalize across the site size so small and large sites
                are evaluated fairly:
              </p>
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div className="rounded-md border border-red-500/20 bg-red-500/5 p-2 text-center">
                  <div className="text-red-600 dark:text-red-400 font-bold">
                    Errors
                  </div>
                  <div className="text-muted-foreground text-[10px] mt-0.5">
                    Weight: 3.0×
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 font-sans">
                    5xx, 404s, fetch fails
                  </div>
                </div>
                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-center">
                  <div className="text-amber-600 dark:text-amber-400 font-bold">
                    Warnings
                  </div>
                  <div className="text-muted-foreground text-[10px] mt-0.5">
                    Weight: 1.0×
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 font-sans">
                    Orphans, duplicates, slow
                  </div>
                </div>
                <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2 text-center">
                  <div className="text-blue-600 dark:text-blue-400 font-bold">
                    Notices
                  </div>
                  <div className="text-muted-foreground text-[10px] mt-0.5">
                    Weight: 0.25×
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 font-sans">
                    Redirects, minor alts
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Score Thresholds */}
          <div className="space-y-2">
            <h4 className="text-[13px] font-bold text-foreground">
              Score Benchmarks
            </h4>
            <div className="space-y-1.5 text-[12px]">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-foreground">
                  80% – 100% (Good):
                </span>
                <span className="text-muted-foreground">
                  Healthy technical SEO foundation with minimal critical risks.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500" />
                <span className="font-semibold text-foreground">
                  50% – 79% (Fair):
                </span>
                <span className="text-muted-foreground">
                  Issues detected that may impede search bot indexing or user experience.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-red-500" />
                <span className="font-semibold text-foreground">
                  Below 50% (Poor):
                </span>
                <span className="text-muted-foreground">
                  Urgent technical blockers preventing effective search engine crawling.
                </span>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="border-t border-border bg-surface-muted/30 px-6 py-3 flex items-center justify-between sm:justify-between">
          <Button
            variant="secondary"
            size="sm"
            className="text-[12px]"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>

          {warningCount > 0 ? (
            <Button
              variant="primary"
              size="sm"
              className="text-[12px] bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1.5"
              asChild
            >
              <Link href={`/${slug}/audit/warnings`} target="_blank">
                <span>View All {warningCount} Warnings</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="text-[12px]"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------- */
/* 2. CRITICAL ERRORS INFO MODAL                                             */
/* ------------------------------------------------------------------------- */
export function ErrorsInfoModal({
  criticalCount,
  slug,
}: {
  criticalCount: number;
  slug?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="What are Critical Errors?"
          className="group rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
          title="Click to learn about Critical Errors"
        >
          <Info className="size-3.5 group-hover:scale-110 transition-transform text-muted-foreground group-hover:text-foreground" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="border-b border-border bg-surface-muted/30 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500 dark:bg-red-500/20">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-[16px] font-bold text-foreground">
                Critical Errors
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground mt-0.5">
                Highest priority issues impacting search indexing
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4 px-6 py-5 text-[12.5px] leading-relaxed">
          <p className="text-muted-foreground">
            <strong className="text-foreground">Critical Errors</strong> represent severe technical barriers that prevent search engine crawlers from reaching, rendering, or indexing your pages.
          </p>

          <div className="rounded-lg bg-red-500/5 p-3.5 border border-red-500/20 space-y-2">
            <span className="font-bold text-[11px] uppercase tracking-wider text-red-600 dark:text-red-400 block">
              Common Examples:
            </span>
            <ul className="list-disc list-inside space-y-1 text-[12px] text-muted-foreground">
              <li>HTTP 5xx Server Errors (crashes, timeouts)</li>
              <li>HTTP 4xx Client Errors on internal links (broken pages)</li>
              <li>DNS lookup or TLS/SSL certificate failures</li>
              <li>Robots.txt blocks on essential indexable content</li>
            </ul>
          </div>

          <div className="text-[12px] text-muted-foreground">
            <strong>Scoring Impact:</strong> Errors carry the heaviest penalty weight (<span className="font-mono text-red-500 font-bold">3.0×</span>) in your overall Site Health score. Fixing errors yields the fastest score improvements.
          </div>
        </DialogBody>

        <DialogFooter className="border-t border-border bg-surface-muted/30 px-6 py-3 flex items-center justify-between sm:justify-between">
          <Button
            variant="secondary"
            size="sm"
            className="text-[12px]"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>

          {slug && criticalCount > 0 ? (
            <Button
              variant="primary"
              size="sm"
              className="text-[12px] bg-red-600 hover:bg-red-700 text-white font-semibold gap-1.5"
              asChild
            >
              <Link href={`/${slug}/pages?filter=broken`}>
                <span>View {criticalCount} Broken Pages</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="text-[12px]"
              onClick={() => setOpen(false)}
            >
              Got it
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------- */
/* 3. WARNINGS INFO MODAL                                                    */
/* ------------------------------------------------------------------------- */
export function WarningsInfoModal({
  warningCount,
  slug,
}: {
  warningCount: number;
  slug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="What are Warnings?"
          className="group rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
          title="Click to learn about Warnings"
        >
          <Info className="size-3.5 group-hover:scale-110 transition-transform text-muted-foreground group-hover:text-foreground" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="border-b border-border bg-surface-muted/30 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 dark:bg-amber-500/20">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-[16px] font-bold text-foreground">
                Audit Warnings
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground mt-0.5">
                Medium-priority technical issues impacting SEO performance
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4 px-6 py-5 text-[12.5px] leading-relaxed">
          <p className="text-muted-foreground">
            <strong className="text-foreground">Warnings</strong> represent medium-priority technical flaws that do not completely break page rendering, but degrade crawl budget efficiency, internal link equity, and search rankings.
          </p>

          <div className="rounded-lg bg-amber-500/5 p-3.5 border border-amber-500/20 space-y-2">
            <span className="font-bold text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
              Common Examples:
            </span>
            <ul className="list-disc list-inside space-y-1 text-[12px] text-muted-foreground">
              <li>Orphan pages (pages without incoming internal links)</li>
              <li>Duplicate &lt;title&gt; tags or meta descriptions</li>
              <li>Slow server response time (&gt;1,000 ms)</li>
              <li>Broken external links or redirect chains</li>
              <li>Missing or incorrect URLs in sitemap.xml</li>
            </ul>
          </div>

          <div className="text-[12px] text-muted-foreground">
            <strong>Scoring Impact:</strong> Warnings carry a <span className="font-mono text-amber-500 font-bold">1.0×</span> penalty weight in your overall Site Health calculation.
          </div>
        </DialogBody>

        <DialogFooter className="border-t border-border bg-surface-muted/30 px-6 py-3 flex items-center justify-between sm:justify-between">
          <Button
            variant="secondary"
            size="sm"
            className="text-[12px]"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>

          <Button
            variant="primary"
            size="sm"
            className="text-[12px] bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1.5"
            asChild
          >
            <Link href={`/${slug}/audit/warnings`} target="_blank">
              <span>View All {warningCount} Warnings</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------- */
/* 4. NOTICES INFO MODAL                                                     */
/* ------------------------------------------------------------------------- */
export function NoticesInfoModal({
  noticeCount,
}: {
  noticeCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="What are Notices?"
          className="group rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
          title="Click to learn about Notices"
        >
          <Info className="size-3.5 group-hover:scale-110 transition-transform text-muted-foreground group-hover:text-foreground" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="border-b border-border bg-surface-muted/30 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 dark:bg-blue-500/20">
              <Lightbulb className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-[16px] font-bold text-foreground">
                Audit Notices
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground mt-0.5">
                Best-practice suggestions and minor optimizations
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4 px-6 py-5 text-[12.5px] leading-relaxed">
          <p className="text-muted-foreground">
            <strong className="text-foreground">Notices</strong> are advisory recommendations that do not indicate a broken website, but highlight opportunities to polish SEO, markup, and accessibility.
          </p>

          <div className="rounded-lg bg-blue-500/5 p-3.5 border border-blue-500/20 space-y-2">
            <span className="font-bold text-[11px] uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
              Common Examples:
            </span>
            <ul className="list-disc list-inside space-y-1 text-[12px] text-muted-foreground">
              <li>Pages with non-canonical status or self-canonicals</li>
              <li>Redirect hops or chain optimizations</li>
              <li>Minor image alt text recommendations</li>
              <li>Structured data markup opportunities</li>
            </ul>
          </div>

          <div className="text-[12px] text-muted-foreground">
            <strong>Scoring Impact:</strong> Notices carry a minimal penalty weight (<span className="font-mono text-blue-500 font-bold">0.25×</span>) in your Site Health calculation.
          </div>
        </DialogBody>

        <DialogFooter className="border-t border-border bg-surface-muted/30 px-6 py-3">
          <Button
            variant="secondary"
            size="sm"
            className="text-[12px]"
            onClick={() => setOpen(false)}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------- */
/* 5. CRAWLED PAGES INFO MODAL                                               */
/* ------------------------------------------------------------------------- */
export function CrawledPagesInfoModal({
  pagesCrawled,
  crawlLimit,
}: {
  pagesCrawled: number;
  crawlLimit: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="About Crawled Pages"
          className="group rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
          title="Click to learn about Crawled Pages"
        >
          <Info className="size-3.5 group-hover:scale-110 transition-transform text-muted-foreground group-hover:text-foreground" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="border-b border-border bg-surface-muted/30 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-500/10 text-zinc-500 dark:bg-zinc-500/20">
              <Layers className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-[16px] font-bold text-foreground">
                Crawled Pages & Distribution
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground mt-0.5">
                Page status classification across your site
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4 px-6 py-5 text-[12.5px] leading-relaxed">
          <p className="text-muted-foreground">
            During an audit, our crawler navigates your website up to your project&apos;s limit ({pagesCrawled} of {crawlLimit} max). Each discovered page is analyzed and grouped into one of five categories:
          </p>

          <div className="space-y-2 text-[12px]">
            <div className="flex items-start gap-2">
              <span className="size-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <div>
                <strong className="text-foreground">Healthy:</strong> Pages returning HTTP 200 with zero critical issues or warnings.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="size-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <div>
                <strong className="text-foreground">Broken:</strong> Pages returning HTTP 4xx or 5xx or failing network requests.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="size-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
              <div>
                <strong className="text-foreground">Have issues:</strong> Pages that load successfully but trigger warnings or notices.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="size-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <div>
                <strong className="text-foreground">Redirects:</strong> Pages returning HTTP 301 or 302 redirect responses.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="size-2 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
              <div>
                <strong className="text-foreground">Blocked:</strong> URLs prohibited by robots.txt rules.
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="border-t border-border bg-surface-muted/30 px-6 py-3">
          <Button
            variant="secondary"
            size="sm"
            className="text-[12px]"
            onClick={() => setOpen(false)}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------- */
/* 6. AI SEARCH HEALTH INFO MODAL                                            */
/* ------------------------------------------------------------------------- */
export function AISearchInfoModal() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="About AI Search Health"
          className="group rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
          title="Click to learn about AI Search Readiness"
        >
          <Info className="size-3.5 group-hover:scale-110 transition-transform text-muted-foreground group-hover:text-foreground" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="border-b border-border bg-surface-muted/30 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 dark:bg-purple-500/20">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-[16px] font-bold text-foreground">
                AI Search Readiness (GEO)
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground mt-0.5">
                Generative Engine Optimization for modern AI assistants
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4 px-6 py-5 text-[12.5px] leading-relaxed">
          <p className="text-muted-foreground">
            Measures how readily AI assistants (like ChatGPT, Perplexity, Claude, and Gemini) can discover, parse, and cite your website in AI answers.
          </p>

          <div className="rounded-lg bg-purple-500/5 p-3.5 border border-purple-500/20 space-y-2 text-[12px]">
            <span className="font-bold text-[11px] uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
              Key Evaluation Factors:
            </span>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">llms.txt:</strong> Machine-readable AI navigation manifesto file.</li>
              <li><strong className="text-foreground">AI Bot Permissions:</strong> Allows GPTBot, ClaudeBot, PerplexityBot in robots.txt.</li>
              <li><strong className="text-foreground">Schema.org:</strong> Rich JSON-LD structured data for entity recognition.</li>
              <li><strong className="text-foreground">Semantic HTML:</strong> Use of &lt;article&gt;, &lt;header&gt;, &lt;nav&gt; tags.</li>
            </ul>
          </div>
        </DialogBody>

        <DialogFooter className="border-t border-border bg-surface-muted/30 px-6 py-3">
          <Button
            variant="secondary"
            size="sm"
            className="text-[12px]"
            onClick={() => setOpen(false)}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------- */
/* 7. ROBOTS.TXT INFO MODAL                                                  */
/* ------------------------------------------------------------------------- */
export function RobotsTxtInfoModal({ sitemapUrls }: { sitemapUrls?: number | null }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="About robots.txt"
          className="group rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
          title="Click to learn about robots.txt"
        >
          <Info className="size-3 text-muted-foreground group-hover:text-foreground" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md p-0 overflow-hidden border border-border shadow-2xl">
        <DialogHeader className="border-b border-border bg-surface-muted/30 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-500/10 text-zinc-500 dark:bg-zinc-500/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-[16px] font-bold text-foreground">
                About robots.txt
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground mt-0.5">
                Crawler instructions & sitemap discovery
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4 px-6 py-5 text-[12.5px] leading-relaxed">
          <p className="text-muted-foreground">
            <strong className="text-foreground">robots.txt</strong> gives instructions to web robots (search engines and AI agents) about which parts of your site should or should not be crawled.
          </p>

          <div className="rounded-lg bg-surface-muted/40 p-3.5 border border-border space-y-2 text-[12px]">
            <span className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground block">
              Key Elements Checked:
            </span>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Presence at domain root (<code className="text-[11px] font-mono">/robots.txt</code>)</li>
              <li>Declaration of XML Sitemap directive(s)</li>
              <li>Directives for major search bots & AI crawlers</li>
              <li>Disallowed paths and potential crawl blocks</li>
            </ul>
          </div>
        </DialogBody>

        <DialogFooter className="border-t border-border bg-surface-muted/30 px-6 py-3">
          <Button
            variant="secondary"
            size="sm"
            className="text-[12px]"
            onClick={() => setOpen(false)}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

