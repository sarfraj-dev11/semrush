import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accessibilityIssues,
  summarizeAccessibility,
} from "./accessibility";
import { consoleIssues, summarizeConsole } from "./console-checker";
import type { AxeViolation, ConsoleEntry, FailedRequest } from "./renderer";

const PAGE = "https://example.com/page";

const violation = (overrides: Partial<AxeViolation> = {}): AxeViolation => ({
  id: "image-alt",
  impact: "critical",
  help: "Images must have alternate text",
  helpUrl: "https://dequeuniversity.com/rules/axe/image-alt",
  nodes: ["img.hero"],
  ...overrides,
});

describe("summarizeConsole", () => {
  const entry = (text: string, level: ConsoleEntry["level"] = "error") => ({
    level,
    text,
  });

  it("counts errors separately from warnings", () => {
    const summary = summarizeConsole(
      [entry("Boom"), entry("Careful", "warning")],
      [],
      PAGE,
    );
    assert.equal(summary.errorCount, 1);
    assert.equal(summary.warningCount, 1);
  });

  it("deduplicates identical error text", () => {
    const summary = summarizeConsole([entry("Boom"), entry("Boom")], [], PAGE);
    assert.equal(summary.errorCount, 2);
    assert.deepEqual(summary.uniqueErrors, ["Boom"]);
  });

  it("drops extension and ad-blocker noise", () => {
    const summary = summarizeConsole(
      [
        entry("net::ERR_BLOCKED_BY_CLIENT"),
        entry("chrome-extension://abc failed"),
      ],
      [],
      PAGE,
    );
    assert.equal(summary.errorCount, 0);
  });

  it("separates first-party failures from third-party ones", () => {
    const failures: FailedRequest[] = [
      { url: "https://example.com/app.js", status: 404, reason: null },
      { url: "https://cdn.other.com/x.js", status: 500, reason: null },
    ];
    const summary = summarizeConsole([], failures, PAGE);

    assert.equal(summary.firstPartyFailures.length, 1);
    assert.equal(summary.thirdPartyFailures.length, 1);
  });

  it("treats www and bare host as the same site", () => {
    const summary = summarizeConsole(
      [],
      [{ url: "https://www.example.com/a.js", status: 404, reason: null }],
      PAGE,
    );
    assert.equal(summary.firstPartyFailures.length, 1);
  });
});

describe("consoleIssues", () => {
  it("is silent on a clean page", () => {
    assert.deepEqual(consoleIssues(summarizeConsole([], [], PAGE)), []);
  });

  it("raises one issue per class of problem", () => {
    const codes = consoleIssues(
      summarizeConsole(
        [{ level: "error", text: "Boom" }],
        [
          { url: "https://example.com/a.js", status: 404, reason: null },
          { url: "https://cdn.other.com/b.js", status: 404, reason: null },
        ],
        PAGE,
      ),
    ).map((issue) => issue.code);

    assert.deepEqual(codes, [
      "js_error",
      "failed_subresource",
      "failed_third_party_resource",
    ]);
  });

  it("quotes the single error verbatim and summarises several", () => {
    const one = consoleIssues(
      summarizeConsole([{ level: "error", text: "Boom" }], [], PAGE),
    );
    assert.equal(one[0].detail, "Boom");

    const many = consoleIssues(
      summarizeConsole(
        [
          { level: "error", text: "Boom" },
          { level: "error", text: "Bang" },
        ],
        [],
        PAGE,
      ),
    );
    assert.match(many[0].detail!, /2 distinct errors/);
  });
});

describe("summarizeAccessibility", () => {
  it("groups violations by impact", () => {
    const summary = summarizeAccessibility([
      violation(),
      violation({ id: "link-name", impact: "serious" }),
      violation({ id: "region", impact: "moderate" }),
    ]);

    assert.equal(summary.critical.length, 1);
    assert.equal(summary.serious.length, 1);
    assert.equal(summary.moderate.length, 1);
    assert.equal(summary.ruleCount, 3);
    assert.equal(summary.nodeCount, 3);
  });

  it("treats an unrated violation as minor rather than dropping it", () => {
    const summary = summarizeAccessibility([violation({ impact: null })]);
    assert.equal(summary.minor.length, 1);
  });

  it("counts distinct rules, not occurrences", () => {
    const summary = summarizeAccessibility([
      violation({ nodes: ["a", "b"] }),
      violation({ nodes: ["c"] }),
    ]);
    assert.equal(summary.ruleCount, 1);
    assert.equal(summary.nodeCount, 3);
  });
});

describe("accessibilityIssues", () => {
  it("is silent when axe found nothing", () => {
    assert.deepEqual(accessibilityIssues(summarizeAccessibility([])), []);
  });

  it("raises one issue per severity band, folding minor and moderate", () => {
    const codes = accessibilityIssues(
      summarizeAccessibility([
        violation(),
        violation({ id: "link-name", impact: "serious" }),
        violation({ id: "region", impact: "moderate" }),
        violation({ id: "landmark", impact: "minor" }),
      ]),
    ).map((issue) => issue.code);

    assert.deepEqual(codes, ["a11y_critical", "a11y_serious", "a11y_minor"]);
  });

  it("names the rules and truncates a long list", () => {
    const issues = accessibilityIssues(
      summarizeAccessibility(
        ["a", "b", "c", "d", "e"].map((id) => violation({ id })),
      ),
    );
    assert.match(issues[0].detail!, /a, b, c \+2 more/);
  });
});
