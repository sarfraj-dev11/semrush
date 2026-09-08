"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface GscConnectionBannerProps {
  isConfigured: boolean;
  isConnected: boolean;
  totalClicks?: number;
  totalImpressions?: number;
  siteUrl?: string;
  error?: string;
  domain: string;
}

export function GscConnectionBanner({
  isConfigured,
  isConnected,
  totalClicks = 0,
  totalImpressions = 0,
  siteUrl,
  error,
  domain,
}: GscConnectionBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (isConnected) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-foreground shadow-xs transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-foreground">
                  Google Search Console: Connected
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  100% Real Live Google Data
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Showing real user clicks & search impressions for property:{" "}
                <span className="font-semibold text-foreground">{siteUrl || domain}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[12px]">
            <div>
              <span className="text-muted-foreground text-[11px]">Real 28-day Clicks:</span>{" "}
              <span className="font-bold text-foreground">{totalClicks.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-[11px]">Impressions:</span>{" "}
              <span className="font-bold text-foreground">{totalImpressions.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isConfigured && !isConnected) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-foreground shadow-xs transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertCircle className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-foreground">
                  Google Account Authorized ✅ — Next Step: Verify Domain
                </span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  Action Required
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-2xl">
                Your Google OAuth credentials & refresh token are connected! However, <strong className="text-foreground">{domain}</strong> is not yet added or verified under this Google Search Console account.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[12px] font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
            >
              <span>Verify {domain} in GSC</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 p-4 text-foreground shadow-xs transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
            <KeyRound className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-foreground">
                Connect Google Search Console for 100% Real Google Traffic
              </span>
              <span className="rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                Official Google API
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {error ? (
                <span className="text-red-500 font-medium flex items-center gap-1">
                  <AlertCircle className="size-3" /> Connection error: {error}
                </span>
              ) : (
                "Currently displaying SERP ranking CTR traffic. Connect GSC credentials to unlock exact Google clicks and queries."
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer"
        >
          <span>{isExpanded ? "Hide Setup Guide" : "Setup Google Search Console"}</span>
          {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 border-t border-border/60 pt-4 text-[12px] space-y-4 animate-in fade-in-50 duration-200">
          <div className="rounded-lg bg-surface p-4 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px] text-foreground flex items-center gap-1.5">
                <Sparkles className="size-4 text-blue-500" />
                How to connect in 3 simple steps:
              </span>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
              >
                Google Cloud Console
                <ExternalLink className="size-3" />
              </a>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-muted-foreground text-[12px] pl-1">
              <li>
                <strong className="text-foreground">Enable Webmasters API:</strong> In Google Cloud Console, enable the{" "}
                <code className="bg-surface-muted px-1.5 py-0.5 rounded text-[11px] text-foreground font-mono">
                  Google Search Console API
                </code>.
              </li>
              <li>
                <strong className="text-foreground">Create OAuth 2.0 Credentials:</strong> Create an OAuth Client ID (Web or Desktop) and obtain a refresh token for scope{" "}
                <code className="bg-surface-muted px-1.5 py-0.5 rounded text-[11px] text-foreground font-mono">
                  https://www.googleapis.com/auth/webmasters.readonly
                </code>.
              </li>
              <li>
                <strong className="text-foreground">Add to your project's .env.local file:</strong> Add the 3 variables below:
              </li>
            </ol>

            <div className="relative rounded-md bg-zinc-950 p-3 text-zinc-100 font-mono text-[11px] space-y-1">
              <button
                onClick={() =>
                  copyToClipboard(
                    `GSC_CLIENT_ID=your_client_id_here\nGSC_CLIENT_SECRET=your_client_secret_here\nGSC_REFRESH_TOKEN=your_refresh_token_here`,
                    "env",
                  )
                }
                className="absolute right-2.5 top-2.5 rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Copy className="size-3" />
                {copiedKey === "env" ? "Copied!" : "Copy template"}
              </button>
              <div className="text-emerald-400"># Google Search Console (Live Real Traffic)</div>
              <div>GSC_CLIENT_ID=<span className="text-amber-300">your_client_id.apps.googleusercontent.com</span></div>
              <div>GSC_CLIENT_SECRET=<span className="text-amber-300">your_client_secret</span></div>
              <div>GSC_REFRESH_TOKEN=<span className="text-amber-300">1//04your_refresh_token</span></div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Once added to <code className="text-foreground font-mono">.env.local</code>, restart the dev server and refresh this page. The system will automatically pull live Search Console clicks and query impressions!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
