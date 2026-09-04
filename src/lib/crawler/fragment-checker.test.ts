import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkFragments } from "./fragment-checker";

const PAGE = "https://example.com/docs";

const pages = [{ pageId: 2, url: PAGE, elementIds: ["install", "usage"] }];

describe("checkFragments", () => {
  it("passes a fragment that matches an id", () => {
    const result = checkFragments(pages, [
      { fromPageId: 1, toUrl: PAGE, fragment: "install" },
    ]);

    assert.equal(result.checked, 1);
    assert.equal(result.broken, 0);
    assert.equal(result.brokenByPage.size, 0);
  });

  it("flags a fragment with no matching id, blaming the linking page", () => {
    const result = checkFragments(pages, [
      { fromPageId: 1, toUrl: PAGE, fragment: "missing" },
    ]);

    assert.equal(result.broken, 1);
    assert.deepEqual(result.brokenByPage.get(1), [`${PAGE}#missing`]);
  });

  it("ignores fragments the browser handles itself", () => {
    const result = checkFragments(pages, [
      { fromPageId: 1, toUrl: PAGE, fragment: "top" },
      { fromPageId: 1, toUrl: PAGE, fragment: "" },
    ]);

    assert.equal(result.checked, 0);
    assert.equal(result.broken, 0);
  });

  it("says nothing about pages the crawl never read", () => {
    const result = checkFragments(pages, [
      {
        fromPageId: 1,
        toUrl: "https://example.com/never-crawled",
        fragment: "anything",
      },
    ]);

    assert.equal(result.checked, 0);
    assert.equal(result.broken, 0);
    assert.equal(result.unresolved, 1);
  });

  it("matches a percent-encoded href against a decoded id", () => {
    const result = checkFragments(
      [{ pageId: 2, url: PAGE, elementIds: ["ünïcode"] }],
      [{ fromPageId: 1, toUrl: PAGE, fragment: "%C3%BCn%C3%AFcode" }],
    );

    assert.equal(result.broken, 0);
  });

  it("survives a malformed escape sequence", () => {
    const result = checkFragments(pages, [
      { fromPageId: 1, toUrl: PAGE, fragment: "%E0%A4%A" },
    ]);

    assert.equal(result.checked, 1);
    assert.equal(result.broken, 1);
  });

  it("does not list the same broken target twice for one page", () => {
    const result = checkFragments(pages, [
      { fromPageId: 1, toUrl: PAGE, fragment: "missing" },
      { fromPageId: 1, toUrl: PAGE, fragment: "missing" },
    ]);

    assert.deepEqual(result.brokenByPage.get(1), [`${PAGE}#missing`]);
  });

  it("accepts a legacy name attribute as a target", () => {
    const result = checkFragments(
      [{ pageId: 2, url: PAGE, elementIds: ["legacy-anchor"] }],
      [{ fromPageId: 1, toUrl: PAGE, fragment: "legacy-anchor" }],
    );

    assert.equal(result.broken, 0);
  });
});
