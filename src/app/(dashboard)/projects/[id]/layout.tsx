import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getClientOptions, getProjectWithClient } from "@/lib/queries";
import { hostnameOf } from "@/lib/utils";
import { deleteProjectAction } from "../actions";
import { ProjectFormDialog } from "../project-form";
import { ProjectTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/projects/[id]">) {
  const { id } = await params;
  const projectId = Number(id);
  const record = await getProjectWithClient(projectId);
  if (!record) notFound();

  const { project, client } = record;
  const clientOptions = await getClientOptions();

  return (
    <div className="animate-in">
      <PageHeader
        breadcrumb={
          <span className="flex items-center gap-1.5">
            <Link href="/projects" className="hover:text-foreground">
              Projects
            </Link>
            <span aria-hidden>/</span>
            <Link
              href={`/clients/${client.id}`}
              className="hover:text-foreground"
            >
              {client.name}
            </Link>
          </span>
        }
        title={project.name}
        description={hostnameOf(project.domain)}
        actions={
          <>
            <Button variant="ghost" size="icon" asChild>
              <a
                href={project.domain}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open site in a new tab"
              >
                <ExternalLink />
              </a>
            </Button>
            <ProjectFormDialog
              project={project}
              clients={clientOptions}
              trigger={
                <Button variant="secondary">
                  <Pencil />
                  Edit
                </Button>
              }
            />
            <ConfirmDelete
              action={deleteProjectAction}
              id={project.id}
              title={`Delete ${project.name}?`}
              description="Every crawl, audit issue, keyword, ranking and backlink stored for this project is deleted with it. This cannot be undone."
              confirmLabel="Delete project"
              trigger={
                <Button variant="ghost" size="icon" aria-label="Delete project">
                  <Trash2 />
                </Button>
              }
            />
          </>
        }
      />

      <ProjectTabs projectId={project.id} />
      {children}
    </div>
  );
}
