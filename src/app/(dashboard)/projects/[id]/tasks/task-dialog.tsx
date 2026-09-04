"use client";

import { useState } from "react";
import { CheckSquare, Plus } from "lucide-react";
import { SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTaskAction } from "./actions";

function getDefaultDueDate(): string {
  return new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
}

export function TaskDialog({
  projectId,
  initialTitle,
  initialDescription,
  initialIssueCode,
  initialPageUrl,
  trigger,
}: {
  projectId: number;
  initialTitle?: string;
  initialDescription?: string;
  initialIssueCode?: string;
  initialPageUrl?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="primary" size="sm">
            <Plus className="size-4" />
            New task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form
          action={async (formData) => {
            await createTaskAction(formData);
            setOpen(false);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="size-4 text-accent" />
              Create SEO Task
            </DialogTitle>
            <DialogDescription>
              Action item for developers, content writers, or SEO specialists.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="projectId" value={projectId} />
          {initialIssueCode ? (
            <input type="hidden" name="issueCode" value={initialIssueCode} />
          ) : null}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                name="title"
                defaultValue={initialTitle ?? ""}
                placeholder="e.g. Fix missing H1 tags on product landing pages"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Details / Recommendations</Label>
              <Input
                id="description"
                name="description"
                defaultValue={initialDescription ?? ""}
                placeholder="Add actionable details, copy, or fix steps…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="priority">Priority</Label>
                <NativeSelect id="priority" name="priority" defaultValue="medium">
                  <option value="high">High (Critical)</option>
                  <option value="medium">Medium (Warning)</option>
                  <option value="low">Low (Notice)</option>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <NativeSelect id="status" name="status" defaultValue="todo">
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </NativeSelect>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="assignee">Assignee</Label>
                <Input
                  id="assignee"
                  name="assignee"
                  placeholder="e.g. Alex (Dev)"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  defaultValue={getDefaultDueDate()}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pageUrl">Related Page URL</Label>
              <Input
                id="pageUrl"
                name="pageUrl"
                defaultValue={initialPageUrl ?? ""}
                placeholder="https://example.com/blog/article"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton variant="primary">Create Task</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
