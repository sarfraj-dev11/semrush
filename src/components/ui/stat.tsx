import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "neutral" | "critical" | "warning" | "notice" | "success" | "accent";
  className?: string;
}) {
  const toneText = {
    neutral: "text-foreground",
    critical: "text-critical",
    warning: "text-warning",
    notice: "text-notice",
    success: "text-success",
    accent: "text-accent",
  }[tone];

  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-lg border border-border bg-surface px-5 py-4 shadow-xs transition-colors",
        className,
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {Icon ? <Icon className="size-4 text-subtle-foreground" /> : null}
        </div>
        <p
          className={cn(
            "mt-2.5 text-[26px] font-bold leading-none tracking-tight tabular-nums",
            toneText,
          )}
        >
          {value}
        </p>
      </div>
      {hint ? (
        <p className="mt-3 text-[12px] text-subtle-foreground">{hint}</p>
      ) : (
        <div className="mt-3 h-[18px]" aria-hidden="true" />
      )}
    </div>
  );
}
