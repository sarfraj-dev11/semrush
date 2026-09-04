/**
 * Shown while the domain is being fetched. The shape mirrors the real report so
 * the layout does not jump when the data lands — a live analysis takes several
 * seconds of real requests, which is long enough for that to be noticeable.
 */
export function ReportSkeleton({ host }: { host: string }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="size-2.5 animate-pulse rounded-full bg-blue-500" />
          <div>
            <p className="text-[15px] font-bold text-foreground">{host}</p>
            <p className="text-[12px] text-muted-foreground">
              Fetching the homepage, robots.txt, sitemaps and mobile rendition…
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-border bg-surface p-5 shadow-xs"
          >
            <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
            <div className="mt-3 h-7 w-16 animate-pulse rounded bg-surface-muted" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-border bg-surface p-5 shadow-xs"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-surface-muted" />
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 4 }, (_, row) => (
                <div
                  key={row}
                  className="h-3 w-full animate-pulse rounded bg-surface-muted"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
