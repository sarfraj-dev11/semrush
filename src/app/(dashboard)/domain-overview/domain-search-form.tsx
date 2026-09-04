"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CountrySelect } from "./country-select";

function SearchButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-[42px] whitespace-nowrap rounded-[6px] bg-zinc-950 px-6 text-[14px] font-bold text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
    >
      {pending ? "Analysing…" : "Search"}
    </button>
  );
}

/**
 * A plain GET form: the domain lives in the URL, so a report can be linked,
 * reloaded and shared, and the browser handles the navigation without any
 * client-side fetching.
 */
export function DomainSearchForm({
  defaultDomain = "",
  defaultCountry = "WW",
}: {
  defaultDomain?: string;
  defaultCountry?: string;
}) {
  const [country, setCountry] = useState(defaultCountry);
  const [domain, setDomain] = useState(defaultDomain);

  return (
    <div>
      <form
        method="get"
        action="/domain-overview"
        className="mx-auto flex max-w-2xl flex-col items-stretch gap-2.5 sm:flex-row"
      >
        <input type="hidden" name="country" value={country} />
        <div className="relative flex-1">
          <input
            type="text"
            name="domain"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            required
            placeholder="Enter domain, subdomain or URL"
            className="h-[42px] w-full rounded-[6px] border border-border bg-surface px-4 py-2.5 text-[14px] text-foreground shadow-2xs placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <CountrySelect selected={country} onSelect={setCountry} />

        <SearchButton />
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[12px] text-muted-foreground">
        <span>Examples:</span>
        {["nextjs.org", "example.com"].map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setDomain(example)}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
