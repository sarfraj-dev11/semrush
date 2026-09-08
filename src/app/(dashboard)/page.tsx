import { redirect } from "next/navigation";
import { DashboardToolkitLanding } from "@/components/dashboard-toolkit-landing";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { toProjectSlug } from "@/lib/slug-utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let projectList = await db
    .select({
      id: projects.id,
      name: projects.name,
    })
    .from(projects)
    .orderBy(projects.name)
    .limit(1);

  if (projectList.length === 0) {
    try {
      const { syncProjectsFromFirebase } = await import("@/lib/firebase-tracking");
      await syncProjectsFromFirebase();
      projectList = await db
        .select({
          id: projects.id,
          name: projects.name,
        })
        .from(projects)
        .orderBy(projects.name)
        .limit(1);
    } catch (err) {
      console.error("❌ [Dashboard] Firebase sync error:", err);
    }
  }

  // If no project exists yet, render the Semrush SEO Toolkit onboarding landing
  if (projectList.length === 0) {
    return <DashboardToolkitLanding />;
  }

  // If a project exists, navigate directly to its SEO Dashboard
  const slug = toProjectSlug(projectList[0].name);
  redirect(`/${slug}`);
}
