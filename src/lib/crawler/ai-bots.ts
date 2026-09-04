import robotsParser from "robots-parser";
import type { BotAccess } from "@/db/schema";
import { fetchText, isPlainTextBody } from "./fetcher";

type RobotsChecker = ReturnType<typeof robotsParser>;

export type BotDefinition = {
  /** Token as it must appear after "User-agent:" in robots.txt. */
  bot: string;
  label: string;
  group: "ai" | "search";
};

/**
 * The crawlers worth reporting on. AI assistants split their work across
 * several agents — OpenAI alone uses one for training, one for live browsing
 * and one for its search index — and a site can easily allow one while
 * blocking another, so each is evaluated separately rather than as "AI bots".
 */
export const TRACKED_BOTS: BotDefinition[] = [
  { bot: "GPTBot", label: "GPTBot", group: "ai" },
  { bot: "ChatGPT-User", label: "ChatGPT-User", group: "ai" },
  { bot: "OAI-SearchBot", label: "OAI-SearchBot", group: "ai" },
  { bot: "ClaudeBot", label: "ClaudeBot", group: "ai" },
  { bot: "Claude-User", label: "Claude-User", group: "ai" },
  { bot: "PerplexityBot", label: "PerplexityBot", group: "ai" },
  { bot: "Google-Extended", label: "Google-Extended", group: "ai" },
  { bot: "Applebot-Extended", label: "Applebot-Extended", group: "ai" },
  { bot: "CCBot", label: "CCBot", group: "ai" },
  { bot: "Googlebot", label: "Googlebot", group: "search" },
  { bot: "Bingbot", label: "Bingbot", group: "search" },
];

const AI_BOT_TOKENS = new Set(
  TRACKED_BOTS.filter((entry) => entry.group === "ai").map((entry) => entry.bot),
);

/** How many blocked paths to keep per bot for the UI. */
const BLOCKED_SAMPLE_SIZE = 5;

export function parseRobots(
  robotsUrl: string,
  body: string | null,
): RobotsChecker | null {
  if (!body) return null;
  return robotsParser(robotsUrl, body);
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Works out, per bot, whether robots.txt lets it reach the pages we actually
 * found. Judging by the crawled set rather than the site root matters: a site
 * that allows `/` but disallows `/blog/` is not "all good" for a bot whose
 * whole reason to visit is the blog.
 */
export function evaluateBotAccess(
  robots: RobotsChecker | null,
  urls: string[],
): BotAccess[] {
  return TRACKED_BOTS.map(({ bot, label, group }) => {
    if (!robots || urls.length === 0) {
      return { bot, label, group, allowed: true, blockedSample: [] };
    }

    const blocked: string[] = [];
    for (const url of urls) {
      if (robots.isDisallowed(url, bot)) blocked.push(pathOf(url));
    }

    return {
      bot,
      label,
      group,
      allowed: blocked.length === 0,
      blockedSample: blocked.slice(0, BLOCKED_SAMPLE_SIZE),
    };
  });
}

/** True when any tracked AI crawler is disallowed from this specific URL. */
export function isBlockedForAiBots(
  robots: RobotsChecker | null,
  url: string,
): boolean {
  if (!robots) return false;
  for (const token of AI_BOT_TOKENS) {
    if (robots.isDisallowed(url, token)) return true;
  }
  return false;
}

/**
 * llms.txt is the emerging convention for pointing an assistant at the pages
 * worth reading. Absent is a notice, not an error — it is not a standard yet.
 */
export async function fetchLlmsTxt(
  origin: string,
  userAgent: string,
): Promise<boolean> {
  const url = new URL("/llms.txt", origin).toString();
  const { ok, body, contentType } = await fetchText(url, { userAgent });
  // A site that soft-404s by serving its HTML shell does not have an llms.txt.
  return ok && isPlainTextBody(body, contentType);
}
