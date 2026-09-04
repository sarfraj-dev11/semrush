import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface PsiResult {
  url: string;
  strategy: "mobile" | "desktop";
  performanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  fcpMs: number | null;
  ttfbMs: number | null;
  tbtMs: number | null;
  speedIndexMs: number | null;
  hasFieldData: boolean;
  opportunities: { id: string; title: string; savingsMs: number }[];
}

export async function getPsiApiKey(): Promise<string | null> {
  if (process.env.PAGESPEED_API_KEY) {
    return process.env.PAGESPEED_API_KEY;
  }
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "psi_api_key"))
      .limit(1);
    return row?.value ?? null;
  } catch (err) {
    console.error("⚠️ Failed to fetch PSI API key from settings:", err);
    return null;
  }
}

export async function fetchPsiAudit(
  url: string,
  strategy: "mobile" | "desktop" = "mobile",
): Promise<PsiResult> {
  const apiKey = await getPsiApiKey();
  const endpoint = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
  );
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.append("category", "performance");
  endpoint.searchParams.append("category", "seo");
  endpoint.searchParams.append("category", "accessibility");
  endpoint.searchParams.append("category", "best-practices");

  if (apiKey) {
    endpoint.searchParams.set("key", apiKey);
  }

  const response = await fetch(endpoint.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`❌ PageSpeed Insights API failed [${response.status}]:`, errorText);
    throw new Error(
      `PageSpeed Insights API request failed (${response.status}): ${response.statusText}`,
    );
  }

  const data = await response.json();
  const lighthouse = data.lighthouseResult;
  const categories = lighthouse?.categories ?? {};
  const audits = lighthouse?.audits ?? {};

  const performanceScore = categories.performance?.score != null
    ? Math.round(categories.performance.score * 100)
    : null;
  const seoScore = categories.seo?.score != null
    ? Math.round(categories.seo.score * 100)
    : null;
  const accessibilityScore = categories.accessibility?.score != null
    ? Math.round(categories.accessibility.score * 100)
    : null;
  const bestPracticesScore = categories["best-practices"]?.score != null
    ? Math.round(categories["best-practices"].score * 100)
    : null;

  const lcpMs = audits["largest-contentful-paint"]?.numericValue != null
    ? Math.round(audits["largest-contentful-paint"].numericValue)
    : null;
  const cls = audits["cumulative-layout-shift"]?.numericValue != null
    ? Number(audits["cumulative-layout-shift"].numericValue.toFixed(3))
    : null;
  const inpMs = audits["interaction-to-next-paint"]?.numericValue != null
    ? Math.round(audits["interaction-to-next-paint"].numericValue)
    : audits["total-blocking-time"]?.numericValue != null
    ? Math.round(audits["total-blocking-time"].numericValue)
    : null;
  const fcpMs = audits["first-contentful-paint"]?.numericValue != null
    ? Math.round(audits["first-contentful-paint"].numericValue)
    : null;
  const ttfbMs = audits["server-response-time"]?.numericValue != null
    ? Math.round(audits["server-response-time"].numericValue)
    : null;
  const tbtMs = audits["total-blocking-time"]?.numericValue != null
    ? Math.round(audits["total-blocking-time"].numericValue)
    : null;
  const speedIndexMs = audits["speed-index"]?.numericValue != null
    ? Math.round(audits["speed-index"].numericValue)
    : null;

  const opportunityAuditKeys = [
    "render-blocking-resources",
    "unminified-css",
    "unminified-javascript",
    "unused-css-rules",
    "unused-javascript",
    "modern-image-formats",
    "uses-optimized-images",
    "uses-text-compression",
    "uses-responsive-images",
    "efficient-animated-content",
    "duplicated-javascript",
    "legacy-javascript",
    "total-byte-weight",
    "offscreen-images",
  ];

  const opportunities: { id: string; title: string; savingsMs: number }[] = [];
  for (const key of opportunityAuditKeys) {
    const audit = audits[key];
    if (audit && (audit.details?.overallSavingsMs > 0 || audit.numericValue > 0)) {
      const savingsMs = Math.round(
        audit.details?.overallSavingsMs ?? audit.numericValue ?? 0,
      );
      if (savingsMs > 50) {
        opportunities.push({
          id: key,
          title: audit.title ?? key,
          savingsMs,
        });
      }
    }
  }

  opportunities.sort((a, b) => b.savingsMs - a.savingsMs);

  const hasFieldData = Boolean(
    data.loadingExperience?.metrics || data.originLoadingExperience?.metrics,
  );

  return {
    url,
    strategy,
    performanceScore,
    seoScore,
    accessibilityScore,
    bestPracticesScore,
    lcpMs,
    cls,
    inpMs,
    fcpMs,
    ttfbMs,
    tbtMs,
    speedIndexMs,
    hasFieldData,
    opportunities,
  };
}
