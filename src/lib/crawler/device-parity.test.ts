import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diffRenditions,
  parityIssueCode,
  type Rendition,
} from "./device-parity";

const base: Rendition = {
  statusCode: 200,
  finalUrl: "https://example.com/page",
  title: "A page",
  canonical: "https://example.com/page",
  metaRobots: null,
  isNoindex: false,
  wordCount: 800,
  internalLinkCount: 40,
  error: null,
};

const rendition = (overrides: Partial<Rendition> = {}): Rendition => ({
  ...base,
  ...overrides,
});

const fields = (desktop: Rendition, mobile: Rendition) =>
  diffRenditions(desktop, mobile).map((difference) => difference.field);

describe("diffRenditions", () => {
  it("reports nothing when the two renditions match", () => {
    assert.deepEqual(fields(rendition(), rendition()), []);
  });

  it("says nothing when either fetch failed", () => {
    assert.deepEqual(
      fields(rendition({ error: "Timed out" }), rendition({ title: "Other" })),
      [],
    );
  });

  it("stops at a status difference, since content cannot be compared", () => {
    assert.deepEqual(
      fields(
        rendition(),
        rendition({ statusCode: 404, title: "Not found", wordCount: 5 }),
      ),
      ["status"],
    );
  });

  it("flags a device-specific redirect", () => {
    assert.ok(
      fields(
        rendition(),
        rendition({ finalUrl: "https://m.example.com/page" }),
      ).includes("redirect"),
    );
  });

  it("flags a canonical that differs between devices", () => {
    assert.ok(
      fields(
        rendition(),
        rendition({ canonical: "https://m.example.com/page" }),
      ).includes("canonical"),
    );
  });

  it("flags a noindex present on only one rendition", () => {
    assert.ok(
      fields(
        rendition(),
        rendition({ isNoindex: true, metaRobots: "noindex" }),
      ).includes("robots"),
    );
  });

  it("compares indexability by directive, not by raw string", () => {
    // Both index; only the wording differs, which changes nothing.
    assert.ok(
      !fields(
        rendition({ metaRobots: "index, follow" }),
        rendition({ metaRobots: "all" }),
      ).includes("robots"),
    );
  });

  it("flags a content gap past the threshold but not below it", () => {
    assert.ok(
      fields(rendition(), rendition({ wordCount: 400 })).includes("content"),
    );
    assert.ok(
      !fields(rendition(), rendition({ wordCount: 780 })).includes("content"),
    );
  });

  it("flags a missing-link gap past the threshold", () => {
    assert.ok(
      fields(rendition(), rendition({ internalLinkCount: 10 })).includes("links"),
    );
    assert.ok(
      !fields(rendition(), rendition({ internalLinkCount: 36 })).includes("links"),
    );
  });

  it("treats a zero/zero comparison as no gap rather than dividing by zero", () => {
    assert.deepEqual(
      fields(
        rendition({ wordCount: 0, internalLinkCount: 0 }),
        rendition({ wordCount: 0, internalLinkCount: 0 }),
      ),
      [],
    );
  });

  it("reports several independent differences at once", () => {
    const found = fields(
      rendition(),
      rendition({
        title: "Mobile title",
        canonical: "https://m.example.com/page",
        wordCount: 100,
      }),
    );
    assert.ok(found.includes("canonical"));
    assert.ok(found.includes("title"));
    assert.ok(found.includes("content"));
  });

  it("maps every field onto a catalog code", () => {
    for (const field of [
      "status",
      "redirect",
      "canonical",
      "robots",
      "title",
      "content",
      "links",
    ] as const) {
      assert.match(parityIssueCode(field), /^parity_/);
    }
  });
});
