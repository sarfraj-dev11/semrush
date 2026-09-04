import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const fieldStyles =
  "w-full rounded-[10px] border border-border bg-surface px-3.5 text-[14px] text-foreground transition-colors duration-200 placeholder:text-subtle-foreground focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-subtle disabled:opacity-50";

export function Input({ className, style, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(fieldStyles, "h-11 px-4 py-2.5", className)}
      style={{ paddingLeft: "16px", paddingRight: "16px", ...style }}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldStyles, "min-h-20 resize-y py-2 leading-6", className)}
      {...props}
    />
  );
}

export function NativeSelect({ className, style, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        fieldStyles,
        "h-11 appearance-none cursor-pointer px-4 py-2.5 pr-10",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%239ca3af%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')]",
        "bg-[position:right_14px_center] bg-[size:16px_16px] bg-no-repeat",
        className,
      )}
      style={{ paddingLeft: "16px", paddingRight: "40px", ...style }}
      {...props}
    />
  );
}

export { fieldStyles };
