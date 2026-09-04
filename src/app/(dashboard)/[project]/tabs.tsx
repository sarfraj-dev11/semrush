"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const projectTabs = [
  { segment: "", label: "Overview" },
  { segment: "audit", label: "Audit" },
  { segment: "pages", label: "Pages" },
  { segment: "links", label: "Links" },
  { segment: "performance", label: "Performance" },
  { segment: "keywords", label: "Keywords" },
  { segment: "rankings", label: "Rankings" },
  { segment: "backlinks", label: "Backlinks" },
  { segment: "competitors", label: "Competitors" },
  { segment: "tasks", label: "Tasks" },
  { segment: "report", label: "Report" },
];

export function ProjectTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/${slug}`;

  return (
    <div className="mb-6 border-b border-border/80">
      <nav className="flex min-w-max gap-1 overflow-x-auto no-scrollbar">
        {projectTabs.map(({ segment, label }) => {
          const href = segment ? `${base}/${segment}` : base;
          const active = segment
            ? pathname === href || pathname.startsWith(`${href}/`)
            : pathname === base;

          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative px-3.5 py-2.5 text-[13px] font-semibold transition-colors duration-150 whitespace-nowrap select-none",
                active
                  ? "text-blue-600 dark:text-blue-400 after:absolute after:inset-x-0 after:-bottom-px after:h-[2.5px] after:rounded-full after:bg-blue-600 dark:after:bg-blue-400 font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
