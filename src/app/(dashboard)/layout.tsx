import { desc } from "drizzle-orm";
import { Command, Search } from "lucide-react";
import { MobileNav } from "@/components/mobile-nav";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { toProjectSlug } from "@/lib/slug-utils";

export const dynamic = "force-dynamic";

/**
 * The project the sidebar scopes its links to when the current page is not
 * itself a project — the newest one, since that is almost always what someone
 * is working on. Without this, every project-scoped nav item off a standalone
 * page pointed at the project list instead of the report it names.
 */
async function defaultProjectSlug(): Promise<string> {
  try {
    const [newest] = await db
      .select({ name: projects.name })
      .from(projects)
      .orderBy(desc(projects.id))
      .limit(1);

    return newest ? toProjectSlug(newest.name) : "";
  } catch {
    // The nav must render even if the database is unavailable.
    return "";
  }
}

export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const projectSlug = await defaultProjectSlug();

  return (
    <div className="h-screen w-full overflow-hidden bg-background text-foreground flex">
      {/* Dark Luxury Sidebar */}
      <Sidebar defaultProjectSlug={projectSlug} />

      {/* Floating Canvas Shell (Payflow / Dribbble Signature Card Layout) */}
      <div className="flex-1 lg:pl-64 flex flex-col h-screen overflow-hidden p-2 sm:p-3 lg:p-4 bg-background">
        <div className="flex-1 rounded-[28px] sm:rounded-[36px] bg-canvas-bg border border-border/80 dark:border-white/6 shadow-2xl flex flex-col h-full overflow-hidden">
          {/* Canvas Top Header Bar - Fixed */}
          <header className="shrink-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border/70 bg-canvas-bg/85 backdrop-blur-xl px-6 sm:px-10 no-print">
            <MobileNav defaultProjectSlug={projectSlug} />

            {/* Payflow-style Pill Search Bar */}
            <div className="hidden sm:flex items-center gap-2.5 rounded-full border border-border/80 bg-surface px-4 py-2 text-muted-foreground w-80 lg:w-[420px] shadow-xs focus-within:border-foreground/40 focus-within:shadow-sm transition-all">
              <Search className="size-4 shrink-0 text-subtle-foreground" />
              <input
                type="text"
                placeholder="Search projects, clients, keywords…"
                className="w-full bg-transparent text-[13px] text-foreground placeholder:text-subtle-foreground focus:outline-none"
                disabled
              />
              <span className="hidden sm:inline-flex items-center gap-0.5 rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-subtle-foreground">
                <Command className="size-3" /> F
              </span>
            </div>

            {/* Header Right Widgets */}
            <div className="ml-auto flex items-center gap-3">
              <ThemeToggle />
            </div>
          </header>

          {/* Internal Scrollable Content Canvas */}
          <div className="flex-1 overflow-y-auto w-full overscroll-contain">
            <main className="w-full max-w-[1400px] mx-auto px-6 py-8 sm:px-10 sm:py-10">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
