import { notFound, redirect } from "next/navigation";
import { findProjectBySlugOrId, isReservedSegment } from "@/lib/slugs";
import { toProjectSlug } from "@/lib/slug-utils";
import { ProjectTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function ProjectSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project: slugOrId } = await params;

  // A sub-path of a real page, e.g. /domain-overview/keywords. Send the user to
  // the page they were reaching for rather than a dead end.
  if (isReservedSegment(slugOrId)) redirect(`/${slugOrId.toLowerCase()}`);

  const project = await findProjectBySlugOrId(slugOrId);
  if (!project) notFound();

  const slug = toProjectSlug(project.name);

  return (
    <div className="animate-in">
      <ProjectTabs slug={slug} />
      {children}
    </div>
  );
}
