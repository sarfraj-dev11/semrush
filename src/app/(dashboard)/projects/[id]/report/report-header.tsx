"use client";

import { Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportHeader({
  projectName,
  domain,
  generatedAt,
}: {
  projectName: string;
  domain: string;
  generatedAt: string;
}) {
  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight text-foreground">
          Executive SEO Audit Report
        </h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {projectName} ({domain}) · Generated on {generatedAt}
        </p>
      </div>

      <div className="flex items-center gap-2 no-print">
        <Button variant="primary" size="sm" onClick={handlePrint}>
          <Printer className="size-4" />
          Print / Export PDF
        </Button>
      </div>
    </div>
  );
}
