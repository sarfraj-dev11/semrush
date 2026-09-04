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

export function ProjectTabs({ projectId }: { projectId: number }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <div className="mb-6 overflow-x-auto border-b border-border">
      <nav className="flex min-w-max gap-1">
        {projectTabs.map(({ segment, label }) => {
          const href = segment ? `${base}/${segment}` : base;
          // Nested routes (a single page's detail view) keep their tab lit.
          const active = segment
            ? pathname === href || pathname.startsWith(`${href}/`)
            : pathname === base;
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
                active
                  ? "text-accent after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent"
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
