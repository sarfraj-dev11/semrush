import robotsParser from "robots-parser";
import { TRACKED_BOTS } from "./ai-bots";

type RobotsChecker = ReturnType<typeof robotsParser>;

/**
 * robots.txt impact.
 *
 * The alternative to working around robots.txt: measure precisely what it
 * costs, per bot, and name the line to change.
 *
 * This is the more useful artefact in almost every real case. If it is your
 * own site, a rule blocking Googlebot from /products/ is a serious bug and
 * this is the report that finds it — crawling past the rule would have hidden
 * it. If it is not your site, the rule is the operator's answer, and the honest
 * output is "these 340 URLs are out of scope" rather than a quietly incomplete
 * audit presented as a complete one.
 */

export type BlockedUrl = {
  url: string;
  /** Bots that may not fetch it, by user-agent token. */
  blockedFor: string[];
};

export type RobotsImpact = {
  /** URLs discovered but not fetched because robots.txt disallowed them. */
  skipped: BlockedUrl[];
  /** Per-bot counts across every URL discovered. */
  byBot: { bot: string; label: string; group: "ai" | "search"; blocked: number }[];
  /** True when a rule blocks Googlebot or Bingbot from real content. */
  blocksSearchEngines: boolean;
  /** The most impactful directives, worded as an edit. */
  recommendations: string[];
};

/** Reports what a robots.txt costs across the URLs a crawl discovered. */
export function assessRobotsImpact(
  robots: RobotsChecker | null,
  discoveredUrls: string[],
  crawlerUserAgent: string,
): RobotsImpact {
  if (!robots || discoveredUrls.length === 0) {
    return {
      skipped: [],
      byBot: [],
      blocksSearchEngines: false,
      recommendations: [],
    };
  }

  const skipped: BlockedUrl[] = [];
  const counts = new Map<string, number>();

  for (const url of discoveredUrls) {
    const blockedFor: string[] = [];

    for (const { bot } of TRACKED_BOTS) {
      if (robots.isDisallowed(url, bot)) {
        blockedFor.push(bot);
        counts.set(bot, (counts.get(bot) ?? 0) + 1);
      }
    }

    // Our own crawler is what determines whether the page got audited at all.
    const blockedForUs = robots.isDisallowed(url, crawlerUserAgent);
    if (blockedForUs) {
      counts.set("__crawler__", (counts.get("__crawler__") ?? 0) + 1);
    }

    if (blockedFor.length > 0 || blockedForUs) {
      skipped.push({ url, blockedFor });
    }
  }

  const byBot = TRACKED_BOTS.map(({ bot, label, group }) => ({
    bot,
    label,
    group,
    blocked: counts.get(bot) ?? 0,
  })).filter((entry) => entry.blocked > 0);

  const blocksSearchEngines = byBot.some(
    (entry) => entry.group === "search" && entry.blocked > 0,
  );

  /* ------------------------------------------------------ recommendations -- */
  const recommendations: string[] = [];
  const total = discoveredUrls.length;

  for (const entry of byBot) {
    const share = Math.round((entry.blocked / total) * 100);

    if (entry.group === "search") {
      recommendations.push(
        `${entry.label} is disallowed from ${entry.blocked} of ${total} discovered URLs (${share}%). ` +
          `If those pages should rank, remove the Disallow rule covering them — no amount of ` +
          `crawling changes what the search engine itself will not fetch.`,
      );
    } else {
      recommendations.push(
        `${entry.label} is disallowed from ${entry.blocked} URLs (${share}%). ` +
          `Those pages cannot be quoted in AI answers. Allow it if that is not intended.`,
      );
    }
  }

  const ourBlocked = counts.get("__crawler__") ?? 0;
  if (ourBlocked > 0) {
    recommendations.push(
      `${ourBlocked} URLs were skipped by this audit because robots.txt disallows ` +
        `"${crawlerUserAgent}". To audit them, add an allow rule for this user agent — ` +
        `on a site you own that is a one-line change, and it keeps the audit honest ` +
        `about what search engines can actually see.`,
    );
  }

  return { skipped, byBot, blocksSearchEngines, recommendations };
}
