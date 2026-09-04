import { asc, eq, sql } from "drizzle-orm";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { clients, projects } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { ClientFormDialog } from "./client-form";

export const dynamic = "force-dynamic";

const statusTone = {
  active: "success",
  paused: "warning",
  archived: "neutral",
} as const;

export default async function ClientsPage() {
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      website: clients.website,
      status: clients.status,
      contactName: clients.contactName,
      contactEmail: clients.contactEmail,
      createdAt: clients.createdAt,
      projectCount: sql<number>`count(${projects.id})`.as("project_count"),
    })
    .from(clients)
    .leftJoin(projects, eq(projects.clientId, clients.id))
    .groupBy(clients.id)
    .orderBy(asc(clients.name));

  return (
    <div className="animate-in">
      <PageHeader
        title="Clients"
        description={`${rows.length} ${rows.length === 1 ? "client" : "clients"} in the portfolio.`}
        actions={
          <ClientFormDialog
            trigger={
              <Button variant="primary">
                <Plus />
                New client
              </Button>
            }
          />
        }
      />

      {rows.length === 0 ? (
        <Empty
          icon={Building2}
          title="No clients yet"
          description="Add your first client, then attach the sites you audit for them."
          action={
            <ClientFormDialog
              trigger={
                <Button variant="primary">
                  <Plus />
                  New client
                </Button>
              }
            />
          }
        />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Client</Th>
                <Th>Status</Th>
                <Th>Projects</Th>
                <Th>Contact</Th>
                <Th>Added</Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <Link
                      href={`/clients/${row.id}`}
                      className="font-medium text-foreground hover:text-accent"
                    >
                      {row.name}
                    </Link>
                    {row.website ? (
                      <div className="text-[13px] text-muted-foreground">
                        {row.website}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone={statusTone[row.status]}>{row.status}</Badge>
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {row.projectCount}
                  </Td>
                  <Td className="text-muted-foreground">
                    {row.contactName ?? row.contactEmail ?? "—"}
                  </Td>
                  <Td className="text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
