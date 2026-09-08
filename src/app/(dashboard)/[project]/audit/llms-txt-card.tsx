"use client";

import { useState, useTransition } from "react";
import {
  ArrowUpRight,
  Bot,
  Info,
  RefreshCw,
  Sparkles,
} from "lucide-react";
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
import { checkLlmsTxtAction } from "@/app/(dashboard)/projects/[id]/audit/actions";

interface LlmsTxtCardProps {
  initialFound: boolean | null;
  domain: string;
}

export function LlmsTxtCard({ initialFound, domain }: LlmsTxtCardProps) {
  const [found, setFound] = useState<boolean | null>(initialFound);
  const [sizeBytes, setSizeBytes] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [infoOpen, setInfoOpen] = useState(false);

  const origin = domain.startsWith("http") ? domain : `https://${domain}`;
  const fileUrl = `${origin}/llms.txt`;

  const handleCheck = () => {
    startTransition(async () => {
      try {
        const res = await checkLlmsTxtAction(domain);
        if (res.success) {
          setFound(res.found);
          if (res.sizeBytes != null) setSizeBytes(res.sizeBytes);
        } else {
          setFound(false);
        }
      } catch (err) {
        console.error("🚨 Failed to check llms.txt availability:", err);
        setFound(false);
      }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-xs flex items-center justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-purple-500" />
          <span className="text-[13px] font-bold text-foreground">llms.txt</span>
          <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="What is llms.txt?"
                className="group rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
                title="Click to learn about llms.txt"
              >
                <Info className="size-3 text-muted-foreground group-hover:text-foreground" />
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
                      About llms.txt
                    </DialogTitle>
                    <DialogDescription className="text-[12px] text-muted-foreground mt-0.5">
                      The emerging standard for AI crawler navigation
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <DialogBody className="space-y-4 px-6 py-5 text-[12.5px] leading-relaxed">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">llms.txt</strong> is a standardized Markdown file (modeled after <code className="text-[11px] font-mono bg-surface-muted px-1 py-0.5 rounded border border-border">robots.txt</code>) designed to tell Large Language Models (like ChatGPT, Claude, and Perplexity) which pages to read and index.
                </p>

                <div className="rounded-lg bg-purple-500/5 p-3.5 border border-purple-500/20 space-y-2 text-[12px]">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
                    Why It Matters for AI Search:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Points AI assistants to clean, factual, high-priority site content.</li>
                    <li>Reduces hallucinations when AI quotes your business products or docs.</li>
                    <li>Improves your Generative Engine Optimization (GEO) score.</li>
                  </ul>
                </div>

                <div className="text-[12px] text-muted-foreground">
                  <strong>Standard Location:</strong> Hosted at the root of your domain:{" "}
                  <code className="text-foreground font-mono text-[11px] bg-surface-muted px-1.5 py-0.5 rounded border border-border">
                    {fileUrl}
                  </code>
                </div>
              </DialogBody>

              <DialogFooter className="border-t border-border bg-surface-muted/30 px-6 py-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-[12px]"
                  onClick={() => setInfoOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {found
            ? sizeBytes != null
              ? `Available · ${(sizeBytes / 1024).toFixed(1)} KB plain text`
              : "AI navigation manifesto found at root"
            : "AI crawler & LLM navigation file"}
        </p>
      </div>

      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        {isPending ? (
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
            <RefreshCw className="size-3 animate-spin text-purple-500" />
            Checking...
          </span>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[13px] font-extrabold ${
                  found
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {found ? "Found" : "Missing"}
              </span>

              <button
                type="button"
                onClick={handleCheck}
                disabled={isPending}
                className="rounded p-1 text-muted-foreground hover:text-purple-500 hover:bg-surface-muted transition-colors cursor-pointer"
                title="Check live availability now"
              >
                <RefreshCw className="size-3" />
              </button>
            </div>

            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-end gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open file <ArrowUpRight className="size-3" />
            </a>
          </>
        )}
      </div>
    </div>
  );
}
