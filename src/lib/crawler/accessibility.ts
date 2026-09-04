import type { AxeViolation } from "./renderer";
import type { DetectedIssue } from "./types";

/**
 * Accessibility.
 *
 * Runs axe-core against the rendered DOM. This sits in an SEO tool for a
 * practical reason rather than a principled one: a large share of what axe
 * reports — missing alt text, unlabelled links, broken heading order, poor
 * contrast on link text — is the same markup quality that determines whether a
 * crawler can understand the page. The overlap is not total, and the parts that
 * do not overlap are worth fixing anyway.
 *
 * Pure: axe already did the analysis in the browser; this maps its output onto
 * the issue catalog. Violations are grouped by impact rather than one issue per
 * rule, because axe ships hundreds of rules and a catalog entry per rule would
 * drown every other finding in the audit.
 */

export type AccessibilitySummary = {
  critical: AxeViolation[];
  serious: AxeViolation[];
  moderate: AxeViolation[];
  minor: AxeViolation[];
  /** Distinct rules violated, across all impacts. */
  ruleCount: number;
  /** Elements implicated, across all impacts. */
  nodeCount: number;
};

export function summarizeAccessibility(
  violations: AxeViolation[],
): AccessibilitySummary {
  const summary: AccessibilitySummary = {
    critical: [],
    serious: [],
    moderate: [],
    minor: [],
    ruleCount: 0,
    nodeCount: 0,
  };

  for (const violation of violations) {
    // axe leaves impact null when it cannot judge severity; treating that as
    // "minor" keeps it visible without overstating it.
    const impact = violation.impact ?? "minor";
    summary[impact].push(violation);
    summary.nodeCount += violation.nodes.length;
  }

  summary.ruleCount = new Set(violations.map((v) => v.id)).size;
  return summary;
}

function describe(violations: AxeViolation[]): string {
  const rules = violations.map((violation) => violation.id);
  const nodes = violations.reduce(
    (total, violation) => total + violation.nodes.length,
    0,
  );
  const shown = rules.slice(0, 3).join(", ");
  const extra = rules.length > 3 ? ` +${rules.length - 3} more` : "";
  return `${nodes} element${nodes === 1 ? "" : "s"}: ${shown}${extra}`;
}

export function accessibilityIssues(
  summary: AccessibilitySummary,
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  if (summary.critical.length > 0) {
    issues.push({ code: "a11y_critical", detail: describe(summary.critical) });
  }
  if (summary.serious.length > 0) {
    issues.push({ code: "a11y_serious", detail: describe(summary.serious) });
  }
  if (summary.moderate.length > 0 || summary.minor.length > 0) {
    issues.push({
      code: "a11y_minor",
      detail: describe([...summary.moderate, ...summary.minor]),
    });
  }

  return issues;
}
