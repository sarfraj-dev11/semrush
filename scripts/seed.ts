import { db } from "../src/db";
import {
  backlinks,
  clients,
  competitors,
  crawlPages,
  crawls,
  importMappings,
  issueTypes,
  keywordRankings,
  keywords,
  pageIssues,
  pageLinks,
  projects,
  psiRuns,
  settings,
  tasks,
} from "../src/db/schema";
import { ISSUE_CATALOG } from "../src/lib/crawler/issue-catalog";

async function main() {
  // This script wipes every client and replaces them with fictional ones. It
  // exists for local development only; a production database must never see it.
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed.ts refuses to run with NODE_ENV=production");
  }
  if (!process.env.ALLOW_SEED && !(process.env.DATABASE_URL ?? "file:").startsWith("file:")) {
    throw new Error(
      "seed.ts would delete all clients in a remote database. Set ALLOW_SEED=1 if that is intended.",
    );
  }

  console.log("🌱 Seeding fictional development data (Acme Cloud, Starlight, Apex)…");

  // Clean previous demo data for fresh seed
  await db.delete(clients);
  for (const item of ISSUE_CATALOG) {
    await db
      .insert(issueTypes)
      .values({
        code: item.code,
        label: item.label,
        severity: item.severity,
        category: item.category,
        description: item.description,
        howToFix: item.howToFix,
      })
      .onConflictDoNothing();
  }

  // 2. Seed Default Settings
  await db
    .insert(settings)
    .values([
      { key: "default_crawl_depth", value: "3" },
      { key: "default_crawl_limit", value: "500" },
      { key: "default_crawl_concurrency", value: "4" },
      {
        key: "default_user_agent",
        value: "Mozilla/5.0 (compatible; AntigravitySEO/1.0; +https://antigravity.io)",
      },
    ])
    .onConflictDoNothing();

  // 3. Seed Import Mappings
  await db
    .insert(importMappings)
    .values([
      {
        name: "Semrush Organic Keywords Export",
        sourceType: "keywords",
        mapping: {
          keyword: "Keyword",
          search_volume: "Search Volume",
          difficulty: "Keyword Difficulty",
          cpc: "CPC (USD)",
          intent: "Intent",
          target_url: "Landing Page",
        },
      },
      {
        name: "Semrush Position Tracking CSV",
        sourceType: "rankings",
        mapping: {
          keyword: "Keyword",
          position: "Position",
          date: "Date",
          url: "URL",
        },
      },
      {
        name: "Ahrefs Backlinks Full Export",
        sourceType: "backlinks",
        mapping: {
          source_url: "Referring Page",
          source_domain: "Domain",
          target_url: "Target Page",
          anchor_text: "Anchor Text",
          domain_rating: "DR",
          is_follow: "Link Type",
        },
      },
    ])
    .onConflictDoNothing();

  // 4. Seed Clients
  const [client1] = await db
    .insert(clients)
    .values({
      name: "Acme Cloud Corp",
      website: "https://acmecloud.example.com",
      contactName: "Elena Vance",
      contactEmail: "elena@acmecloud.example.com",
      contactPhone: "+1 (555) 234-5678",
      status: "active",
      notes: "Enterprise cloud orchestration platform. Primary focus: B2B organic acquisition.",
    })
    .returning();

  const [client2] = await db
    .insert(clients)
    .values({
      name: "Starlight Retail",
      website: "https://starlight.example.com",
      contactName: "Marcus Sterling",
      contactEmail: "marcus@starlight.example.com",
      status: "active",
      notes: "Direct-to-consumer apparel and lifestyle brand. Focus: Category page indexing & mobile speed.",
    })
    .returning();

  const [client3] = await db
    .insert(clients)
    .values({
      name: "Apex Financial",
      website: "https://apexfin.example.com",
      contactName: "Sarah Chen",
      contactEmail: "schen@apexfin.example.com",
      status: "active",
      notes: "Fintech payment gateway and investment analytics.",
    })
    .returning();

  // 5. Seed Projects
  const [project1] = await db
    .insert(projects)
    .values({
      clientId: client1.id,
      name: "Acme Cloud Main",
      domain: "https://acmecloud.example.com",
      targetCountry: "US",
      targetDevice: "desktop",
      crawlDepth: 3,
      crawlLimit: 250,
      crawlConcurrency: 4,
      respectRobots: true,
    })
    .returning();

  const [project2] = await db
    .insert(projects)
    .values({
      clientId: client2.id,
      name: "Starlight Storefront",
      domain: "https://starlight.example.com",
      targetCountry: "US",
      targetDevice: "mobile",
      crawlDepth: 4,
      crawlLimit: 400,
      crawlConcurrency: 6,
      respectRobots: true,
    })
    .returning();

  const [project3] = await db
    .insert(projects)
    .values({
      clientId: client3.id,
      name: "Apex Platform Portal",
      domain: "https://apexfin.example.com",
      targetCountry: "GB",
      targetDevice: "mobile",
      crawlDepth: 2,
      crawlLimit: 100,
    })
    .returning();

  // 6. Seed Completed Crawls & Audit Issues for Project 1
  const [crawl1] = await db
    .insert(crawls)
    .values({
      projectId: project1.id,
      status: "completed",
      pagesCrawled: 42,
      pagesFound: 68,
      issuesFound: 14,
      criticalCount: 2,
      warningCount: 7,
      noticeCount: 5,
      healthScore: 84,
      robotsTxtFound: true,
      sitemapUrls: 50,
      startedAt: new Date(Date.now() - 3600000 * 4),
      finishedAt: new Date(Date.now() - 3600000 * 3.8),
    })
    .returning();

  // Seed sample crawl pages for Project 1
  const samplePagesData = [
    {
      crawlId: crawl1.id,
      url: "https://acmecloud.example.com/",
      path: "/",
      depth: 0,
      statusCode: 200,
      title: "Acme Cloud — Enterprise Cloud Orchestration & DevOps Platform",
      titleLength: 61,
      metaDescription: "Scale your cloud infrastructure with automated Kubernetes deployments, real-time observability, and enterprise compliance.",
      metaDescriptionLength: 135,
      h1: ["Enterprise Cloud Orchestration Built for Modern DevOps"],
      h1Count: 1,
      h2Count: 6,
      wordCount: 1420,
      inlinkCount: 28,
      internalLinks: 18,
      externalLinks: 4,
      responseTimeMs: 145,
      sizeBytes: 48200,
    },
    {
      crawlId: crawl1.id,
      url: "https://acmecloud.example.com/features/kubernetes",
      path: "/features/kubernetes",
      depth: 1,
      statusCode: 200,
      title: "Managed Kubernetes Orchestration | Acme Cloud",
      titleLength: 47,
      metaDescription: "Deploy and manage secure K8s clusters across multi-cloud regions in seconds.",
      metaDescriptionLength: 79,
      h1: ["High-Performance Managed Kubernetes"],
      h1Count: 1,
      h2Count: 4,
      wordCount: 980,
      inlinkCount: 14,
      internalLinks: 12,
      externalLinks: 2,
      responseTimeMs: 182,
      sizeBytes: 36400,
    },
    {
      crawlId: crawl1.id,
      url: "https://acmecloud.example.com/pricing",
      path: "/pricing",
      depth: 1,
      statusCode: 200,
      title: "Pricing Plans for Teams & Enterprises — Acme Cloud",
      titleLength: 51,
      metaDescription: "Transparent usage-based pricing with no hidden egress fees. Start free today.",
      metaDescriptionLength: 79,
      h1: ["Simple, Transparent Cloud Pricing"],
      h1Count: 1,
      h2Count: 3,
      wordCount: 650,
      inlinkCount: 22,
      internalLinks: 10,
      externalLinks: 1,
      responseTimeMs: 120,
      sizeBytes: 28900,
    },
    {
      crawlId: crawl1.id,
      url: "https://acmecloud.example.com/blog/migrating-to-microservices",
      path: "/blog/migrating-to-microservices",
      depth: 2,
      statusCode: 200,
      title: "Migrating Legacy Monoliths to Cloud Microservices in 2026",
      titleLength: 57,
      metaDescription: "A step-by-step technical guide to deconstructing legacy architecture without downtime.",
      metaDescriptionLength: 87,
      h1: ["Migrating to Microservices Guide"],
      h1Count: 1,
      h2Count: 8,
      wordCount: 2150,
      inlinkCount: 8,
      internalLinks: 15,
      externalLinks: 6,
      responseTimeMs: 210,
      sizeBytes: 52100,
    },
    {
      crawlId: crawl1.id,
      url: "https://acmecloud.example.com/legacy-docs",
      path: "/legacy-docs",
      depth: 2,
      statusCode: 404,
      title: null,
      titleLength: 0,
      metaDescription: null,
      h1Count: 0,
      wordCount: 45,
      inlinkCount: 2,
      responseTimeMs: 95,
      sizeBytes: 1200,
    },
    {
      crawlId: crawl1.id,
      url: "https://acmecloud.example.com/beta-preview",
      path: "/beta-preview",
      depth: 2,
      statusCode: 200,
      title: "Preview",
      titleLength: 7,
      isNoindex: true,
      metaRobots: "noindex, nofollow",
      h1Count: 0,
      wordCount: 120,
      inlinkCount: 1,
      responseTimeMs: 140,
      sizeBytes: 14500,
    },
  ];

  for (const p of samplePagesData) {
    const [insertedPage] = await db.insert(crawlPages).values(p).returning();

    // Attach sample issues
    if (p.statusCode === 404) {
      await db.insert(pageIssues).values({
        crawlId: crawl1.id,
        pageId: insertedPage.id,
        code: "http_4xx",
        detail: "Server returned HTTP 404 Not Found",
      });
    } else if (p.title === null || (p.titleLength && p.titleLength < 10)) {
      await db.insert(pageIssues).values({
        crawlId: crawl1.id,
        pageId: insertedPage.id,
        code: "title_short",
        detail: `Title is only ${p.titleLength} characters`,
      });
    }
  }

  // 7. Seed PageSpeed Insights Runs
  await db.insert(psiRuns).values([
    {
      projectId: project1.id,
      url: "https://acmecloud.example.com",
      strategy: "desktop",
      performanceScore: 92,
      seoScore: 96,
      accessibilityScore: 94,
      bestPracticesScore: 100,
      lcpMs: 1250,
      cls: 0.02,
      inpMs: 65,
      fcpMs: 820,
      ttfbMs: 180,
      tbtMs: 40,
      hasFieldData: true,
      opportunities: [
        { id: "modern-image-formats", title: "Serve images in next-gen formats (WebP/AVIF)", savingsMs: 240 },
        { id: "unused-javascript", title: "Reduce unused JavaScript", savingsMs: 180 },
      ],
      createdAt: new Date(Date.now() - 3600000 * 2),
    },
    {
      projectId: project1.id,
      url: "https://acmecloud.example.com",
      strategy: "mobile",
      performanceScore: 81,
      seoScore: 95,
      accessibilityScore: 90,
      bestPracticesScore: 96,
      lcpMs: 2100,
      cls: 0.05,
      inpMs: 140,
      fcpMs: 1350,
      ttfbMs: 260,
      tbtMs: 110,
      hasFieldData: true,
      opportunities: [
        { id: "render-blocking-resources", title: "Eliminate render-blocking resources", savingsMs: 420 },
        { id: "unused-css-rules", title: "Reduce unused CSS", savingsMs: 190 },
      ],
      createdAt: new Date(Date.now() - 3600000 * 2),
    },
  ]);

  // 8. Seed Keywords & Historical Rankings
  const kwData = [
    { kw: "cloud orchestration platform", vol: 4400, kd: 54, cpc: 8.5, intent: "Commercial", target: "https://acmecloud.example.com" },
    { kw: "kubernetes deployment tool", vol: 3200, kd: 48, cpc: 6.2, intent: "Commercial", target: "https://acmecloud.example.com/features/kubernetes" },
    { kw: "enterprise devops automation", vol: 1900, kd: 62, cpc: 11.0, intent: "Commercial", target: "https://acmecloud.example.com" },
    { kw: "cloud infrastructure pricing", vol: 1600, kd: 35, cpc: 4.8, intent: "Transactional", target: "https://acmecloud.example.com/pricing" },
    { kw: "how to migrate monolith to microservices", vol: 2400, kd: 28, cpc: 2.1, intent: "Informational", target: "https://acmecloud.example.com/blog/migrating-to-microservices" },
    { kw: "multi-cloud management software", vol: 5400, kd: 70, cpc: 14.5, intent: "Commercial", target: "https://acmecloud.example.com" },
  ];

  const rankingDates = ["2026-04-01", "2026-04-08", "2026-04-15", "2026-04-22", "2026-04-29"];

  const allRankingsToInsert: (typeof keywordRankings.$inferInsert)[] = [];

  for (const item of kwData) {
    const [insertedKw] = await db
      .insert(keywords)
      .values({
        projectId: project1.id,
        keyword: item.kw,
        searchVolume: item.vol,
        difficulty: item.kd,
        cpc: item.cpc,
        intent: item.intent,
        targetUrl: item.target,
        tags: "core, priority",
      })
      .returning();

    // Generate historical rankings
    const baseRank = Math.floor(Math.random() * 8) + 2;
    for (let i = 0; i < rankingDates.length; i++) {
      const pos = Math.max(1, baseRank - i + (Math.floor(Math.random() * 3) - 1));
      allRankingsToInsert.push({
        keywordId: insertedKw.id,
        date: rankingDates[i],
        position: pos,
        url: item.target,
        source: "seed",
      });
    }
  }

  if (allRankingsToInsert.length > 0) {
    await db.insert(keywordRankings).values(allRankingsToInsert);
  }

  // 9. Seed Backlinks
  await db.insert(backlinks).values([
    {
      projectId: project1.id,
      sourceUrl: "https://techcrunch.com/2026/03/top-cloud-orchestration-tools",
      sourceDomain: "techcrunch.com",
      targetUrl: "https://acmecloud.example.com",
      anchorText: "Acme Cloud orchestration",
      domainRating: 92,
      isFollow: true,
      firstSeen: "2026-03-12",
      status: "active",
    },
    {
      projectId: project1.id,
      sourceUrl: "https://dev.to/cloudguru/kubernetes-in-production-guide",
      sourceDomain: "dev.to",
      targetUrl: "https://acmecloud.example.com/features/kubernetes",
      anchorText: "managed K8s provider",
      domainRating: 78,
      isFollow: true,
      firstSeen: "2026-03-20",
      status: "active",
    },
    {
      projectId: project1.id,
      sourceUrl: "https://hackernoon.com/microservices-architecture-2026",
      sourceDomain: "hackernoon.com",
      targetUrl: "https://acmecloud.example.com/blog/migrating-to-microservices",
      anchorText: "migration breakdown",
      domainRating: 84,
      isFollow: true,
      firstSeen: "2026-04-02",
      status: "new",
    },
    {
      projectId: project1.id,
      sourceUrl: "https://medium.com/@devlead/cloud-pricing-comparison",
      sourceDomain: "medium.com",
      targetUrl: "https://acmecloud.example.com/pricing",
      anchorText: "pricing tiers",
      domainRating: 88,
      isFollow: false,
      firstSeen: "2026-02-15",
      status: "active",
    },
  ]);

  // 10. Seed Competitors
  await db.insert(competitors).values([
    { projectId: project1.id, domain: "hashicorp.com", name: "HashiCorp" },
    { projectId: project1.id, domain: "datadoghq.com", name: "Datadog" },
    { projectId: project1.id, domain: "spacelift.io", name: "Spacelift" },
  ]);

  // 11. Seed Tasks
  await db.insert(tasks).values([
    {
      projectId: project1.id,
      title: "Fix 404 broken link on /legacy-docs",
      description: "Update internal inlinks to point to /docs or configure a 301 redirect.",
      status: "in_progress",
      priority: "high",
      assignee: "David (DevOps)",
      dueDate: "2026-05-05",
      issueCode: "http_4xx",
      pageUrl: "https://acmecloud.example.com/legacy-docs",
    },
    {
      projectId: project1.id,
      title: "Add missing meta descriptions to pricing subpages",
      description: "Craft unique 120-155 character meta descriptions with clear conversion CTA.",
      status: "todo",
      priority: "medium",
      assignee: "Sarah (Content)",
      dueDate: "2026-05-10",
      issueCode: "meta_desc_missing",
      pageUrl: "https://acmecloud.example.com/pricing",
    },
    {
      projectId: project1.id,
      title: "Optimize LCP image on home hero banner",
      description: "Convert hero PNG to AVIF format with fetchpriority='high'.",
      status: "done",
      priority: "high",
      assignee: "Elena (Frontend)",
      dueDate: "2026-04-20",
      completedAt: new Date(Date.now() - 86400000 * 5),
    },
  ]);

  console.log("✅ Seed completed successfully! All tables populated.");
}

main().catch((error) => {
  console.error("❌ Seed script failed:", error);
  process.exit(1);
});
