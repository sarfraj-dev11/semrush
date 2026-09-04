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
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBacklinkAction } from "./actions";

export function BacklinkDialog({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="size-4" />
          Add backlink
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          action={async (formData) => {
            await createBacklinkAction(formData);
            setOpen(false);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Add Backlink Record</DialogTitle>
            <DialogDescription>
              Record an external inbound link pointing to this project.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="projectId" value={projectId} />

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sourceUrl">Referring Source URL *</Label>
              <Input
                id="sourceUrl"
                name="sourceUrl"
                placeholder="https://techcrunch.com/article"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targetUrl">Target Page on Your Site</Label>
              <Input
                id="targetUrl"
                name="targetUrl"
                placeholder="https://example.com/features"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="anchorText">Anchor Text</Label>
              <Input
                id="anchorText"
                name="anchorText"
                placeholder="top seo platform"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="domainRating">Domain Rating (DR)</Label>
                <Input
                  id="domainRating"
                  name="domainRating"
                  type="number"
                  placeholder="78"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="isFollow">Link Type</Label>
                <NativeSelect id="isFollow" name="isFollow" defaultValue="true">
                  <option value="true">Follow</option>
                  <option value="false">Nofollow / UGC</option>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <NativeSelect id="status" name="status" defaultValue="active">
                  <option value="active">Active</option>
                  <option value="new">New</option>
                  <option value="lost">Lost</option>
                </NativeSelect>
              </div>
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
            <SubmitButton variant="primary">Add Link</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
