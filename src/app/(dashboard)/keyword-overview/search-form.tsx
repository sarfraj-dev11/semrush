"use client";

import { ChevronDown, MapPin, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CountrySelect } from "../domain-overview/country-select";

export function KeywordSearchForm({
  variant = "hero",
  initialKeyword = "",
  initialCountry = "US",
}: {
  variant?: "hero" | "compact" | "cta";
  initialKeyword?: string;
  initialCountry?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [keyword, setKeyword] = useState(initialKeyword);
  const [domain, setDomain] = useState("");
  const [country, setCountry] = useState(initialCountry);
  const [location, setLocation] = useState("");

  const handleExampleClick = (eg: string) => {
    setKeyword(eg);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    startTransition(() => {
      router.push(
        `/keyword-overview?q=${encodeURIComponent(keyword.trim())}&country=${country}`
      );
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      {/* Top Header: Keywords count & examples */}
      <div className="flex flex-wrap items-center justify-between text-[12px] text-muted-foreground">
        <span className="font-medium underline decoration-dotted">
          {variant === "hero" ? "Keywords 0/100" : "Keyword tips"}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>Examples:</span>
          <button
            type="button"
            onClick={() => handleExampleClick("loans")}
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            loans
          </button>
          <button
            type="button"
            onClick={() => handleExampleClick("movies")}
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            movies
          </button>
          <button
            type="button"
            onClick={() => handleExampleClick("how to buy audible books")}
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            how to buy audible books
          </button>
        </div>
      </div>

      {/* Main Keyword Input */}
      <div>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={
            variant === "hero"
              ? "Enter keywords separated by commas"
              : "Enter keyword"
          }
          className="w-full rounded-[6px] border border-blue-500 bg-surface px-4 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground shadow-2xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 h-[44px]"
        />
      </div>

      {/* Secondary Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        {/* Domain input */}
        <div className="relative flex-1 w-full">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-purple-600" />
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Enter domain for personalized data"
            className="w-full rounded-[6px] border border-border bg-surface pl-8 pr-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none h-[38px]"
          />
        </div>

        {/* Country Picker */}
        <div className="w-full sm:w-auto">
          <CountrySelect selected={country} onSelect={setCountry} />
        </div>

        {/* Location Dropdown */}
        <div className="relative w-full sm:w-44">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-[6px] border border-border bg-surface px-3 py-2 text-[12px] font-medium text-muted-foreground hover:bg-surface-muted h-[38px]"
          >
            <span className="flex items-center gap-1.5 truncate">
              <MapPin className="size-3.5" />
              <span>Select location</span>
            </span>
            <ChevronDown className="size-3 shrink-0" />
          </button>
        </div>

        {/* Submit Search Button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto rounded-[6px] bg-zinc-950 px-6 text-[13px] font-bold text-white shadow-sm hover:bg-zinc-800 active:scale-[0.98] transition-all dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 h-[38px] cursor-pointer"
        >
          {isPending ? "Searching..." : "Search"}
        </button>
      </div>
    </form>
  );
}
