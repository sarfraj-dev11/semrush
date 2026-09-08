import { desc } from "drizzle-orm";
import { Command, Search } from "lucide-react";
import { MobileNav } from "@/components/mobile-nav";
import { Sidebar, type SidebarProject } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { toProjectSlug } from "@/lib/slug-utils";

export const dynamic = "force-dynamic";

/**
 * Fetch projects saved in Firebase Firestore (with fallback to SQLite)
 * and keep local DB in sync so nav items and links are always accurate.
 */
async function getNavProjects(): Promise<SidebarProject[]> {
  try {
    // 1. Fast path: Read directly from local database (instant, sub-millisecond)
    const dbProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        domain: projects.domain,
        targetCountry: projects.targetCountry,
      })
      .from(projects)
      .orderBy(desc(projects.id));

    if (dbProjects.length > 0) {
      return dbProjects.map((p) => ({
        id: p.id,
        name: p.name,
        domain: p.domain,
        targetCountry: p.targetCountry || "US",
      }));
    }

    // 2. Fallback to Firebase only if local DB is completely empty
    const { getFirebaseProjects, syncProjectsFromFirebase } = await import(
      "@/lib/firebase-tracking"
    );
    await syncProjectsFromFirebase().catch((err) => {
      console.error("⚠️ [Layout] Failed to sync Firestore projects:", err);
    });

    const fbProjects = await getFirebaseProjects();
    if (fbProjects && fbProjects.length > 0) {
      return fbProjects.map((p) => ({
        id: p.id,
        name: p.name,
        domain: p.domain,
        targetCountry: p.targetCountry || "US",
      }));
    }

    return [];
  } catch (error) {
    console.error("❌ [Layout] Error fetching nav projects:", error);
    return [];
  }
}

export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const projectList = await getNavProjects();
  const newest = projectList[0];
  const projectSlug = newest ? toProjectSlug(newest.name) : "";

  return (
    <div className="h-screen w-full overflow-hidden bg-background text-foreground flex">
      {/* Dark Luxury Sidebar */}
      <Sidebar defaultProjectSlug={projectSlug} projects={projectList} />

      {/* Floating Canvas Shell (Payflow / Dribbble Signature Card Layout) */}
      <div className="flex-1 lg:pl-64 flex flex-col h-screen overflow-hidden p-2 sm:p-3 lg:p-4 bg-background">
        <div className="flex-1 rounded-[28px] sm:rounded-[36px] bg-canvas-bg border border-border/80 dark:border-white/6 shadow-2xl flex flex-col h-full overflow-hidden">
          {/* Canvas Top Header Bar - Fixed */}
          <header className="shrink-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border/70 bg-canvas-bg/85 backdrop-blur-xl px-6 sm:px-10 no-print">
            <MobileNav defaultProjectSlug={projectSlug} projects={projectList} />

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
