"use client";

import { useTransition } from "react";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Tag,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Task } from "@/db/schema";
import { deleteTaskAction, updateTaskStatusAction } from "./actions";

function priorityTone(p: string) {
  if (p === "high") return "critical" as const;
  if (p === "medium") return "warning" as const;
  return "neutral" as const;
}

export function TaskItem({
  task,
  projectId,
}: {
  task: Task;
  projectId: number;
}) {
  const [isPending, startTransition] = useTransition();

  function toggleStatus() {
    startTransition(async () => {
      const next =
        task.status === "done"
          ? "todo"
          : task.status === "todo"
          ? "in_progress"
          : "done";
      await updateTaskStatusAction(task.id, next);
    });
  }

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-[12px] border p-4 transition-all ${
        task.status === "done"
          ? "border-border/50 bg-surface-muted/30 opacity-75"
          : "border-border bg-surface hover:border-border-strong shadow-xs"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleStatus}
          disabled={isPending}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-accent transition-colors"
          title={`Status: ${task.status}. Click to advance.`}
        >
          {task.status === "done" ? (
            <CheckCircle2 className="size-5 text-success" />
          ) : task.status === "in_progress" ? (
            <Clock className="size-5 text-warning" />
          ) : (
            <Circle className="size-5 text-muted-foreground" />
          )}
        </button>

        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[14px] font-semibold ${
                task.status === "done"
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {task.title}
            </span>
            <Badge tone={priorityTone(task.priority)} className="capitalize">
              {task.priority}
            </Badge>
            <Badge tone="outline" className="capitalize">
              {task.status.replace("_", " ")}
            </Badge>
          </div>

          {task.description ? (
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {task.description}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1 text-[12px] text-subtle-foreground">
            {task.assignee ? (
              <span className="inline-flex items-center gap-1">
                <User className="size-3.5" />
                {task.assignee}
              </span>
            ) : null}

            {task.dueDate ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" />
                Due {task.dueDate}
              </span>
            ) : null}

            {task.issueCode ? (
              <Link
                href={`/projects/${projectId}/pages?issue=${task.issueCode}`}
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <Tag className="size-3.5" />
                Issue: {task.issueCode}
              </Link>
            ) : null}

            {task.pageUrl ? (
              <a
                href={task.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline truncate max-w-xs"
              >
                <ExternalLink className="size-3.5" />
                {task.pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDelete
        action={deleteTaskAction}
        id={task.id}
        title="Delete this task?"
        description="This task will be permanently removed."
        confirmLabel="Delete"
        trigger={
          <Button variant="ghost" size="icon" aria-label="Delete task">
            <Trash2 className="size-3.5 text-muted-foreground hover:text-critical" />
          </Button>
        }
      />
    </div>
  );
}
