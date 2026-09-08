"use client";

import { useState } from "react";
import { Clock, Play, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runRankCheckAction, syncFirebaseDataAction } from "./tracking-actions";

export function DailyTrackingBanner({
  projectId,
  projectName,
  lastChecked,
  totalKeywords,
}: {
  projectId: number;
  projectName: string;
  lastChecked?: string | null;
  totalKeywords: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRunCheck = async () => {
    if (loading) return;
    setLoading(true);
    setFeedback(null);

    try {
      const res = await runRankCheckAction(projectId);
      if (res.success) {
        setFeedback(`✅ ${res.message}`);
        router.refresh();
      } else {
        setFeedback(`⚠️ ${res.message}`);
      }
    } catch (err) {
      console.error("❌ Failed to trigger rank check:", err);
      setFeedback(`❌ ${err instanceof Error ? err.message : "Error running check"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFirebase = async () => {
    if (syncing) return;
    setSyncing(true);
    setFeedback(null);

    try {
      const res = await syncFirebaseDataAction(projectId);
      if (res.success) {
        setFeedback(`✅ ${res.message}`);
        router.refresh();
      } else {
        setFeedback(`⚠️ ${res.message}`);
      }
    } catch (err) {
      console.error("❌ Failed to fetch Firebase data:", err);
      setFeedback(`❌ ${err instanceof Error ? err.message : "Error fetching from Firebase"}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-gradient-to-r from-surface via-surface to-surface-muted/60 p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
            <Clock className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[14px] font-semibold text-foreground">
                Automated Daily Google Rank Check
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active · 6:00 PM IST
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Checks <strong className="text-foreground">{totalKeywords} keywords</strong> across the{" "}
              <strong className="text-foreground">Top 10 Google Pages (Positions 1–100)</strong> for{" "}
              <strong className="text-foreground">all targeted countries &amp; devices</strong> every day at{" "}
              <strong className="text-foreground">6:00 PM IST</strong>.
              {lastChecked ? (
                <span className="ml-2 font-medium text-foreground">
                  Last checked: {lastChecked}
                </span>
              ) : (
                <span className="ml-2 text-amber-500">Last checked: Never</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncFirebase}
            disabled={syncing || loading}
            className="h-9 gap-1.5 px-3 font-medium text-[12px] shadow-xs"
            title="Fetch latest rankings and keywords from Firebase"
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing…" : "Fetch from Firebase"}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleRunCheck}
            disabled={loading || totalKeywords === 0}
            className="h-9 gap-1.5 px-4 font-semibold shadow-xs"
          >
            {loading ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                Checking Top 10 Pages…
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" />
                Check Rankings Now
              </>
            )}
          </Button>
        </div>
      </div>

      {feedback ? (
        <div className="mt-3 rounded-lg border border-border bg-surface-muted/60 px-3.5 py-2 text-[12px] font-medium text-foreground">
          {feedback}
        </div>
      ) : null}
    </div>
  );
}
