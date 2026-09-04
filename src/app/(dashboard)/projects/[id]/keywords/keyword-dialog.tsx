"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Keyword } from "@/db/schema";
import { createKeywordAction, updateKeywordAction } from "./actions";

export function KeywordDialog({
  projectId,
  keyword,
  trigger,
}: {
  projectId: number;
  keyword?: Keyword;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(keyword);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="primary" size="sm">
            <Plus className="size-4" />
            Add keyword
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form
          action={async (formData) => {
            if (isEdit) {
              await updateKeywordAction(formData);
            } else {
              await createKeywordAction(formData);
            }
            setOpen(false);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>
              {isEdit ? `Edit "${keyword?.keyword}"` : "Add Tracked Keyword"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update keyword details or target URL."
                : "Add a new keyword to track search metrics and organic rankings."}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="projectId" value={projectId} />
          {keyword ? <input type="hidden" name="id" value={keyword.id} /> : null}

          <DialogBody className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="keyword" className="text-[13px] font-medium">
                Keyword *
              </Label>
              <Input
                id="keyword"
                name="keyword"
                defaultValue={keyword?.keyword ?? ""}
                placeholder="e.g. best seo agency"
                required
                className="h-11 px-4 py-2.5 text-[14px]"
                style={{ paddingLeft: "16px", paddingRight: "16px" }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetUrl" className="text-[13px] font-medium">
                Target URL
              </Label>
              <Input
                id="targetUrl"
                name="targetUrl"
                defaultValue={keyword?.targetUrl ?? ""}
                placeholder="https://example.com/services/seo"
                className="h-11 px-4 py-2.5 text-[14px]"
                style={{ paddingLeft: "16px", paddingRight: "16px" }}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton variant="primary">
              {isEdit ? "Save Changes" : "Add Keyword"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
