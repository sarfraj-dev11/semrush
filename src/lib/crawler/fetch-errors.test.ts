import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeFetchError } from "./fetcher";

/** Mirrors how undici reports transport failures: a bare message plus a cause. */
function fetchFailure(code: string): Error {
  const error = new Error("fetch failed");
  (error as Error & { cause?: unknown }).cause = { code };
  return error;
}

describe("describeFetchError", () => {
  it("explains a certificate that cannot be verified", () => {
    const message = describeFetchError(
      fetchFailure("UNABLE_TO_VERIFY_LEAF_SIGNATURE"),
    );
    assert.match(message, /certificate could not be verified/i);
    assert.match(message, /UNABLE_TO_VERIFY_LEAF_SIGNATURE/);
    // The bare undici message is what this exists to replace.
    assert.doesNotMatch(message, /^fetch failed$/);
  });

  it("distinguishes the failures that need different fixes", () => {
    assert.match(describeFetchError(fetchFailure("ENOTFOUND")), /does not resolve/i);
    assert.match(describeFetchError(fetchFailure("ECONNREFUSED")), /refused/i);
    assert.match(describeFetchError(fetchFailure("CERT_HAS_EXPIRED")), /expired/i);
    assert.match(
      describeFetchError(fetchFailure("ERR_TLS_CERT_ALTNAME_INVALID")),
      /hostname/i,
    );
  });

  it("names a corporate proxy as a likely cause of an untrusted issuer", () => {
    assert.match(
      describeFetchError(fetchFailure("UNABLE_TO_GET_ISSUER_CERT_LOCALLY")),
      /proxy/i,
    );
  });

  it("keeps an unknown code visible rather than swallowing it", () => {
    const message = describeFetchError(fetchFailure("ESOMETHINGNEW"));
    assert.match(message, /ESOMETHINGNEW/);
  });

  it("reports a timeout with its duration", () => {
    const timeout = new Error("The operation was aborted");
    timeout.name = "TimeoutError";
    assert.equal(describeFetchError(timeout, 20_000), "Timed out after 20s");
  });

  it("handles an abort the same way as a timeout", () => {
    const aborted = new Error("aborted");
    aborted.name = "AbortError";
    assert.match(describeFetchError(aborted, 5_000), /Timed out after 5s/);
  });

  it("falls back to the message when there is no cause", () => {
    assert.equal(describeFetchError(new Error("boom")), "boom");
  });

  it("appends a cause message when there is no code", () => {
    const error = new Error("fetch failed");
    (error as Error & { cause?: unknown }).cause = { message: "socket hang up" };
    assert.equal(describeFetchError(error), "fetch failed: socket hang up");
  });

  it("stringifies a non-Error rather than throwing", () => {
    assert.equal(describeFetchError("plain string"), "plain string");
  });
});
