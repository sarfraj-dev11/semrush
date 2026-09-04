"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCompetitorAction } from "./actions";

export function CompetitorDialog({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="size-4" />
          Add competitor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          action={async (formData) => {
            await addCompetitorAction(formData);
            setOpen(false);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Add Competitor</DialogTitle>
            <DialogDescription>
              Track an industry or organic search competitor for side-by-side benchmarking.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="projectId" value={projectId} />

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="domain">Domain / Root URL *</Label>
              <Input
                id="domain"
                name="domain"
                placeholder="competitor.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Brand / Company Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Competitor Inc"
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
            <SubmitButton variant="primary">Add Competitor</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
