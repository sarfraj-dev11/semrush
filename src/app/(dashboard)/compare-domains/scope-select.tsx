"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const SCOPES = [
  { id: "root", label: "Root Domain" },
  { id: "exact", label: "Exact URL" },
  { id: "subdomain", label: "Subdomain" },
  { id: "subfolder", label: "Subfolder" },
];

export function ScopeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = SCOPES.find((s) => s.id === value) || SCOPES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative w-full sm:w-44">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between rounded-[6px] border bg-surface px-3 py-2 text-[13px] font-medium text-foreground shadow-2xs transition-colors h-[42px] ${
          open ? "border-blue-500 ring-2 ring-blue-500/20" : "border-border hover:bg-surface-muted"
        }`}
      >
        <span>{current.label}</span>
        <ChevronDown
          className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full min-w-[170px] rounded-lg border border-zinc-200 bg-white shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 dark:border-zinc-800 dark:bg-[#18181d]">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 py-1">
            {SCOPES.map((scope) => {
              const isSelected = scope.id === value;
              return (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => {
                    onChange(scope.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-3.5 py-2 text-left text-[13px] transition-colors ${
                    isSelected
                      ? "bg-[#dbeafe] dark:bg-blue-950/60 border-l-[3.5px] border-black dark:border-white font-semibold text-zinc-900 dark:text-white pl-3"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60 text-zinc-800 dark:text-zinc-200 font-medium pl-3.5"
                  }`}
                >
                  <span>{scope.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
