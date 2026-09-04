"use client";

import { ChevronDown, Globe2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ALL_COUNTRIES, Country } from "@/lib/countries";

export function CountryFlag({ code, name }: { code: string; name?: string }) {
  const [error, setError] = useState(false);

  if (code === "WW") {
    return (
      <div className="flex size-5 shrink-0 items-center justify-center text-blue-500">
        <Globe2 className="size-4.5" />
      </div>
    );
  }

  if (error) {
    return (
      <span className="flex h-3.5 w-5 shrink-0 items-center justify-center rounded-[2px] bg-zinc-200 dark:bg-zinc-700 text-[9px] font-bold text-zinc-700 dark:text-zinc-300">
        {code}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      alt={name || code}
      width={20}
      height={14}
      className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover shadow-2xs border border-zinc-300/60 dark:border-zinc-700"
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}

export function CountrySelect({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const current =
    ALL_COUNTRIES.find((c) => c.code === selected) || ALL_COUNTRIES[0];

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

  const filtered = ALL_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      {/* Selector Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-[6px] border border-border bg-surface px-3 py-2 text-[13px] font-medium text-foreground shadow-2xs hover:bg-surface-muted transition-colors whitespace-nowrap h-[42px]"
      >
        <CountryFlag code={current.code} name={current.name} />
        <span>{current.name}</span>
        <ChevronDown className="size-3.5 text-muted-foreground ml-0.5" />
      </button>

      {/* Popover Menu */}
      {open && (
        <div className="absolute right-0 sm:left-0 top-full mt-1.5 z-50 w-72 rounded-[6px] border border-border bg-surface shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
          {/* Search Box */}
          <div className="p-2 border-b border-border bg-surface-muted/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by country"
                autoFocus
                className="w-full rounded-[4px] border border-border bg-surface pl-8 pr-3 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Full Country List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-border/30 p-1">
            {filtered.length > 0 ? (
              filtered.map((c) => {
                const isSelected = c.code === selected;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      onSelect(c.code);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center gap-3 rounded-[4px] px-3 py-2 text-left text-[12px] transition-colors ${
                      isSelected
                        ? "bg-blue-50 text-blue-600 font-bold dark:bg-blue-950/50 dark:text-blue-400"
                        : "hover:bg-surface-muted text-foreground"
                    }`}
                  >
                    <CountryFlag code={c.code} name={c.name} />
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-[12px] text-muted-foreground">
                No countries found matching &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
