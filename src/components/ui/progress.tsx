import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  tone = "accent",
}: {
  value: number;
  className?: string;
  tone?: "accent" | "success" | "critical" | "warning";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const bar = {
    accent: "bg-accent",
    success: "bg-success",
    critical: "bg-critical",
    warning: "bg-warning",
  }[tone];

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-notice-subtle",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]",
          bar,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
