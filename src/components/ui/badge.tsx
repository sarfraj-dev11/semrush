import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-tight whitespace-nowrap transition-colors",
  {
    variants: {
      tone: {
        neutral:
          "border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300",
        accent:
          "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 font-semibold",
        critical:
          "border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/30 text-red-700 dark:text-red-400",
        warning:
          "border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300",
        notice:
          "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400",
        success:
          "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
        outline:
          "border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-600 dark:text-zinc-400",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props} />
  );
}

/** Small filled circle used in dense rows where a full badge is too heavy. */
export function Dot({
  tone = "neutral",
  className,
}: {
  tone?: "critical" | "warning" | "notice" | "success" | "accent" | "neutral";
  className?: string;
}) {
  const colors = {
    critical: "bg-critical",
    warning: "bg-warning",
    notice: "bg-notice",
    success: "bg-success",
    accent: "bg-accent",
    neutral: "bg-subtle-foreground",
  } as const;
  return (
    <span
      className={cn("inline-block size-2 rounded-full", colors[tone], className)}
    />
  );
}

export { badgeVariants };
