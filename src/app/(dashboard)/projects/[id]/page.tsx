import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectWithClient } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage({
  params,
}: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const record = await getProjectWithClient(Number(id));
  if (!record) notFound();

  const { project } = record;

  const settings = [
    { label: "Start URL", value: project.domain },
    { label: "Max crawl depth", value: String(project.crawlDepth) },
    { label: "Page limit", value: String(project.crawlLimit) },
    { label: "Concurrency", value: String(project.crawlConcurrency) },
    {
      label: "robots.txt",
      value: project.respectRobots ? "Respected" : "Ignored",
    },
    { label: "Target", value: `${project.targetCountry} · ${project.targetDevice}` },
    { label: "Exclude", value: project.excludePatterns ?? "—" },
    { label: "Include only", value: project.includePatterns ?? "—" },
    { label: "Created", value: formatDate(project.createdAt) },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Crawl configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {settings.map((setting) => (
              <div key={setting.label}>
                <dt className="text-[12px] text-subtle-foreground">
                  {setting.label}
                </dt>
                <dd className="text-[14px] break-words">{setting.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
