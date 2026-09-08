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
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          {editing ? <input type="hidden" name="id" value={project!.id} /> : null}
          <DialogHeader>
            <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update your project domain and tracking preferences."
                : "Add a website to track keyword rankings and performance."}
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
                  defaultValue={project?.clientId ?? defaultClientId ?? (clients.length > 0 ? clients[0].id : "")}
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
                Rankings and audits will be tracked for this domain.
              </p>
            </div>

            <FormRow>
              <div className="space-y-1.5">
                <Label htmlFor="targetCountry">Target country</Label>
                <CountrySelect
                  id="targetCountry"
                  name="targetCountry"
                  defaultValue={project?.targetCountry}
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
