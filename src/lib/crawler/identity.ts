/**
 * Request identities.
 *
 * A site can serve completely different markup to a desktop Chrome, an iPhone
 * Safari and a bare crawler — different meta tags, different canonicals,
 * different content behind a mobile redirect. Auditing only one of them means
 * auditing a page most of your visitors never see, so the crawler can present
 * itself as any of several *real, coherent* clients.
 *
 * Coherent is the important word. A header set is only useful for testing if it
 * hangs together the way a real browser's does — a Chrome user agent paired
 * with Safari's Accept header describes a client that does not exist, and any
 * server-side branching on it gives an answer that means nothing.
 *
 * By default every identity still carries the bot token, so a site owner
 * reading their logs can see what we are and block us if they want to. Dropping
 * that is a deliberate configuration choice, not the default.
 */

export type DeviceClass = "desktop" | "mobile";

export type IdentityProfile = {
  id: string;
  label: string;
  device: DeviceClass;
  userAgent: string;
  /** Headers a real client of this type sends, minus Accept-Language. */
  headers: Record<string, string>;
};

/** Appended so the crawler stays identifiable in server logs. */
export const BOT_TOKEN = "SEOConsoleBot/1.0 (+internal site audit)";

const CHROME_DESKTOP: IdentityProfile = {
  id: "chrome-desktop",
  label: "Chrome on Windows",
  device: "desktop",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  headers: {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Sec-CH-UA": '"Chromium";v="141", "Not(A:Brand";v="24", "Google Chrome";v="141"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"Windows"',
    "Upgrade-Insecure-Requests": "1",
  },
};

const SAFARI_IPHONE: IdentityProfile = {
  id: "safari-iphone",
  label: "Safari on iPhone",
  device: "mobile",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  headers: {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Upgrade-Insecure-Requests": "1",
  },
};

const CHROME_ANDROID: IdentityProfile = {
  id: "chrome-android",
  label: "Chrome on Android",
  device: "mobile",
  userAgent:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
  headers: {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Sec-CH-UA": '"Chromium";v="141", "Not(A:Brand";v="24", "Google Chrome";v="141"',
    "Sec-CH-UA-Mobile": "?1",
    "Sec-CH-UA-Platform": '"Android"',
    "Upgrade-Insecure-Requests": "1",
  },
};

const SAFARI_MAC: IdentityProfile = {
  id: "safari-mac",
  label: "Safari on macOS",
  device: "desktop",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  headers: {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Upgrade-Insecure-Requests": "1",
  },
};

/** The plain, honest crawler identity. The default. */
export const BOT_IDENTITY: IdentityProfile = {
  id: "bot",
  label: "SEO Console crawler",
  device: "desktop",
  userAgent: `${BOT_TOKEN} (respects robots.txt)`,
  headers: {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  },
};

export const IDENTITY_PROFILES: IdentityProfile[] = [
  BOT_IDENTITY,
  CHROME_DESKTOP,
  SAFARI_MAC,
  SAFARI_IPHONE,
  CHROME_ANDROID,
];

const BY_ID = new Map(IDENTITY_PROFILES.map((profile) => [profile.id, profile]));

export type IdentityRequest = {
  /** Restrict to profiles matching this device class. */
  device?: DeviceClass;
  /** Pick a specific profile by id. */
  id?: string;
  /** Rotation index; the caller supplies it so selection stays deterministic. */
  index?: number;
  /**
   * Keep the bot token in the user agent. Defaults to true — turning it off
   * makes the crawler indistinguishable from a browser in server logs, which
   * is a decision the operator should make knowingly.
   */
  identifyAsBot?: boolean;
};

export function pickIdentity(request: IdentityRequest = {}): IdentityProfile {
  const { device, id, index = 0, identifyAsBot = true } = request;

  let profile: IdentityProfile | undefined;

  if (id) {
    profile = BY_ID.get(id);
  } else {
    const candidates = device
      ? IDENTITY_PROFILES.filter((entry) => entry.device === device)
      : IDENTITY_PROFILES;
    profile = candidates[Math.abs(index) % candidates.length];
  }

  profile ??= BOT_IDENTITY;

  if (!identifyAsBot || profile.id === "bot") return profile;

  // Real browser string plus our token: the site sees a browser-equivalent
  // client and still knows exactly who is asking.
  return {
    ...profile,
    userAgent: `${profile.userAgent} ${BOT_TOKEN}`,
  };
}

/**
 * Builds the final header set. Accept-Language is separate because it is the
 * one header whose value is a genuine test input — it is how the locale probe
 * asks a site what it serves a German visitor.
 */
export function headersFor(
  profile: IdentityProfile,
  options: { acceptLanguage?: string; referer?: string } = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": profile.userAgent,
    ...profile.headers,
    "Accept-Language": options.acceptLanguage ?? "en-US,en;q=0.9",
  };

  if (options.referer) headers.Referer = options.referer;
  return headers;
}
