/**
 * Security header analysis.
 *
 * This crawler costs nothing: the headers were already captured when the page
 * was fetched, so a full security read-out adds zero extra requests. Pure
 * function, so it is trivially testable.
 */

export type SecurityHeaderReport = {
  hsts: boolean;
  contentSecurityPolicy: boolean;
  xContentTypeOptions: boolean;
  xFrameOptions: boolean;
  referrerPolicy: boolean;
  permissionsPolicy: boolean;
  /** Headers present out of the six checked. */
  present: number;
  total: number;
  missing: string[];
};

const CHECKS: [key: keyof SecurityHeaderReport, header: string, label: string][] = [
  ["hsts", "strict-transport-security", "Strict-Transport-Security"],
  ["contentSecurityPolicy", "content-security-policy", "Content-Security-Policy"],
  ["xContentTypeOptions", "x-content-type-options", "X-Content-Type-Options"],
  ["xFrameOptions", "x-frame-options", "X-Frame-Options"],
  ["referrerPolicy", "referrer-policy", "Referrer-Policy"],
  ["permissionsPolicy", "permissions-policy", "Permissions-Policy"],
];

export function analyzeSecurityHeaders(
  headers: Record<string, string>,
): SecurityHeaderReport {
  const report: SecurityHeaderReport = {
    hsts: false,
    contentSecurityPolicy: false,
    xContentTypeOptions: false,
    xFrameOptions: false,
    referrerPolicy: false,
    permissionsPolicy: false,
    present: 0,
    total: CHECKS.length,
    missing: [],
  };

  for (const [key, header, label] of CHECKS) {
    const value = headers[header];
    const present = typeof value === "string" && value.trim().length > 0;

    // CSP can also arrive as a frame-ancestors directive that supersedes
    // X-Frame-Options, but presence is what this check reports.
    (report[key] as boolean) = present;

    if (present) report.present++;
    else report.missing.push(label);
  }

  return report;
}
