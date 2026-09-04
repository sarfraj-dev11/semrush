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
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@/db/schema";
import { createClientAction, updateClientAction } from "./actions";

export function ClientFormDialog({
  client,
  trigger,
}: {
  client?: Client;
  trigger: React.ReactNode;
}) {
  const editing = Boolean(client);
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    editing ? updateClientAction : createClientAction,
    null,
  );

  const [prevSuccessState, setPrevSuccessState] = useState(state);
  if (state?.ok && state !== prevSuccessState) {
    setPrevSuccessState(state);
    setOpen(false);
  }

  useEffect(() => {
    if (state?.ok) {
      toast.success(editing ? "Client updated" : "Client created");
    }
  }, [state, editing]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          {editing ? <input type="hidden" name="id" value={client!.id} /> : null}
          <DialogHeader>
            <DialogTitle>{editing ? "Edit client" : "New client"}</DialogTitle>
            <DialogDescription>
              Clients group the sites you audit and report on.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <FormError state={state} />

            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={client?.name ?? ""}
                placeholder="Northwind Coffee"
                required
                autoFocus
              />
              <FieldError state={state} name="name" />
            </div>

            <FormRow>
              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  defaultValue={client?.website ?? ""}
                  placeholder="northwind.com"
                />
                <FieldError state={state} name="website" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <NativeSelect
                  id="status"
                  name="status"
                  defaultValue={client?.status ?? "active"}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </NativeSelect>
              </div>
            </FormRow>

            <FormRow>
              <div className="space-y-1.5">
                <Label htmlFor="contactName">Contact name</Label>
                <Input
                  id="contactName"
                  name="contactName"
                  defaultValue={client?.contactName ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactEmail">Contact email</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  defaultValue={client?.contactEmail ?? ""}
                />
                <FieldError state={state} name="contactEmail" />
              </div>
            </FormRow>

            <div className="space-y-1.5">
              <Label htmlFor="contactPhone">Contact phone</Label>
              <Input
                id="contactPhone"
                name="contactPhone"
                defaultValue={client?.contactPhone ?? ""}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={client?.notes ?? ""}
                placeholder="Retainer scope, reporting cadence, anything worth remembering."
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton>{editing ? "Save changes" : "Create client"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
