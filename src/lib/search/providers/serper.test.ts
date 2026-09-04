import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  InvalidCredentialsError,
  QuotaExhaustedError,
  RateLimitedError,
} from "../types";
import { classifySerperFailure, SerperProvider } from "./serper";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Stands in for the network so the provider can be tested without credits. */
function stubFetch(status: number, body: unknown) {
  globalThis.fetch = (async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
}

const options = { country: "US", device: "desktop" as const };

describe("classifySerperFailure", () => {
  it("treats 402 as an exhausted quota", () => {
    const error = classifySerperFailure(402, "Payment required");
    assert.ok(error instanceof QuotaExhaustedError);
    assert.match(error.message, /limit exhausted/i);
  });

  it("treats a credit-flavoured 403 as an exhausted quota", () => {
    assert.ok(
      classifySerperFailure(403, "Not enough credits") instanceof
        QuotaExhaustedError,
    );
  });

  it("treats a plain 403 as a bad key, not a quota problem", () => {
    const error = classifySerperFailure(403, "Forbidden");
    assert.ok(error instanceof InvalidCredentialsError);
  });

  it("treats 401 as a bad key", () => {
    assert.ok(
      classifySerperFailure(401, "Unauthorized") instanceof
        InvalidCredentialsError,
    );
  });

  it("separates a throttling 429 from an out-of-credit 429", () => {
    assert.ok(classifySerperFailure(429, "Too many requests") instanceof RateLimitedError);
    assert.ok(
      classifySerperFailure(429, "Monthly quota exceeded") instanceof
        QuotaExhaustedError,
    );
  });

  it("falls back to a plain error for anything else", () => {
    const error = classifySerperFailure(500, "boom");
    assert.equal(error.constructor.name, "Error");
    assert.match(error.message, /Serper returned 500/);
  });
});

describe("SerperProvider", () => {
  it("is not configured without a key", async () => {
    assert.equal(await new SerperProvider("").isConfigured(), false);
    assert.equal(await new SerperProvider("abc").isConfigured(), true);
  });

  it("declares that it cannot target a device", () => {
    assert.equal(new SerperProvider("abc").supportsDevice, false);
  });

  it("maps organic results into the shared shape", async () => {
    stubFetch(200, {
      organic: [
        { position: 1, link: "https://example.com/", title: "Example", snippet: "S" },
        { position: 2, link: "https://other.com/", title: "Other" },
      ],
      peopleAlsoAsk: [{}],
      searchInformation: { totalResults: 1234 },
    });

    const response = await new SerperProvider("k").search("widgets", options);

    assert.equal(response.source, "serper");
    assert.equal(response.keyword, "widgets");
    assert.equal(response.totalResults, 1234);
    assert.deepEqual(
      response.results.map((result) => [result.position, result.url]),
      [
        [1, "https://example.com/"],
        [2, "https://other.com/"],
      ],
    );
    assert.equal(response.results[1].description, null);
    assert.ok(response.features.includes("people_also_ask"));
  });

  it("drops results with no link rather than emitting a broken row", async () => {
    stubFetch(200, { organic: [{ position: 1, title: "No link" }] });
    const response = await new SerperProvider("k").search("q", options);
    assert.equal(response.results.length, 0);
  });

  it("falls back to array order when position is absent", async () => {
    stubFetch(200, {
      organic: [{ link: "https://a.com/" }, { link: "https://b.com/" }],
    });
    const response = await new SerperProvider("k").search("q", options);
    assert.deepEqual(
      response.results.map((result) => result.position),
      [1, 2],
    );
  });

  it("raises a quota error on 402 rather than returning an empty SERP", async () => {
    stubFetch(402, "Not enough credits");
    await assert.rejects(
      () => new SerperProvider("k").search("q", options),
      QuotaExhaustedError,
    );
  });

  it("raises a quota error when a 200 carries only a message", async () => {
    // Serper answers some plan errors with 200 and a bare message; treating
    // that as a successful empty result would record "not ranking" for every
    // keyword in the run.
    stubFetch(200, { message: "Your credit balance is exhausted" });
    await assert.rejects(
      () => new SerperProvider("k").search("q", options),
      QuotaExhaustedError,
    );
  });

  it("still succeeds when a message accompanies real results", async () => {
    stubFetch(200, {
      message: "informational",
      organic: [{ position: 1, link: "https://example.com/" }],
    });
    const response = await new SerperProvider("k").search("q", options);
    assert.equal(response.results.length, 1);
  });

  it("reports an empty SERP as zero results, not as an error", async () => {
    stubFetch(200, { organic: [] });
    const response = await new SerperProvider("k").search("q", options);
    assert.deepEqual(response.results, []);
  });
});
