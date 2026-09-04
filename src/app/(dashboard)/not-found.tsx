import { asc } from "drizzle-orm";
import { FolderSearch, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { toProjectSlug } from "@/lib/slug-utils";
import { hostnameOf } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * 404 boundary for the dashboard, so a wrong URL keeps the app chrome and
 * offers somewhere to go.
 *
 * This sits at the group level rather than under `[project]` because
 * `notFound()` thrown inside a layout is caught by the boundary *above* that
 * layout — a `not-found.tsx` in the same segment would render inside the very
 * layout that just failed, and so is never reached.
 *
 * Most URLs that land here name a project that does not exist, which used to be
 * unreachable: an unmatched slug was answered with a fabricated project, so the
 * wrong URL quietly rendered another project's data.
 */
export default async function DashboardNotFound() {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      domain: projects.domain,
    })
    .from(projects)
    .orderBy(asc(projects.name))
    .limit(12);

  return (
    <div className="mx-auto max-w-2xl py-10 animate-in">
      {rows.length === 0 ? (
        <Empty
          icon={FolderSearch}
          title="Page not found"
          description="There are no projects yet, so this URL cannot refer to one. Create a project to start crawling and tracking a site."
          action={
            <Button variant="primary" asChild>
              <Link href="/projects">
                <Plus />
                Create a project
              </Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Page not found</CardTitle>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Nothing matches that URL. If you were after a project, these
                exist:
              </p>
            </div>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/projects">All projects</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {rows.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/${toProjectSlug(project.name)}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-surface-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium text-foreground">
                        {project.name}
                      </span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {hostnameOf(project.domain)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] text-accent">Open</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
