import { desc, eq } from "drizzle-orm";
import { ArrowDownToLine, CheckCircle2, FileText, XCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { db } from "@/db";
import { importMappings, imports, projects } from "@/db/schema";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { ImportWizard } from "./import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const [projectList, presets, history] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        domain: projects.domain,
      })
      .from(projects)
      .orderBy(projects.name),
    db.select().from(importMappings).orderBy(importMappings.name),
    db
      .select({
        id: imports.id,
        projectId: imports.projectId,
        projectName: projects.name,
        sourceType: imports.sourceType,
        fileName: imports.fileName,
        rowsTotal: imports.rowsTotal,
        rowsImported: imports.rowsImported,
        rowsSkipped: imports.rowsSkipped,
        status: imports.status,
        createdAt: imports.createdAt,
      })
      .from(imports)
      .leftJoin(projects, eq(imports.projectId, projects.id))
      .orderBy(desc(imports.createdAt))
      .limit(30),
  ]);

  return (
    <div className="animate-in space-y-6">
      <PageHeader
        title="CSV Data Importer"
        description="Ingest keyword search volume, ranking positions, backlinks, and competitors from Semrush or Ahrefs exports."
      />

      {projectList.length === 0 ? (
        <Empty
          icon={ArrowDownToLine}
          title="No projects exist"
          description="Create a project first before importing SEO metrics."
          action={
            <Link
              href="/projects"
              className="inline-flex items-center justify-center rounded-[10px] bg-accent px-4 py-2 text-[14px] font-medium text-accent-foreground hover:bg-accent-hover transition-colors"
            >
              Go to Projects
            </Link>
          }
        />
      ) : (
        <>
          <ImportWizard
            projects={projectList}
            presets={presets.map((p) => ({
              id: p.id,
              name: p.name,
              sourceType: p.sourceType,
              mapping: p.mapping as Record<string, string>,
            }))}
          />

          {/* Import History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-accent" />
                Recent Imports History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="p-5 text-[13px] text-muted-foreground">
                  No CSV files have been imported yet.
                </p>
              ) : (
                <TableWrap className="rounded-none border-0">
                  <Table>
                    <Thead>
                      <tr>
                        <Th>Date</Th>
                        <Th>Project</Th>
                        <Th>Type</Th>
                        <Th>File Name</Th>
                        <Th className="text-right">Total Rows</Th>
                        <Th className="text-right">Imported</Th>
                        <Th className="text-right">Skipped</Th>
                        <Th>Status</Th>
                      </tr>
                    </Thead>
                    <Tbody>
                      {history.map((item) => (
                        <Tr key={item.id}>
                          <Td className="text-muted-foreground">
                            {formatDateTime(item.createdAt)}
                          </Td>
                          <Td className="font-medium">
                            {item.projectName ? (
                              <Link
                                href={`/projects/${item.projectId}`}
                                className="hover:text-accent"
                              >
                                {item.projectName}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </Td>
                          <Td>
                            <Badge tone="accent" className="capitalize">
                              {item.sourceType}
                            </Badge>
                          </Td>
                          <Td className="truncate max-w-xs text-muted-foreground font-mono text-[12px]">
                            {item.fileName}
                          </Td>
                          <Td className="text-right tabular-nums">
                            {formatNumber(item.rowsTotal)}
                          </Td>
                          <Td className="text-right tabular-nums text-success font-semibold">
                            {formatNumber(item.rowsImported)}
                          </Td>
                          <Td className="text-right tabular-nums text-muted-foreground">
                            {formatNumber(item.rowsSkipped)}
                          </Td>
                          <Td>
                            {item.status === "completed" ? (
                              <Badge tone="success">
                                <CheckCircle2 className="size-3 mr-1 inline" />
                                Completed
                              </Badge>
                            ) : (
                              <Badge tone="critical">
                                <XCircle className="size-3 mr-1 inline" />
                                Failed
                              </Badge>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableWrap>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
