import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  like,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { FileSearch } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Input, NativeSelect } from "@/components/ui/input";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { db } from "@/db";
import { crawlPages, pageIssues } from "@/db/schema";
import { ISSUE_BY_CODE, ISSUE_CATALOG } from "@/lib/crawler/issue-catalog";
import { getLatestCompletedCrawl, getProjectWithClient } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PER_PAGE = 50;

const SORTABLE = {
  url: crawlPages.url,
  status: crawlPages.statusCode,
  title: crawlPages.titleLength,
  words: crawlPages.wordCount,
  inlinks: crawlPages.inlinkCount,
  depth: crawlPages.depth,
  time: crawlPages.responseTimeMs,
} as const;

type SortKey = keyof typeof SORTABLE;

function statusTone(status: number | null) {
  if (status === null) return "critical" as const;
  if (status >= 400) return "critical" as const;
  if (status >= 300) return "warning" as const;
  return "success" as const;
}

function SortableTh({
  label,
  sortKey,
  sort,
  dir,
  href,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  href: string;
}) {
  return (
    <Th>
      <Link
        href={href}
        className={
          sort === sortKey ? "text-accent" : "hover:text-foreground"
        }
      >
        {label}
        {sort === sortKey ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </Link>
    </Th>
  );
}

export default async function PagesTab({
  params,
  searchParams,
}: PageProps<"/projects/[id]/pages">) {
  const { id } = await params;
  const projectId = Number(id);
  const record = await getProjectWithClient(projectId);
  if (!record) notFound();

  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const status = typeof query.status === "string" ? query.status : "";
  const issue = typeof query.issue === "string" ? query.issue : "";
  const sort = (
    typeof query.sort === "string" && query.sort in SORTABLE ? query.sort : "url"
  ) as SortKey;
  const dir = query.dir === "desc" ? "desc" : "asc";
  const pageNumber = Math.max(1, Number(query.page) || 1);

  const crawl = await getLatestCompletedCrawl(projectId);
  if (!crawl) {
    return (
      <Empty
        icon={FileSearch}
        title="No crawl data yet"
        description="Run a crawl from the Audit tab and every URL found will be listed here."
        action={
          <Button variant="primary" asChild>
            <Link href={`/projects/${projectId}/audit`}>Go to Audit</Link>
          </Button>
        }
      />
    );
  }

  const conditions: SQL[] = [eq(crawlPages.crawlId, crawl.id)];

  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(like(crawlPages.url, pattern), like(crawlPages.title, pattern))!,
    );
  }
  if (status === "ok") {
    conditions.push(
      and(gte(crawlPages.statusCode, 200), lt(crawlPages.statusCode, 300))!,
    );
  } else if (status === "redirect") {
    conditions.push(
      and(gte(crawlPages.statusCode, 300), lt(crawlPages.statusCode, 400))!,
    );
  } else if (status === "broken") {
    conditions.push(gte(crawlPages.statusCode, 400));
  }
  if (issue) {
    conditions.push(
      inArray(
        crawlPages.id,
        db
          .select({ id: pageIssues.pageId })
          .from(pageIssues)
          .where(and(eq(pageIssues.crawlId, crawl.id), eq(pageIssues.code, issue))),
      ),
    );
  }

  const where = and(...conditions);
  const orderBy = dir === "desc" ? desc(SORTABLE[sort]) : asc(SORTABLE[sort]);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: crawlPages.id,
        url: crawlPages.url,
        path: crawlPages.path,
        statusCode: crawlPages.statusCode,
        title: crawlPages.title,
        titleLength: crawlPages.titleLength,
        metaDescriptionLength: crawlPages.metaDescriptionLength,
        h1Count: crawlPages.h1Count,
        wordCount: crawlPages.wordCount,
        inlinkCount: crawlPages.inlinkCount,
        depth: crawlPages.depth,
        responseTimeMs: crawlPages.responseTimeMs,
        isNoindex: crawlPages.isNoindex,
      })
      .from(crawlPages)
      .where(where)
      .orderBy(orderBy)
      .limit(PER_PAGE)
      .offset((pageNumber - 1) * PER_PAGE),
    db
      .select({ total: sql<number>`count(*)` })
      .from(crawlPages)
      .where(where),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const base = `/projects/${projectId}/pages`;

  const sortHref = (key: SortKey) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (issue) next.set("issue", issue);
    next.set("sort", key);
    next.set("dir", sort === key && dir === "asc" ? "desc" : "asc");
    return `${base}?${next.toString()}`;
  };

  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (issue) next.set("issue", issue);
    next.set("sort", sort);
    next.set("dir", dir);
    next.set("page", String(target));
    return `${base}?${next.toString()}`;
  };

  const usedIssueCodes = new Set(
    (
      await db
        .selectDistinct({ code: pageIssues.code })
        .from(pageIssues)
        .where(eq(pageIssues.crawlId, crawl.id))
    ).map((row) => row.code),
  );

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-56 flex-1 space-y-1.5">
          <label htmlFor="q" className="text-[13px] text-muted-foreground">
            Search URL or title
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="/blog" />
        </div>
        <div className="w-44 space-y-1.5">
          <label htmlFor="status" className="text-[13px] text-muted-foreground">
            Status
          </label>
          <NativeSelect id="status" name="status" defaultValue={status}>
            <option value="">All</option>
            <option value="ok">2xx</option>
            <option value="redirect">3xx</option>
            <option value="broken">4xx / 5xx</option>
          </NativeSelect>
        </div>
        <div className="w-56 space-y-1.5">
          <label htmlFor="issue" className="text-[13px] text-muted-foreground">
            Issue
          </label>
          <NativeSelect id="issue" name="issue" defaultValue={issue}>
            <option value="">Any</option>
            {ISSUE_CATALOG.filter((item) => usedIssueCodes.has(item.code)).map(
              (item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ),
            )}
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {q || status || issue ? (
          <Button variant="ghost" asChild>
            <Link href={base}>Reset</Link>
          </Button>
        ) : null}
      </form>

      <p className="text-[13px] text-muted-foreground">
        {formatNumber(total)} {total === 1 ? "page" : "pages"}
        {issue && ISSUE_BY_CODE.has(issue)
          ? ` with "${ISSUE_BY_CODE.get(issue)!.label}"`
          : ""}
      </p>

      {rows.length === 0 ? (
        <Empty
          title="No pages match these filters"
          description="Try widening the search or clearing the issue filter."
        />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <tr>
                <SortableTh label="URL" sortKey="url" sort={sort} dir={dir} href={sortHref("url")} />
                <SortableTh label="Status" sortKey="status" sort={sort} dir={dir} href={sortHref("status")} />
                <SortableTh label="Title" sortKey="title" sort={sort} dir={dir} href={sortHref("title")} />
                <Th>Meta</Th>
                <Th>H1</Th>
                <SortableTh label="Words" sortKey="words" sort={sort} dir={dir} href={sortHref("words")} />
                <SortableTh label="Inlinks" sortKey="inlinks" sort={sort} dir={dir} href={sortHref("inlinks")} />
                <SortableTh label="Depth" sortKey="depth" sort={sort} dir={dir} href={sortHref("depth")} />
                <SortableTh label="Time" sortKey="time" sort={sort} dir={dir} href={sortHref("time")} />
              </tr>
            </Thead>
            <Tbody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="max-w-100">
                    <Link
                      href={`/projects/${projectId}/pages/${row.id}`}
                      className="block truncate font-medium hover:text-accent"
                      title={row.url}
                    >
                      {row.path || "/"}
                    </Link>
                    {row.title ? (
                      <div className="truncate text-[13px] text-muted-foreground">
                        {row.title}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone={statusTone(row.statusCode)}>
                      {row.statusCode ?? "error"}
                    </Badge>
                    {row.isNoindex ? (
                      <Badge tone="outline" className="ml-1">
                        noindex
                      </Badge>
                    ) : null}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {row.titleLength ?? "—"}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {row.metaDescriptionLength ?? "—"}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {row.h1Count}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {formatNumber(row.wordCount)}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {row.inlinkCount}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {row.depth}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {row.responseTimeMs ? `${row.responseTimeMs}ms` : "—"}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            Page {pageNumber} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              asChild
              disabled={pageNumber === 1}
            >
              <Link href={pageHref(Math.max(1, pageNumber - 1))}>Previous</Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              asChild
              disabled={pageNumber === totalPages}
            >
              <Link href={pageHref(Math.min(totalPages, pageNumber + 1))}>
                Next
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
