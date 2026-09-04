"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CountrySelect } from "../domain-overview/country-select";
import { ScopeSelect } from "./scope-select";

export function CompareDomainsForm({
  action = "/compare-domains",
  defaultDomain = "",
  initialDomains,
  initialCountry = "US",
  submitLabel = "Compare",
}: {
  /** Route the submitted domains are sent to; the form is shared by three reports. */
  action?: string;
  defaultDomain?: string;
  initialDomains?: string[];
  initialCountry?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [country, setCountry] = useState(initialCountry);
  const [domains, setDomains] = useState<string[]>(
    initialDomains && initialDomains.length >= 2
      ? initialDomains
      : [defaultDomain, ""]
  );
  const [scopes, setScopes] = useState<string[]>(domains.map(() => "root"));

  const handleDomainChange = (index: number, value: string) => {
    const updated = [...domains];
    updated[index] = value;
    setDomains(updated);
  };

  const handleClear = (index: number) => {
    const updated = [...domains];
    updated[index] = "";
    setDomains(updated);
  };

  const handleAddCompetitor = () => {
    if (domains.length < 5) {
      setDomains([...domains, ""]);
      setScopes([...scopes, "root"]);
    }
  };

  const handleRemove = (index: number) => {
    if (domains.length > 2) {
      setDomains(domains.filter((_, i) => i !== index));
      setScopes(scopes.filter((_, i) => i !== index));
    }
  };

  const handleScopeChange = (index: number, newScope: string) => {
    const updated = [...scopes];
    updated[index] = newScope;
    setScopes(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = domains
      .map((d) => d.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
      .filter(Boolean);

    const params = new URLSearchParams();
    if (valid.length > 0) {
      params.set("domains", valid.join(","));
    }
    if (country) {
      params.set("country", country);
    }

    startTransition(() => {
      router.push(`${action}?${params.toString()}`);
    });
  };

  const colors = [
    "bg-indigo-600",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-pink-500",
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {domains.map((d, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row items-center gap-2">
          {/* Domain input */}
          <div className="relative flex-1 w-full">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center">
              <span
                className={`size-2.5 rounded-full ${
                  idx === 0 ? colors[0] : d ? colors[idx] : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              />
            </div>

            <input
              type="text"
              value={d}
              onChange={(e) => handleDomainChange(idx, e.target.value)}
              placeholder={idx === 0 ? "Enter domain" : "Add domain"}
              className="w-full rounded-[6px] border border-border bg-surface pl-8 pr-8 py-2 text-[14px] text-foreground placeholder:text-muted-foreground shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 h-[42px]"
            />

            {d && (
              <button
                type="button"
                onClick={() => handleClear(idx)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Custom Scope Select Dropdown */}
          <ScopeSelect
            value={scopes[idx] || "root"}
            onChange={(val) => handleScopeChange(idx, val)}
          />

          {idx >= 2 && (
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="text-muted-foreground hover:text-red-500 p-2"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      ))}

      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div>
          {domains.length < 5 ? (
            <button
              type="button"
              onClick={handleAddCompetitor}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Plus className="size-4" />
              <span>Add up to {5 - domains.length} competitors</span>
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <CountrySelect selected={country} onSelect={setCountry} />

          <button
            type="submit"
            disabled={isPending}
            className="rounded-[6px] bg-zinc-950 px-7 text-[14px] font-bold text-white shadow-sm hover:bg-zinc-800 active:scale-[0.98] transition-all dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 h-[42px] whitespace-nowrap disabled:opacity-70 cursor-pointer"
          >
            {isPending ? "Opening..." : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
