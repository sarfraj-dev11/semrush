import { desc, eq } from "drizzle-orm";
import { ListChecks, RotateCcw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { SubmitButton } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { db } from "@/db";
import { jobs, projects } from "@/db/schema";
import { jobStatusTone } from "@/lib/jobs";
import { formatDuration, formatRelative } from "@/lib/utils";
import {
  cancelJobAction,
  clearFinishedJobsAction,
  retryJobAction,
} from "./actions";

export const dynamic = "force-dynamic";

const typeLabel: Record<string, string> = {
  crawl: "Site crawl",
  psi: "PageSpeed",
  import: "CSV import",
  tracking: "Rank tracking",
};

function getJobDuration(
  startedAt: Date | null,
  finishedAt: Date | null,
  running: boolean,
): number | null {
  if (startedAt && finishedAt) {
    return finishedAt.getTime() - startedAt.getTime();
  }
  if (running && startedAt) {
    return Date.now() - startedAt.getTime();
  }
  return null;
}

export default async function JobsPage() {
  const rows = await db
    .select({
      job: jobs,
      projectName: projects.name,
      projectId: projects.id,
    })
    .from(jobs)
    .leftJoin(projects, eq(jobs.projectId, projects.id))
    .orderBy(desc(jobs.createdAt))
    .limit(100);

  const active = rows.some(
    ({ job }) => job.status === "queued" || job.status === "running",
  );
  const finished = rows.filter(
    ({ job }) => job.status !== "queued" && job.status !== "running",
  ).length;

  return (
    <div className="animate-in">
      <AutoRefresh enabled={active} />
      <PageHeader
        title="Jobs"
        description="Crawls, PageSpeed runs and imports processed by the background worker."
        actions={
          finished > 0 ? (
            <form action={clearFinishedJobsAction}>
              <SubmitButton variant="secondary">
                Clear {finished} finished
              </SubmitButton>
            </form>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <Empty
          icon={ListChecks}
          title="Nothing queued"
          description="Start a crawl from a project and it will appear here. The worker must be running: npm run dev:all"
        />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <Th>Job</Th>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th className="w-56">Progress</Th>
                <Th>Duration</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.map(({ job, projectName, projectId }) => {
                const running = job.status === "running";
                const retryable =
                  job.status === "failed" || job.status === "cancelled";
                const duration = getJobDuration(job.startedAt, job.finishedAt, running);

                return (
                  <Tr key={job.id}>
                    <Td>
                      <div className="font-medium">
                        {typeLabel[job.type]}{" "}
                        <span className="text-subtle-foreground">#{job.id}</span>
                      </div>
                      <div className="text-[13px] text-muted-foreground">
                        {formatRelative(job.createdAt)}
                        {job.attempts > 1 ? ` · attempt ${job.attempts}` : ""}
                      </div>
                    </Td>
                    <Td>
                      {projectId ? (
                        <Link
                          href={`/projects/${projectId}`}
                          className="text-muted-foreground hover:text-accent"
                        >
                          {projectName}
                        </Link>
                      ) : (
                        <span className="text-subtle-foreground">—</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={jobStatusTone(job.status)}>
                        {job.cancelRequested && running
                          ? "cancelling"
                          : job.status}
                      </Badge>
                      {job.error ? (
                        <div
                          className="mt-1 max-w-70 truncate text-[12px] text-critical"
                          title={job.error}
                        >
                          {job.error}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      {running || job.progress > 0 ? (
                        <div className="space-y-1.5">
                          <Progress
                            value={job.progress}
                            tone={
                              job.status === "failed" ? "critical" : "accent"
                            }
                          />
                          <div className="text-[12px] text-muted-foreground">
                            {job.progressLabel ?? `${job.progress}%`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-subtle-foreground">—</span>
                      )}
                    </Td>
                    <Td className="tabular-nums text-muted-foreground">
                      {formatDuration(duration)}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {retryable ? (
                          <form action={retryJobAction}>
                            <input type="hidden" name="id" value={job.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Retry job"
                            >
                              <RotateCcw />
                            </Button>
                          </form>
                        ) : null}
                        {job.status === "queued" || running ? (
                          <form action={cancelJobAction}>
                            <input type="hidden" name="id" value={job.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Cancel job"
                              disabled={job.cancelRequested}
                            >
                              <X />
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableWrap>
      )}

      {rows.length > 0 ? (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-subtle-foreground">
          <Trash2 className="size-3.5" />
          Showing the 100 most recent jobs.
        </p>
      ) : null}
    </div>
  );
}
