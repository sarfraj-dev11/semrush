import { desc, eq } from "drizzle-orm";
import { CheckSquare, ListFilter, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Input, NativeSelect } from "@/components/ui/input";
import { Stat } from "@/components/ui/stat";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { getProjectWithClient } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import { TaskDialog } from "./task-dialog";
import { TaskItem } from "./task-item";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; priority?: string; q?: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  const record = await getProjectWithClient(projectId);
  if (!record) notFound();

  const query = await searchParams;
  const statusFilter = typeof query.status === "string" ? query.status : "";
  const priorityFilter = typeof query.priority === "string" ? query.priority : "";
  const q = typeof query.q === "string" ? query.q.trim() : "";

  const allTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.createdAt));

  let filtered = allTasks;
  if (statusFilter) {
    filtered = filtered.filter((t) => t.status === statusFilter);
  }
  if (priorityFilter) {
    filtered = filtered.filter((t) => t.priority === priorityFilter);
  }
  if (q) {
    const term = q.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(term) ||
        (t.description && t.description.toLowerCase().includes(term)) ||
        (t.assignee && t.assignee.toLowerCase().includes(term)),
    );
  }

  // Statistics
  const todoCount = allTasks.filter((t) => t.status === "todo").length;
  const inProgressCount = allTasks.filter((t) => t.status === "in_progress").length;
  const doneCount = allTasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-5">
      {/* Metric summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total Tasks"
          value={formatNumber(allTasks.length)}
        />
        <Stat
          label="To Do"
          value={formatNumber(todoCount)}
          tone={todoCount > 0 ? "warning" : "neutral"}
        />
        <Stat
          label="In Progress"
          value={formatNumber(inProgressCount)}
          tone="accent"
        />
        <Stat
          label="Completed"
          value={formatNumber(doneCount)}
          tone="success"
        />
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex flex-wrap items-center gap-2" method="get">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search task title or assignee…"
            className="w-64 text-[13px]"
          />
          <NativeSelect
            name="status"
            defaultValue={statusFilter}
            className="w-36 text-[13px]"
          >
            <option value="">All statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </NativeSelect>
          <NativeSelect
            name="priority"
            defaultValue={priorityFilter}
            className="w-36 text-[13px]"
          >
            <option value="">All priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </NativeSelect>
          <Button type="submit" variant="secondary" size="sm">
            Filter
          </Button>
          {q || statusFilter || priorityFilter ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/projects/${projectId}/tasks`}>Reset</Link>
            </Button>
          ) : null}
        </form>

        <TaskDialog projectId={projectId} />
      </div>

      {/* Task List */}
      {filtered.length === 0 ? (
        <Empty
          icon={CheckSquare}
          title={
            allTasks.length === 0
              ? "No tasks created yet"
              : "No tasks match your filters"
          }
          description={
            allTasks.length === 0
              ? "Create actionable optimization to-dos for your team, or generate tasks directly from audit issues."
              : "Try clearing search or changing the status filter."
          }
          action={
            allTasks.length === 0 ? (
              <TaskDialog projectId={projectId} />
            ) : null
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((task) => (
            <TaskItem key={task.id} task={task} projectId={projectId} />
          ))}
        </div>
      )}
    </div>
  );
}
