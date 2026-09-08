"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/form";
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

export function ConfirmDelete({
  action,
  id,
  title,
  description,
  confirmLabel = "Delete",
  trigger,
  extraInputs,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: number;
  title: string;
  description: string;
  confirmLabel?: string;
  trigger: React.ReactNode;
  extraInputs?: Record<string, string | number>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            {extraInputs &&
              Object.entries(extraInputs).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={String(value)} />
              ))}
            <SubmitButton variant="danger">{confirmLabel}</SubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
