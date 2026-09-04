/**
 * Challenge detection.
 *
 * The inverse of a CAPTCHA solver. When a site challenges the crawler, this
 * recognises it, stops, and reports exactly what happened and what to change.
 *
 * That is not a weaker outcome — it is a more useful one. A solver turns "this
 * site is challenging you" into a silent extra cost per page and a slow slide
 * toward a permanent block, and the audit still cannot tell you why 40 pages
 * are missing. Detection turns the same event into a finding with a fix: for a
 * site you own, allowlist the crawler; for one you do not, you have your answer
 * about whether you are allowed to crawl it.
 *
 * Pure: everything comes from the response the crawler already has.
 */

export type ChallengeType =
  | "cloudflare"
  | "recaptcha"
  | "hcaptcha"
  | "turnstile"
  | "datadome"
  | "perimeterx"
  | "akamai"
  | "imperva"
  | "rate_limit"
  | "login_wall";

export type ChallengeVerdict = {
  challenged: boolean;
  type: ChallengeType | null;
  /** What in the response gave it away, for the report. */
  evidence: string | null;
  /** Plain-language next step. */
  remedy: string | null;
};

const NOT_CHALLENGED: ChallengeVerdict = {
  challenged: false,
  type: null,
  evidence: null,
  remedy: null,
};

type Signature = {
  type: ChallengeType;
  remedy: string;
  header?: (headers: Record<string, string>) => string | null;
  body?: RegExp;
  bodyLabel?: string;
};

/**
 * Ordered most to least specific. Vendor markers first, because a DataDome page
 * also happens to look like a generic block page and the vendor name is the
 * part that tells you which allowlist to edit.
 */
const SIGNATURES: Signature[] = [
  {
    type: "datadome",
    remedy: "Allowlist the crawler's user agent or IP range in the DataDome dashboard.",
    header: (h) => ("x-datadome" in h ? "x-datadome header" : null),
    body: /datadome|dd_?cookie/i,
    bodyLabel: "DataDome challenge markup",
  },
  {
    type: "perimeterx",
    remedy: "Add the crawler to the PerimeterX allowlist for this domain.",
    header: (h) => ("x-px-block" in h ? "x-px-block header" : null),
    body: /_pxhd|perimeterx|px-captcha/i,
    bodyLabel: "PerimeterX challenge markup",
  },
  {
    type: "turnstile",
    remedy:
      "Turnstile is a Cloudflare challenge. Add a WAF skip rule for the crawler's user agent.",
    body: /challenges\.cloudflare\.com\/turnstile|cf-turnstile/i,
    bodyLabel: "Cloudflare Turnstile widget",
  },
  {
    type: "cloudflare",
    remedy:
      "In Cloudflare, add a WAF custom rule skipping Bot Fight Mode for this user agent, or allowlist the crawler's IPs.",
    header: (h) =>
      h["cf-mitigated"] === "challenge" ? "cf-mitigated: challenge" : null,
    body: /just a moment|cf-browser-verification|__cf_chl_|checking your browser/i,
    bodyLabel: "Cloudflare interstitial",
  },
  {
    type: "recaptcha",
    remedy:
      "The origin is serving reCAPTCHA. Exempt the crawler at the application or WAF layer.",
    body: /google\.com\/recaptcha|g-recaptcha/i,
    bodyLabel: "reCAPTCHA widget",
  },
  {
    type: "hcaptcha",
    remedy:
      "The origin is serving hCaptcha. Exempt the crawler at the application or WAF layer.",
    body: /hcaptcha\.com\/(1\/api|captcha)|h-captcha/i,
    bodyLabel: "hCaptcha widget",
  },
  {
    type: "imperva",
    remedy: "Add the crawler to the Imperva/Incapsula allowlist.",
    header: (h) => ("x-iinfo" in h ? "x-iinfo header" : null),
    body: /incapsula|_incap_/i,
    bodyLabel: "Imperva challenge markup",
  },
  {
    type: "akamai",
    remedy: "Add a Bot Manager exception for the crawler in Akamai.",
    body: /ak-bmsc|akamai bot manager|reference\s*#\d+\.\w+/i,
    bodyLabel: "Akamai bot manager block",
  },
];

/** A challenge page is small and has almost no real text. */
const CHALLENGE_WORD_CEILING = 120;

/**
 * Works out whether a response is a challenge rather than a page. Deliberately
 * conservative: a false positive would stop a crawl that could have continued,
 * so vendor evidence is required unless the status code alone is conclusive.
 */
export function detectChallenge(input: {
  statusCode: number | null;
  headers: Record<string, string>;
  html: string | null;
  /** Word count from the parsed page, when it was parsed. */
  wordCount?: number;
}): ChallengeVerdict {
  const { statusCode, headers, html, wordCount } = input;

  // 429 is unambiguous and needs no body evidence.
  if (statusCode === 429) {
    return {
      challenged: true,
      type: "rate_limit",
      evidence: "HTTP 429 Too Many Requests",
      remedy:
        "Lower the crawl profile or raise the delay. The site is asking for fewer requests, not a different IP.",
    };
  }

  const body = html ?? "";
  const isBlockStatus = statusCode === 403 || statusCode === 503;

  for (const signature of SIGNATURES) {
    const headerEvidence = signature.header?.(headers) ?? null;
    const bodyMatches = signature.body?.test(body) ?? false;

    if (!headerEvidence && !bodyMatches) continue;

    // A body marker on a healthy, content-bearing page is not a challenge —
    // plenty of normal pages embed a reCAPTCHA in a contact form.
    if (!headerEvidence && !isBlockStatus) {
      const looksEmpty =
        wordCount !== undefined && wordCount <= CHALLENGE_WORD_CEILING;
      if (!looksEmpty) continue;
    }

    return {
      challenged: true,
      type: signature.type,
      evidence: headerEvidence ?? signature.bodyLabel ?? "challenge markup",
      remedy: signature.remedy,
    };
  }

  // An unexplained 403 with no page behind it: still a block, vendor unknown.
  if (statusCode === 403 && (wordCount ?? 0) <= CHALLENGE_WORD_CEILING) {
    return {
      challenged: true,
      type: "login_wall",
      evidence: "HTTP 403 with no readable content",
      remedy:
        "The origin refused the request. Check for an IP allowlist, a login requirement, or a user-agent block.",
    };
  }

  return NOT_CHALLENGED;
}

/**
 * Tracks challenges across a crawl so the run can stop early rather than
 * hammering a host that has already made its position clear.
 */
export class ChallengeTracker {
  private readonly counts = new Map<ChallengeType, number>();
  private first: ChallengeVerdict | null = null;
  private total = 0;

  constructor(
    /** Consecutive challenges before the crawl gives up on this host. */
    private readonly threshold = 5,
  ) {}

  record(verdict: ChallengeVerdict) {
    if (!verdict.challenged || !verdict.type) return;
    this.total++;
    this.counts.set(verdict.type, (this.counts.get(verdict.type) ?? 0) + 1);
    this.first ??= verdict;
  }

  /** True once the site has challenged us enough times to stop asking. */
  get shouldStop(): boolean {
    return this.total >= this.threshold;
  }

  get count(): number {
    return this.total;
  }

  /** One line the operator can act on, or null when nothing was challenged. */
  summary(): string | null {
    if (!this.first) return null;

    const breakdown = [...this.counts.entries()]
      .map(([type, count]) => `${type} ×${count}`)
      .join(", ");

    return `Blocked by ${breakdown}. ${this.first.remedy}`;
  }
}
