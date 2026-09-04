"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { FieldError, FormError, FormRow, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client, Project } from "@/db/schema";
import { CountrySelect } from "@/components/country-select";
import { createProjectAction, updateProjectAction } from "./actions";

type ClientOption = Pick<Client, "id" | "name">;

export function ProjectFormDialog({
  project,
  clients,
  defaultClientId,
  trigger,
}: {
  project?: Project;
  clients: ClientOption[];
  defaultClientId?: number;
  trigger: React.ReactNode;
}) {
  const editing = Boolean(project);
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    editing ? updateProjectAction : createProjectAction,
    null,
  );

  const [prevSuccessState, setPrevSuccessState] = useState(state);
  if (state?.ok && state !== prevSuccessState) {
    setPrevSuccessState(state);
    setOpen(false);
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success(editing ? "Project updated" : "Project created");
    }
  }, [state, editing]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form action={formAction}>
          {editing ? <input type="hidden" name="id" value={project!.id} /> : null}
          <DialogHeader>
            <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>
              A project is one site. The crawl settings below bound every audit
              run for it.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <FormError state={state} />

            <FormRow>
              <div className="space-y-1.5">
                <Label htmlFor="clientId">Client</Label>
                <NativeSelect
                  id="clientId"
                  name="clientId"
                  defaultValue={project?.clientId ?? defaultClientId ?? ""}
                  required
                >
                  <option value="" disabled>
                    Select a client…
                  </option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError state={state} name="clientId" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Project name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={project?.name ?? ""}
                  placeholder="Main site"
                  required
                />
                <FieldError state={state} name="name" />
              </div>
            </FormRow>

            <div className="space-y-1.5">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                name="domain"
                defaultValue={project?.domain ?? ""}
                placeholder="example.com"
                required
              />
              <FieldError state={state} name="domain" />
              <p className="text-[12px] text-subtle-foreground">
                Crawls start here and stay on this host.
              </p>
            </div>

            <FormRow>
              <div className="space-y-1.5">
                <Label htmlFor="targetCountry">Target country</Label>
                <CountrySelect
                  id="targetCountry"
                  name="targetCountry"
                  defaultValue={project?.targetCountry ?? "US"}
                />
                <FieldError state={state} name="targetCountry" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="targetDevice">Target device</Label>
                <NativeSelect
                  id="targetDevice"
                  name="targetDevice"
                  defaultValue={project?.targetDevice ?? "mobile"}
                >
                  <option value="mobile">📱 Mobile</option>
                  <option value="desktop">💻 Desktop</option>
                  <option value="both">📱💻 Both (Mobile & Desktop)</option>
                </NativeSelect>
              </div>
            </FormRow>

            <div className="rounded-[10px] border border-border bg-surface-muted p-4">
              <p className="mb-3 text-[13px] font-medium">Crawl settings</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="crawlDepth">Max depth</Label>
                  <Input
                    id="crawlDepth"
                    name="crawlDepth"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={project?.crawlDepth ?? 3}
                  />
                  <FieldError state={state} name="crawlDepth" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="crawlLimit">Page limit</Label>
                  <Input
                    id="crawlLimit"
                    name="crawlLimit"
                    type="number"
                    min={1}
                    max={10000}
                    defaultValue={project?.crawlLimit ?? 500}
                  />
                  <FieldError state={state} name="crawlLimit" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="crawlConcurrency">Concurrency</Label>
                  <Input
                    id="crawlConcurrency"
                    name="crawlConcurrency"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={project?.crawlConcurrency ?? 4}
                  />
                  <FieldError state={state} name="crawlConcurrency" />
                </div>
              </div>

              <label className="mt-4 flex items-center gap-2.5 text-[14px]">
                <input
                  type="checkbox"
                  name="respectRobots"
                  defaultChecked={project?.respectRobots ?? true}
                  className="size-4 accent-[var(--accent)]"
                />
                Respect robots.txt
              </label>

              <FormRow className="mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="excludePatterns">Exclude URLs containing</Label>
                  <Input
                    id="excludePatterns"
                    name="excludePatterns"
                    defaultValue={project?.excludePatterns ?? ""}
                    placeholder="/cart, /search"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="includePatterns">Only URLs containing</Label>
                  <Input
                    id="includePatterns"
                    name="includePatterns"
                    defaultValue={project?.includePatterns ?? ""}
                    placeholder="/blog"
                  />
                </div>
              </FormRow>
            </div>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton>
              {editing ? "Save changes" : "Create project"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
