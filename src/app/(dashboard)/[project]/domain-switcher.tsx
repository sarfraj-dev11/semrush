"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toProjectSlug } from "@/lib/slug-utils";
import { hostnameOf } from "@/lib/utils";

interface ProjectItem {
  id: number;
  name: string;
  domain: string;
}

interface DomainSwitcherProps {
  currentSlug: string;
  currentDomain: string;
  projects: ProjectItem[];
}

function SiteFavicon({ domain }: { domain: string }) {
  const [error, setError] = useState(false);
  const cleanHost = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${cleanHost}&sz=64`;

  if (error || !cleanHost) {
    return (
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300 text-[11px] font-bold uppercase">
        {cleanHost.charAt(0) || "W"}
      </div>
    );
  }

  return (
    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-2xs border border-zinc-200/80 dark:border-zinc-700 dark:bg-zinc-800">
      <img
        src={faviconUrl}
        alt=""
        width={18}
        height={18}
        className="size-4.5 rounded-full object-contain"
        onError={() => setError(true)}
      />
    </div>
  );
}

export function DomainSwitcher({
  currentSlug,
  currentDomain,
  projects,
}: DomainSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Ensure current project is in list even if not yet saved in all
  const activeProject =
    projects.find((p) => toProjectSlug(p.name) === currentSlug) || {
      id: 0,
      name: currentDomain,
      domain: currentDomain,
    };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold underline underline-offset-4 decoration-blue-500/50 hover:decoration-blue-600 transition-all cursor-pointer select-none"
      >
        <span>{currentDomain}</span>
        <ChevronDown
          className={`size-4 text-blue-600 dark:text-blue-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 sm:w-80 rounded-lg border border-zinc-200 bg-white shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 dark:border-zinc-800 dark:bg-[#18181d]">
          {/* Project List */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-64 overflow-y-auto">
            {projects.length > 0 ? (
              projects.map((p) => {
                const pSlug = toProjectSlug(p.name);
                const pDomain = hostnameOf(p.domain) || p.domain;
                const isActive = pSlug === currentSlug;

                return (
                  <Link
                    key={p.id}
                    href={`/${pSlug}`}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors ${
                      isActive
                        ? "bg-[#dbeafe] dark:bg-blue-950/60 border-l-[3.5px] border-black dark:border-white pl-3"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60 pl-3.5"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Actual Site Favicon */}
                      <SiteFavicon domain={p.domain} />

                      <div className="min-w-0 leading-tight truncate">
                        <div className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate">
                          {p.name}
                        </div>
                        <div className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {pDomain}
                        </div>
                      </div>
                    </div>

                    {isActive ? (
                      <Check className="size-4 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />
                    ) : null}
                  </Link>
                );
              })
            ) : (
              /* Fallback active row if no projects array */
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#dbeafe] dark:bg-blue-950/60 border-l-[3.5px] border-black dark:border-white pl-3">
                <div className="flex items-center gap-3 min-w-0">
                  <SiteFavicon domain={activeProject.domain} />

                  <div className="min-w-0 leading-tight truncate">
                    <div className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate">
                      {activeProject.name}
                    </div>
                    <div className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {activeProject.domain}
                    </div>
                  </div>
                </div>

                <Check className="size-4 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />
              </div>
            )}
          </div>

          {/* Footer: Create new SEO project */}
          <div className="border-t border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-[#18181d]">
            <Link
              href="/projects"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-4 py-2.5 text-[13px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
            >
              <span>Create new SEO project</span>
              <Plus className="size-4 text-blue-600 dark:text-blue-400" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
