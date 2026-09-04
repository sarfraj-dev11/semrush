"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SidebarNav } from "@/components/sidebar";

export function MobileNav({
  defaultProjectSlug = "",
}: {
  defaultProjectSlug?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation so the sheet doesn't linger over the new page.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="Open navigation"
        className="rounded-[10px] p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground lg:hidden"
      >
        <Menu className="size-5" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] lg:hidden" />
        <DialogPrimitive.Content className="material-thick fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border lg:hidden">
          <DialogPrimitive.Title className="sr-only">
            Navigation
          </DialogPrimitive.Title>
          <div className="flex h-24 items-center justify-between pt-6 pb-2 px-6 border-b border-border/60">
            <span className="font-[family-name:var(--font-syncopate)] text-[20px] font-bold tracking-[0.2em] text-foreground uppercase">
              SEMRUSH
            </span>
            <DialogPrimitive.Close
              aria-label="Close navigation"
              className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-muted"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto pt-2">
            <SidebarNav
              onNavigate={() => setOpen(false)}
              defaultProjectSlug={defaultProjectSlug}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
