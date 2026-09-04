import { asc, eq } from "drizzle-orm";
import { Globe, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { clients, projects } from "@/db/schema";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, hostnameOf } from "@/lib/utils";
import { ProjectFormDialog } from "../../projects/project-form";
import { deleteClientAction } from "../actions";
import { ClientFormDialog } from "../client-form";

export const dynamic = "force-dynamic";

const statusTone = {
  active: "success",
  paused: "warning",
  archived: "neutral",
} as const;

export default async function ClientDetailPage({
  params,
}: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) notFound();

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
  });
  if (!client) notFound();

  const clientProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.clientId, clientId))
    .orderBy(asc(projects.name));

  const details = [
    { label: "Website", value: client.website },
    { label: "Contact", value: client.contactName },
    { label: "Email", value: client.contactEmail },
    { label: "Phone", value: client.contactPhone },
    { label: "Added", value: formatDate(client.createdAt) },
  ].filter((detail) => detail.value);

  return (
    <div className="animate-in">
      <PageHeader
        breadcrumb={
          <Link href="/clients" className="hover:text-foreground">
            Clients
          </Link>
        }
        title={client.name}
        description={client.website ?? undefined}
        actions={
          <>
            <Badge tone={statusTone[client.status]}>{client.status}</Badge>
            <ClientFormDialog
              client={client}
              trigger={
                <Button variant="secondary">
                  <Pencil />
                  Edit
                </Button>
              }
            />
            <ConfirmDelete
              action={deleteClientAction}
              id={client.id}
              title={`Delete ${client.name}?`}
              description="This also deletes the client's projects, crawls, keywords and every audit stored under them. It cannot be undone."
              confirmLabel="Delete client"
              trigger={
                <Button variant="ghost" size="icon" aria-label="Delete client">
                  <Trash2 />
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <ProjectFormDialog
                clients={[client]}
                defaultClientId={client.id}
                trigger={
                  <Button variant="subtle" size="sm">
                    <Plus />
                    Add project
                  </Button>
                }
              />
            </CardHeader>
            <CardContent>
              {clientProjects.length === 0 ? (
                <Empty
                  icon={Globe}
                  title="No projects for this client"
                  description="A project is one site you crawl, track and report on."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {clientProjects.map((project) => (
                    <li key={project.id}>
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex items-center justify-between gap-4 py-3 transition-colors hover:text-accent"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium">
                            {project.name}
                          </p>
                          <p className="truncate text-[13px] text-muted-foreground">
                            {hostnameOf(project.domain)}
                          </p>
                        </div>
                        <Badge tone="outline">
                          {project.targetCountry} · {project.targetDevice}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {client.notes ? (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-[14px] leading-6 text-muted-foreground">
                  {client.notes}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            {details.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                No contact details recorded.
              </p>
            ) : (
              <dl className="space-y-3">
                {details.map((detail) => (
                  <div key={detail.label}>
                    <dt className="text-[12px] text-subtle-foreground">
                      {detail.label}
                    </dt>
                    <dd className="text-[14px] break-words">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
