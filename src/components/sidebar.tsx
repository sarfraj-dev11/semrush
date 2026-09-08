"use client";

import {
  Activity,
  AreaChart,
  Award,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crown,
  FileStack,
  FolderKanban,
  GitCompare,
  Globe2,
  KeyRound,
  LayoutGrid,
  Lightbulb,
  LineChart,
  Link as LinkIcon,
  Link2,
  Network,
  PenTool,
  Plus,
  Radio,
  ScanSearch,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Workflow,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { deleteProjectAction } from "@/app/(dashboard)/projects/actions";
import { isReservedSegment, toProjectSlug } from "@/lib/slug-utils";
import { cn } from "@/lib/utils";

export interface SidebarProject {
  id: number;
  name: string;
  domain: string;
  targetCountry?: string;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  getPath: (slug: string) => string;
  isActive: (pathname: string, slug: string) => boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

export function SidebarNav({
  onNavigate,
  defaultProjectSlug = "",
  projects = [],
}: {
  onNavigate?: () => void;
  /** Project to scope links to when the URL is not itself a project. */
  defaultProjectSlug?: string;
  projects?: SidebarProject[];
}) {
  const pathname = usePathname();
  const [projectsExpanded, setProjectsExpanded] = useState(true);

  // Extract active project slug or id from pathname (e.g. "/acme-cloud/audit" -> "acme-cloud")
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0] || "";

  // Only a segment that is not one of the standalone pages can be a project.
  // Reading the slug off the URL without this check made every standalone page
  // look like a project, so the project links pointed at, say,
  // "/domain-overview/keywords" — a project that does not exist.
  const urlSlug =
    firstSegment && !isReservedSegment(firstSegment) ? firstSegment : "";

  /*
   * Project-scoped items need a project. Off a project page there is none in
   * the URL, and sending the user to the project list instead of the report
   * they clicked is a dead end — so fall back to a real project supplied by the
   * layout. `isActive` still keys off the URL slug, so a fallback link never
   * highlights as the current page.
   */
  const activeSlug = urlSlug || defaultProjectSlug;

  const navigationSections: NavSection[] = [
    {
      items: [
        {
          label: "Dashboard",
          icon: LayoutGrid,
          getPath: (slug) => (slug ? `/${slug}` : "/"),
          isActive: (path) =>
            path === "/" ||
            (!path.includes("/audit") &&
              !path.includes("/rankings") &&
              !path.includes("/overview") &&
              !path.includes("/keywords") &&
              !path.includes("/pages") &&
              !path.includes("/competitors") &&
              !path.includes("/backlinks") &&
              !path.includes("/links") &&
              !path.includes("/performance") &&
              !path.includes("/tasks") &&
              !path.includes("/report") &&
              !path.includes("/imports") &&
              !path.includes("/settings") &&
              !path.includes("/jobs") &&
              !path.includes("/clients") &&
              !path.includes("/projects")),
        },
        {
          label: "Projects",
          icon: FolderKanban,
          getPath: () => "/projects",
          isActive: (path) =>
            path === "/projects" || path.startsWith("/projects/"),
        },
      ],
    },
    {
      title: "Site Performance",
      items: [
        {
          label: "Site Audit",
          icon: ScanSearch,
          getPath: () => "/site-audit",
          isActive: (path) =>
            path === "/site-audit" ||
            path.endsWith("/audit") ||
            path.includes("/audit?"),
        },
        {
          label: "Position Tracking",
          icon: TrendingUp,
          getPath: () => "/position-tracking",
          isActive: (path) =>
            path === "/position-tracking" ||
            path.endsWith("/rankings") ||
            path.includes("/rankings?"),
        },
      ],
    },
    {
      title: "Competitive Analysis",
      items: [
        {
          label: "Domain Overview",
          icon: Globe2,
          getPath: () => "/domain-overview",
          isActive: (path) =>
            path === "/domain-overview" ||
            path.endsWith("/overview") ||
            path.includes("/overview?"),
        },
        {
          label: "Organic Rankings",
          icon: BarChart3,
          getPath: (slug) => (slug ? `/${slug}/keywords` : "/projects"),
          isActive: (path, slug) =>
            Boolean(slug) &&
            (path === `/${slug}/keywords` || path === `/projects/${slug}/keywords`) &&
            !path.includes("filter="),
        },
        {
          label: "Top Pages",
          icon: FileStack,
          getPath: (slug) => (slug ? `/${slug}/pages` : "/projects"),
          isActive: (path, slug) =>
            Boolean(slug) &&
            (path.startsWith(`/${slug}/pages`) || path.startsWith(`/projects/${slug}/pages`)),
        },
        {
          label: "Compare Domains",
          icon: GitCompare,
          getPath: () => "/compare-domains",
          isActive: (path) =>
            path === "/compare-domains" ||
            path.endsWith("/competitors") ||
            path.includes("/competitors?"),
        },
        {
          label: "Keyword Gap",
          icon: Target,
          getPath: () => "/keyword-gap",
          isActive: (path) =>
            path === "/keyword-gap" ||
            (path.includes("filter=gap") && path.includes("keywords")),
        },
        {
          label: "Backlink Gap",
          icon: Link2,
          getPath: () => "/backlink-gap",
          isActive: (path) =>
            path === "/backlink-gap" ||
            (path.includes("filter=gap") && path.includes("backlinks")),
        },
      ],
    },
    {
      title: "Keyword Research",
      items: [
        {
          label: "Keyword Overview",
          icon: KeyRound,
          getPath: () => "/keyword-overview",
          isActive: (path) => path.startsWith("/keyword-overview"),
        },
        {
          label: "Keyword Magic Tool",
          icon: Sparkles,
          getPath: () => `/imports`,
          isActive: (path) => path.startsWith("/imports"),
        },
        {
          label: "Keyword Strategy Builder",
          icon: Workflow,
          getPath: (slug) => (slug ? `/${slug}/tasks` : "/projects"),
          isActive: (path, slug) =>
            Boolean(slug) && (path === `/${slug}/tasks` || path === `/projects/${slug}/tasks`),
        },
      ],
    },
    {
      title: "Content Ideas",
      items: [
        {
          label: "SEO Writing Assistant",
          icon: PenTool,
          getPath: (slug) => (slug ? `/${slug}/report` : "/projects"),
          isActive: (path, slug) =>
            Boolean(slug) && (path === `/${slug}/report` || path === `/projects/${slug}/report`),
        },
        {
          label: "Topic Research",
          icon: Lightbulb,
          getPath: (slug) => (slug ? `/${slug}/keywords?filter=topics` : "/projects"),
          isActive: (path) => path.includes("topics"),
        },
      ],
    },
    {
      title: "Link Building",
      items: [
        {
          label: "Backlinks",
          icon: LinkIcon,
          getPath: (slug) => (slug ? `/${slug}/backlinks` : "/projects"),
          isActive: (path, slug) =>
            Boolean(slug) &&
            (path === `/${slug}/backlinks` || path === `/projects/${slug}/backlinks`) &&
            !path.includes("view=") &&
            !path.includes("filter="),
        },
        {
          label: "Referring Domains",
          icon: Share2,
          getPath: (slug) => (slug ? `/${slug}/links` : "/projects"),
          isActive: (path, slug) =>
            Boolean(slug) && (path === `/${slug}/links` || path === `/projects/${slug}/links`),
        },
        {
          label: "Backlink Audit",
          icon: ShieldCheck,
          getPath: (slug) => (slug ? `/${slug}/backlinks?view=audit` : "/projects"),
          isActive: (path) => path.includes("view=audit"),
        },
      ],
    },
    {
      title: "Extras",
      items: [
        {
          label: "Sensor",
          icon: Radio,
          getPath: (slug) => (slug ? `/${slug}/performance` : "/projects"),
          isActive: (path, slug) =>
            Boolean(slug) &&
            (path === `/${slug}/performance` || path === `/projects/${slug}/performance`) &&
            !path.includes("tab="),
        },
        {
          label: "SEOquake",
          icon: Zap,
          getPath: (slug) => (slug ? `/${slug}/audit?view=quick` : "/projects"),
          isActive: (path) => path.includes("view=quick"),
        },
        {
          label: "Semrush Rank",
          icon: Crown,
          getPath: (slug) => (slug ? `/${slug}/rankings?tab=rank` : "/projects"),
          isActive: (path) => path.includes("tab=rank"),
        },
      ],
    },
    {
      title: "Other",
      items: [
        {
          label: "On Page SEO Checker",
          icon: CheckCircle2,
          getPath: (slug) => (slug ? `/${slug}/audit?tab=onpage` : "/projects"),
          isActive: (path) => path.includes("tab=onpage"),
        },
        {
          label: "Organic Traffic Insights",
          icon: AreaChart,
          getPath: (slug) => (slug ? `/${slug}/performance?tab=traffic` : "/projects"),
          isActive: (path) => path.includes("tab=traffic"),
        },
      ],
    },
    {
      title: "Configuration",
      items: [
        {
          label: "Settings",
          icon: SlidersHorizontal,
          getPath: () => "/settings",
          isActive: (path) => path.startsWith("/settings"),
        },
      ],
    },
  ];

  return (
    <nav className="flex flex-col gap-6 px-3 pb-8">
      {navigationSections.map((section, sIdx) => (
        <div key={section.title ?? `section-${sIdx}`} className="flex flex-col gap-0.5">
          {section.title ? (
            <p className="px-3.5 mb-1.5 text-[10px] font-bold tracking-[0.14em] text-zinc-500 uppercase select-none">
              {section.title}
            </p>
          ) : null}

          {section.items.map((item) => {
            const targetPath = item.getPath(activeSlug);
            // Highlighting keys off the URL's own project, never the fallback,
            // so a link that merely points somewhere sensible is not shown as
            // the page you are on.
            const active = item.isActive(pathname, urlSlug);

            const Icon = item.icon;

            const isProjectsTab = item.label === "Projects";

            return (
              <div key={item.label} className="flex flex-col">
                <div className="flex items-center justify-between">
                  <Link
                    href={targetPath}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex flex-1 items-center justify-between rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150",
                      active
                        ? "bg-white/12 text-white shadow-xs font-bold"
                        : "text-zinc-400 hover:bg-white/6 hover:text-white",
                    )}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          active
                            ? "text-white stroke-[2]"
                            : "text-zinc-400 group-hover:text-white stroke-[1.8]",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isProjectsTab && projects.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-zinc-300 font-mono font-semibold">
                          {projects.length}
                        </span>
                      )}
                      {active ? (
                        <div className="size-1.5 rounded-full bg-white animate-pulse shrink-0 ml-1" />
                      ) : null}
                    </div>
                  </Link>

                  {isProjectsTab && projects.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectsExpanded((prev) => !prev);
                      }}
                      className="p-1.5 ml-1 text-zinc-500 hover:text-white hover:bg-white/6 rounded-lg transition-colors cursor-pointer"
                      title={projectsExpanded ? "Collapse projects" : "Expand projects"}
                      aria-label="Toggle projects list"
                    >
                      {projectsExpanded ? (
                        <ChevronDown className="size-3.5 text-zinc-400" />
                      ) : (
                        <ChevronRight className="size-3.5 text-zinc-400" />
                      )}
                    </button>
                  )}
                </div>

                {/* Projects Sub-list */}
                {isProjectsTab && projectsExpanded && projects.length > 0 && (
                  <div className="mt-1 ml-3.5 pl-3 border-l border-white/10 flex flex-col gap-0.5 py-1">
                    {projects.map((proj) => {
                      const pSlug = toProjectSlug(proj.name);
                      const isCurrentProject = urlSlug === pSlug;
                      const cleanHost = proj.domain
                        .replace(/^https?:\/\//, "")
                        .replace(/\/.*$/, "")
                        .toLowerCase();
                      const faviconUrl = `https://www.google.com/s2/favicons?domain=${cleanHost}&sz=32`;

                      return (
                        <div
                          key={proj.id}
                          className={cn(
                            "group/sub flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px] font-medium transition-all duration-150",
                            isCurrentProject
                              ? "bg-white/10 text-white font-semibold"
                              : "text-zinc-400 hover:bg-white/6 hover:text-white",
                          )}
                        >
                          <Link
                            href={`/${pSlug}`}
                            onClick={onNavigate}
                            title={`${proj.name} — ${cleanHost}`}
                            className="flex items-center gap-2 min-w-0 flex-1 truncate"
                          >
                            <div className="flex size-4 shrink-0 items-center justify-center rounded-xs bg-zinc-800 overflow-hidden border border-white/5">
                              <img
                                src={faviconUrl}
                                alt=""
                                className="size-3.5 object-contain"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = "none";
                                }}
                              />
                            </div>
                            <span className="truncate">{proj.name}</span>
                          </Link>

                          {/* Delete Icon Button instead of blue dot */}
                          <ConfirmDelete
                            action={deleteProjectAction}
                            id={proj.id}
                            extraInputs={{ redirectTo: "/projects" }}
                            title={`Delete ${proj.name}?`}
                            description="Every crawl, audit issue, keyword, ranking and backlink stored for this project is deleted with it. This cannot be undone."
                            confirmLabel="Delete project"
                            trigger={
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                className="text-zinc-500 hover:text-red-400 p-1 rounded-md transition-colors cursor-pointer shrink-0 ml-1 hover:bg-white/10"
                                title={`Delete ${proj.name}`}
                                aria-label={`Delete ${proj.name}`}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            }
                          />
                        </div>
                      );
                    })}

                    <Link
                      href="/projects"
                      onClick={onNavigate}
                      className="mt-0.5 flex items-center gap-1.5 px-2 py-1 text-[11px] text-zinc-500 hover:text-blue-400 transition-colors"
                    >
                      <Plus className="size-3" />
                      <span>New Project</span>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({
  defaultProjectSlug = "",
  projects = [],
}: {
  defaultProjectSlug?: string;
  projects?: SidebarProject[];
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-foreground lg:flex">
      {/* Brand Header */}
      <div className="flex h-22 items-center pt-6 pb-4 px-7 border-b border-sidebar-border/60 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="font-[family-name:var(--font-syncopate)] text-[19px] font-bold tracking-[0.2em] text-white uppercase transition-opacity group-hover:opacity-90">
            BROCUS
          </span>
        </Link>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto pt-4">
        <SidebarNav defaultProjectSlug={defaultProjectSlug} projects={projects} />
      </div>
    </aside>
  );
}
