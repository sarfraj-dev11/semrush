import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accessibilityIssues, summarizeAccessibility } from "./accessibility";
import { analyzeCacheHeaders, cacheIssues } from "./cache-headers";
import { consoleIssues, summarizeConsole } from "./console-checker";
import { parityIssueCode, type ParityField } from "./device-parity";
import {
  ISSUE_BY_CODE,
  ISSUE_CATALOG,
  THEMATIC_ISSUE_CODES,
} from "./issue-catalog";
import { renderGapIssueCode, type RenderGapField } from "./render-gap";

/**
 * The runner writes issue codes as strings and the UI joins on them, so a code
 * a bot can emit that the catalog does not define renders as a blank row.
 * Nothing else in the type system catches that, which is why it is a test.
 */
describe("issue catalog integrity", () => {
  it("has no duplicate codes", () => {
    const codes = ISSUE_CATALOG.map((issue) => issue.code);
    assert.equal(new Set(codes).size, codes.length);
  });

  it("gives every issue a description and a fix", () => {
    for (const issue of ISSUE_CATALOG) {
      assert.ok(issue.description.length > 0, `${issue.code} has no description`);
      assert.ok(issue.howToFix.length > 0, `${issue.code} has no fix`);
      assert.ok(issue.label.length > 0, `${issue.code} has no label`);
      assert.ok(issue.category.length > 0, `${issue.code} has no category`);
    }
  });

  it("defines every device-parity code", () => {
    const fields: ParityField[] = [
      "status",
      "redirect",
      "canonical",
      "robots",
      "title",
      "content",
      "links",
    ];
    for (const field of fields) {
      const code = parityIssueCode(field);
      assert.ok(ISSUE_BY_CODE.has(code), `catalog is missing ${code}`);
    }
  });

  it("defines every render-gap code", () => {
    const fields: RenderGapField[] = [
      "content",
      "links",
      "title",
      "headings",
      "structured_data",
    ];
    for (const field of fields) {
      const code = renderGapIssueCode(field);
      assert.ok(ISSUE_BY_CODE.has(code), `catalog is missing ${code}`);
    }
  });

  it("defines every code the cache analyzer can raise", () => {
    const samples: Record<string, string>[] = [
      {},
      { "cache-control": "no-store" },
      { "cache-control": "public, max-age=60" },
      { vary: "User-Agent" },
    ];

    for (const headers of samples) {
      for (const issue of cacheIssues(analyzeCacheHeaders(headers))) {
        assert.ok(
          ISSUE_BY_CODE.has(issue.code),
          `catalog is missing ${issue.code}`,
        );
      }
    }
  });

  it("defines every code the console checker can raise", () => {
    const issues = consoleIssues(
      summarizeConsole(
        [{ level: "error", text: "Boom" }],
        [
          { url: "https://example.com/a.js", status: 404, reason: null },
          { url: "https://cdn.other.com/b.js", status: 404, reason: null },
        ],
        "https://example.com/page",
      ),
    );

    assert.equal(issues.length, 3);
    for (const issue of issues) {
      assert.ok(ISSUE_BY_CODE.has(issue.code), `catalog is missing ${issue.code}`);
    }
  });

  it("defines every code the accessibility bot can raise", () => {
    const issues = accessibilityIssues(
      summarizeAccessibility([
        {
          id: "image-alt",
          impact: "critical",
          help: "",
          helpUrl: "",
          nodes: ["img"],
        },
        {
          id: "link-name",
          impact: "serious",
          help: "",
          helpUrl: "",
          nodes: ["a"],
        },
        {
          id: "region",
          impact: "moderate",
          help: "",
          helpUrl: "",
          nodes: ["div"],
        },
      ]),
    );

    assert.equal(issues.length, 3);
    for (const issue of issues) {
      assert.ok(ISSUE_BY_CODE.has(issue.code), `catalog is missing ${issue.code}`);
    }
  });

  it("defines the fragment and JS-only codes the runner writes directly", () => {
    for (const code of ["broken_fragment_link", "js_only_page"]) {
      assert.ok(ISSUE_BY_CODE.has(code), `catalog is missing ${code}`);
    }
  });
});

/**
 * Themes are a reporting view, not an exhaustive taxonomy — plenty of codes
 * deliberately belong to none and show only in the severity list. What must
 * hold is the other direction: a theme cannot reference a code that does not
 * exist, or the report silently renders one row short.
 */
describe("thematic reports", () => {
  it("references only codes the catalog defines", () => {
    for (const [theme, codes] of Object.entries(THEMATIC_ISSUE_CODES)) {
      for (const code of codes) {
        assert.ok(
          ISSUE_BY_CODE.has(code),
          `theme "${theme}" references unknown code "${code}"`,
        );
      }
    }
  });

  it("lists no code twice within one theme", () => {
    for (const [theme, codes] of Object.entries(THEMATIC_ISSUE_CODES)) {
      assert.equal(
        new Set(codes).size,
        codes.length,
        `theme "${theme}" repeats a code`,
      );
    }
  });

  it("gives the newer bots a home", () => {
    const themed = new Set(Object.values(THEMATIC_ISSUE_CODES).flat());
    const shouldBeThemed = [
      "parity_canonical",
      "parity_robots",
      "render_gap_content",
      "js_only_page",
      "a11y_critical",
      "js_error",
      "failed_subresource",
      "broken_fragment_link",
      "no_cache_policy",
      "vary_user_agent",
    ];

    for (const code of shouldBeThemed) {
      assert.ok(themed.has(code), `${code} appears in no thematic report`);
    }
  });
});
