import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  diffRenderGap,
  renderGapIssueCode,
  type RawSnapshot,
} from "./render-gap";

const raw: RawSnapshot = {
  pageId: 1,
  url: "https://example.com/page",
  title: "A page",
  wordCount: 800,
  internalLinkCount: 40,
  h1Count: 1,
  structuredDataTypes: ["Article"],
};

const rendered = (overrides: Partial<Omit<RawSnapshot, "pageId" | "url">> = {}) => ({
  title: raw.title,
  wordCount: raw.wordCount,
  internalLinkCount: raw.internalLinkCount,
  h1Count: raw.h1Count,
  structuredDataTypes: raw.structuredDataTypes,
  ...overrides,
});

const fields = (
  snapshot: RawSnapshot,
  after: ReturnType<typeof rendered>,
) => diffRenderGap(snapshot, after).map((difference) => difference.field);

describe("diffRenderGap", () => {
  it("reports nothing when rendering changes nothing", () => {
    assert.deepEqual(fields(raw, rendered()), []);
  });

  it("flags content that only exists after JavaScript", () => {
    assert.ok(fields(raw, rendered({ wordCount: 2000 })).includes("content"));
  });

  it("ignores content the renderer removed", () => {
    // Raw has more than rendered — a script stripped a banner. Not a crawler
    // visibility problem, so the comparison stays one-directional.
    assert.ok(!fields(raw, rendered({ wordCount: 200 })).includes("content"));
  });

  it("flags links injected by JavaScript", () => {
    assert.ok(
      fields(raw, rendered({ internalLinkCount: 120 })).includes("links"),
    );
  });

  it("flags a title rewritten during rendering", () => {
    assert.ok(fields(raw, rendered({ title: "Rewritten" })).includes("title"));
  });

  it("flags an H1 that only appears after rendering", () => {
    assert.ok(
      fields({ ...raw, h1Count: 0 }, rendered({ h1Count: 1 })).includes(
        "headings",
      ),
    );
  });

  it("does not flag headings when raw already had one", () => {
    assert.ok(!fields(raw, rendered({ h1Count: 2 })).includes("headings"));
  });

  it("flags structured data types absent from the raw HTML", () => {
    const differences = diffRenderGap(
      raw,
      rendered({ structuredDataTypes: ["Article", "FAQPage"] }),
    );
    const structured = differences.find(
      (difference) => difference.field === "structured_data",
    );
    assert.ok(structured);
    assert.equal(structured.rendered, "FAQPage");
  });

  it("does not flag structured data that was already in the raw HTML", () => {
    assert.ok(
      !fields(raw, rendered({ structuredDataTypes: ["Article"] })).includes(
        "structured_data",
      ),
    );
  });

  it("handles an empty rendered page without dividing by zero", () => {
    assert.doesNotThrow(() =>
      diffRenderGap(
        { ...raw, wordCount: 0, internalLinkCount: 0 },
        rendered({ wordCount: 0, internalLinkCount: 0 }),
      ),
    );
  });

  it("maps every field onto a catalog code", () => {
    for (const field of [
      "content",
      "links",
      "title",
      "headings",
      "structured_data",
    ] as const) {
      assert.match(renderGapIssueCode(field), /^render_gap_/);
    }
  });
});
