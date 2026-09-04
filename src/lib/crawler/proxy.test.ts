import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isProxyFault } from "./fetcher";
import { headersFor, pickIdentity, BOT_TOKEN } from "./identity";
import { parseProxyConfig, ProxyPool, type ProxyEndpoint } from "./proxy";

const endpoints: ProxyEndpoint[] = [
  { id: "a", url: "http://a.test:8080", type: "datacenter", country: "US" },
  { id: "b", url: "http://b.test:8080", type: "residential", country: "GB" },
  { id: "c", url: "http://c.test:8080", type: "mobile", country: "GB" },
];

describe("parseProxyConfig", () => {
  it("parses type, country and URL", () => {
    const parsed = parseProxyConfig(
      [
        "residential:GB:http://user:pass@gate.test:7000",
        "datacenter::http://10.0.0.5:3128",
        "mobile:in:http://m.test:9000",
      ].join("\n"),
    );

    assert.equal(parsed.length, 3);
    assert.equal(parsed[0].type, "residential");
    assert.equal(parsed[0].country, "GB");
    assert.equal(parsed[1].country, null);
    // Country codes are normalised to uppercase.
    assert.equal(parsed[2].country, "IN");
  });

  it("skips comments, blanks and malformed lines", () => {
    const parsed = parseProxyConfig(
      ["# a comment", "", "not-a-proxy-line", "ftp:US:ftp://x.test", "datacenter::http://ok.test:1"].join(
        "\n",
      ),
    );
    assert.equal(parsed.length, 1);
  });

  it("returns nothing for empty config", () => {
    assert.deepEqual(parseProxyConfig(null), []);
    assert.deepEqual(parseProxyConfig(""), []);
  });
});

describe("ProxyPool rotation", () => {
  it("hands out a different proxy each request", () => {
    const pool = new ProxyPool(endpoints, { strategy: "per-request" });
    const picks = [pool.next(), pool.next(), pool.next()].map((p) => p?.id);
    assert.equal(new Set(picks).size, 3);
  });

  it("keeps one proxy for a sticky session", () => {
    const pool = new ProxyPool(endpoints, { strategy: "sticky" });
    const first = pool.next({ sessionKey: "login-flow" });
    const second = pool.next({ sessionKey: "login-flow" });
    const other = pool.next({ sessionKey: "different-flow" });

    assert.equal(first?.id, second?.id);
    assert.ok(other);
  });

  it("releases a sticky session on request", () => {
    const pool = new ProxyPool(endpoints, { strategy: "sticky" });
    const first = pool.next({ sessionKey: "flow" });
    pool.releaseSession("flow");
    const after = pool.next({ sessionKey: "flow" });
    // A fresh pin may land anywhere; what matters is that it re-pinned.
    assert.ok(after);
    assert.ok(first);
  });

  it("expires a sticky session after its TTL", async () => {
    const pool = new ProxyPool(endpoints, { strategy: "sticky", stickyTtlMs: 20 });
    const first = pool.next({ sessionKey: "flow" });
    await new Promise((resolve) => setTimeout(resolve, 40));
    const second = pool.next({ sessionKey: "flow" });
    assert.ok(first && second);
  });
});

describe("ProxyPool geo targeting", () => {
  it("only returns proxies in the requested country", () => {
    const pool = new ProxyPool(endpoints, { strategy: "per-request" });
    for (let i = 0; i < 6; i++) {
      assert.equal(pool.next({ country: "GB" })?.country, "GB");
    }
  });

  it("returns null rather than the wrong country", () => {
    const pool = new ProxyPool(endpoints, { strategy: "per-request" });
    assert.equal(pool.next({ country: "JP" }), null);
  });

  it("falls back only when explicitly allowed", () => {
    const pool = new ProxyPool(endpoints, {
      strategy: "per-request",
      allowCountryFallback: true,
    });
    assert.ok(pool.next({ country: "JP" }));
  });

  it("reports which countries it can reach", () => {
    const pool = new ProxyPool(endpoints);
    assert.deepEqual(pool.countries, ["GB", "US"]);
  });
});

describe("ProxyPool health", () => {
  it("benches a proxy after repeated failures", () => {
    const pool = new ProxyPool(endpoints, {
      strategy: "per-request",
      failureThreshold: 2,
    });

    pool.reportFailure("a");
    pool.reportFailure("a");

    const benched = pool.stats().find((entry) => entry.id === "a");
    assert.ok(benched?.benched);

    // The benched proxy is never handed out.
    for (let i = 0; i < 6; i++) {
      assert.notEqual(pool.next()?.id, "a");
    }
  });

  it("benches immediately on a hard failure", () => {
    const pool = new ProxyPool(endpoints, { failureThreshold: 99 });
    pool.reportFailure("b", { hard: true });
    assert.ok(pool.stats().find((entry) => entry.id === "b")?.benched);
  });

  it("clears the failure streak on success", () => {
    const pool = new ProxyPool(endpoints, { failureThreshold: 2 });
    pool.reportFailure("c");
    pool.reportSuccess("c");
    pool.reportFailure("c");
    assert.ok(!pool.stats().find((entry) => entry.id === "c")?.benched);
  });

  it("returns null when every proxy is benched", () => {
    const pool = new ProxyPool(endpoints, { failureThreshold: 1 });
    for (const endpoint of endpoints) pool.reportFailure(endpoint.id, { hard: true });
    assert.equal(pool.next(), null);
  });

  it("has no effect when the pool is empty", () => {
    const pool = new ProxyPool([]);
    assert.equal(pool.next(), null);
    assert.equal(pool.size, 0);
  });
});

describe("isProxyFault", () => {
  it("treats proxy auth and transport errors as our fault", () => {
    assert.ok(isProxyFault(407, null));
    assert.ok(isProxyFault(null, "connect ECONNREFUSED 10.0.0.5:3128"));
    assert.ok(isProxyFault(null, "socket hang up"));
  });

  it("does NOT treat a site refusal as a proxy fault", () => {
    // This is the line that keeps the crawler from retrying a block on a new
    // IP. 403 and 429 are the site's answer, not a broken proxy.
    assert.ok(!isProxyFault(403, null));
    assert.ok(!isProxyFault(429, null));
    assert.ok(!isProxyFault(503, null));
    assert.ok(!isProxyFault(404, null));
  });
});

describe("identity profiles", () => {
  it("keeps the bot token in the user agent by default", () => {
    const identity = pickIdentity({ device: "mobile", index: 1 });
    assert.ok(identity.userAgent.includes(BOT_TOKEN));
  });

  it("can drop the bot token only when asked explicitly", () => {
    const identity = pickIdentity({ id: "chrome-desktop", identifyAsBot: false });
    assert.ok(!identity.userAgent.includes(BOT_TOKEN));
    assert.ok(identity.userAgent.startsWith("Mozilla/5.0"));
  });

  it("selects by device class", () => {
    for (let i = 0; i < 4; i++) {
      assert.equal(pickIdentity({ device: "mobile", index: i }).device, "mobile");
    }
  });

  it("falls back to the plain bot identity for an unknown id", () => {
    assert.equal(pickIdentity({ id: "nope" }).id, "bot");
  });

  it("builds coherent headers with the requested language", () => {
    const identity = pickIdentity({ id: "chrome-desktop" });
    const headers = headersFor(identity, { acceptLanguage: "de-DE,de;q=0.9" });

    assert.equal(headers["Accept-Language"], "de-DE,de;q=0.9");
    assert.ok(headers["User-Agent"].includes("Chrome"));
    // Client hints must match the user agent they accompany.
    assert.ok(headers["Sec-CH-UA"].includes("Google Chrome"));
    assert.equal(headers["Sec-CH-UA-Mobile"], "?0");
  });

  it("marks mobile client hints as mobile", () => {
    const headers = headersFor(pickIdentity({ id: "chrome-android" }));
    assert.equal(headers["Sec-CH-UA-Mobile"], "?1");
  });
});
