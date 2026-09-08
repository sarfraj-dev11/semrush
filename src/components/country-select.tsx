"use client";

import { useEffect, useMemo, useState } from "react";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Globe, Plus, Search, X } from "lucide-react";
import {
  ALL_COUNTRIES,
  getCountryFlagUrl,
  detectUserCountry,
  detectCountryFromIP,
} from "@/lib/countries";
import { cn } from "@/lib/utils";

interface CountrySelectProps {
  name?: string;
  id?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (codes: string) => void;
  className?: string;
  autoDetect?: boolean;
}

export function CountrySelect({
  name = "targetCountry",
  id = "targetCountry",
  defaultValue,
  value,
  onChange,
  className,
  autoDetect = true,
}: CountrySelectProps) {
  // Parse initial selection (supports "US,IN" or "US", or auto-detects)
  const initialCodes = useMemo(() => {
    const raw = (value ?? defaultValue)?.trim();
    if (raw) {
      const list = raw
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      if (list.length > 0) return list;
    }
    if (typeof window !== "undefined" && autoDetect) {
      const detected = detectUserCountry();
      if (detected) return [detected];
    }
    return ["US"];
  }, [value, defaultValue, autoDetect]);

  const [selectedCodes, setSelectedCodes] = useState<string[]>(initialCodes);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Auto-detect country on mount if creating a new project (zero permissions required)
  useEffect(() => {
    if (!autoDetect || value || defaultValue) return;

    // 1. Instant timezone & locale region detection
    const detected = detectUserCountry();
    if (detected) {
      setSelectedCodes([detected]);
      onChange?.(detected);
    }

    // 2. IP lookup fallback to double check
    detectCountryFromIP().then((ipCountry) => {
      if (ipCountry && (!selectedCodes.length || selectedCodes[0] === "US")) {
        setSelectedCodes([ipCountry]);
        onChange?.(ipCountry);
      }
    });
  }, [autoDetect, value, defaultValue, onChange]);


  const countryMap = useMemo(() => {
    return new Map(ALL_COUNTRIES.map((c) => [c.code.toUpperCase(), c.name]));
  }, []);

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_COUNTRIES;
    return ALL_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [search]);

  const toggleCountry = (code: string) => {
    const upper = code.toUpperCase();
    let next: string[];

    if (selectedCodes.includes(upper)) {
      if (selectedCodes.length === 1) return; // Keep at least one country
      next = selectedCodes.filter((c) => c !== upper);
    } else {
      if (upper === "WW") {
        next = ["WW"];
      } else {
        next = [...selectedCodes.filter((c) => c !== "WW"), upper];
      }
    }

    setSelectedCodes(next);
    onChange?.(next.join(","));
  };

  const removeCountry = (code: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const upper = code.toUpperCase();
    if (selectedCodes.length <= 1) return;
    const next = selectedCodes.filter((c) => c !== upper);
    setSelectedCodes(next);
    onChange?.(next.join(","));
  };

  // Selected country objects
  const selectedObjects = useMemo(() => {
    return selectedCodes.map((code) => ({
      code,
      name: countryMap.get(code) ?? (code === "WW" ? "Worldwide" : code),
    }));
  }, [selectedCodes, countryMap]);

  return (
    <div className="relative w-full">
      {/* Hidden input to pass comma-separated country codes to FormData */}
      <input
        type="hidden"
        name={name}
        id={id}
        value={selectedCodes.join(",")}
      />

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              "w-full rounded-[10px] border border-border bg-surface px-3.5 py-2 text-[14px] text-foreground",
              "flex min-h-11 items-center justify-between gap-2 text-left transition-colors duration-200",
              "hover:border-border-hover focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-subtle cursor-pointer",
              className,
            )}
            aria-label="Select target countries"
          >
            {/* Display selected countries */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-hidden py-0.5">
              {selectedObjects.length === 1 ? (
                <div className="flex items-center gap-2">
                  {selectedObjects[0].code === "WW" ? (
                    <Globe className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <img
                      src={getCountryFlagUrl(selectedObjects[0].code)}
                      alt={selectedObjects[0].name}
                      className="h-3.5 w-5 shrink-0 rounded-[2px] border border-border/50 object-cover shadow-xs"
                      loading="lazy"
                    />
                  )}
                  <span className="truncate font-medium text-foreground">
                    {selectedObjects[0].name}
                  </span>
                  <span className="text-[12px] font-mono text-muted-foreground">
                    ({selectedObjects[0].code})
                  </span>
                </div>
              ) : (
                selectedObjects.map((c) => (
                  <span
                    key={c.code}
                    className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2 py-1 text-[12px] font-semibold text-foreground border border-border/60"
                  >
                    {c.code === "WW" ? (
                      <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <img
                        src={getCountryFlagUrl(c.code)}
                        alt={c.name}
                        className="h-3 w-4 shrink-0 rounded-[1.5px] border border-border/40 object-cover"
                        loading="lazy"
                      />
                    )}
                    <span>{c.code}</span>
                  </span>
                ))
              )}

              {selectedObjects.length > 1 ? (
                <span className="text-[11px] font-semibold text-muted-foreground ml-1">
                  ({selectedObjects.length} countries)
                </span>
              ) : null}
            </div>

            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200 ml-1.5",
                open && "rotate-180 text-foreground",
              )}
            />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className={cn(
              "z-[70] w-[var(--radix-popover-trigger-width,380px)] min-w-[320px] max-w-md",
              "rounded-xl border border-border bg-surface p-3 shadow-2xl backdrop-blur-sm",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
            )}
          >
            {/* Header & helper */}
            <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-2">
              <div>
                <span className="text-[13px] font-semibold text-foreground">
                  Target Countries
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Select one or multiple countries to target
                </p>
              </div>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-500">
                {selectedCodes.length} selected
              </span>
            </div>

            {/* Selected Pills */}
            {selectedObjects.length > 0 ? (
              <div className="mb-2.5 flex flex-wrap items-center gap-1 max-h-16 overflow-y-auto p-1 rounded-lg bg-surface-muted/50 border border-border/50">
                {selectedObjects.map((c) => (
                  <span
                    key={c.code}
                    className="inline-flex items-center gap-1.5 rounded-md bg-surface px-2 py-0.5 text-[12px] font-medium text-foreground shadow-xs border border-border"
                  >
                    {c.code === "WW" ? (
                      <Globe className="size-3 text-muted-foreground" />
                    ) : (
                      <img
                        src={getCountryFlagUrl(c.code)}
                        alt={c.name}
                        className="h-2.5 w-3.5 shrink-0 rounded-[1px] object-cover"
                        loading="lazy"
                      />
                    )}
                    <span>{c.name}</span>
                    {selectedCodes.length > 1 ? (
                      <button
                        type="button"
                        onClick={(e) => removeCountry(c.code, e)}
                        className="rounded-full p-0.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Search Input */}
            <div className="relative mb-2 flex items-center rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 focus-within:border-accent">
              <Search className="size-3.5 shrink-0 text-muted-foreground mr-2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by country name or code…"
                className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>

            {/* Countries List */}
            <div className="max-h-60 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
              {filteredCountries.length === 0 ? (
                <div className="py-6 text-center text-[13px] text-muted-foreground">
                  No country matches &ldquo;{search}&rdquo;
                </div>
              ) : (
                filteredCountries.map((c) => {
                  const isSelected = selectedCodes.includes(c.code.toUpperCase());
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => toggleCountry(c.code)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors",
                        "hover:bg-surface-muted cursor-pointer",
                        isSelected
                          ? "bg-blue-500/10 font-semibold text-blue-600 dark:text-blue-400"
                          : "text-foreground",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {c.code === "WW" ? (
                          <Globe className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <img
                            src={getCountryFlagUrl(c.code)}
                            alt={c.name}
                            className="h-3.5 w-5 shrink-0 rounded-[2px] border border-border/50 object-cover shadow-xs"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        <span className="truncate">{c.name}</span>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-muted-foreground">
                        <span>{c.code}</span>
                        <div
                          className={cn(
                            "flex size-4 items-center justify-center rounded border transition-colors",
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
                              : "border-border bg-surface",
                          )}
                        >
                          {isSelected ? <Check className="size-3 stroke-[3]" /> : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="mt-2.5 border-t border-border/60 pt-2 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {filteredCountries.length} countries available
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-foreground px-3 py-1 text-[12px] font-semibold text-background hover:opacity-90 transition-opacity cursor-pointer"
              >
                Done
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
