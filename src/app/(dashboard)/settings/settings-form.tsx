"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Save, Sliders, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSettingAction, testPsiKeyAction } from "./actions";

export function SettingsForm({
  initialPsiKey,
  defaultDepth,
  defaultLimit,
  defaultConcurrency,
  defaultUserAgent,
}: {
  initialPsiKey: string;
  defaultDepth: string;
  defaultLimit: string;
  defaultConcurrency: string;
  defaultUserAgent: string;
}) {
  const [psiKey, setPsiKey] = useState(initialPsiKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [depth, setDepth] = useState(defaultDepth || "3");
  const [limit, setLimit] = useState(defaultLimit || "500");
  const [concurrency, setConcurrency] = useState(defaultConcurrency || "4");
  const [userAgent, setUserAgent] = useState(
    defaultUserAgent || "Mozilla/5.0 (compatible; AntigravitySEO/1.0)",
  );
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  async function handleTestPsi() {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testPsiKeyAction(psiKey);
      setTestResult(res);
    } catch (err) {
      console.error("❌ PSI test error:", err);
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSave() {
    setSaveStatus("Saving…");
    try {
      await Promise.all([
        saveSettingAction("psi_api_key", psiKey),
        saveSettingAction("default_crawl_depth", depth),
        saveSettingAction("default_crawl_limit", limit),
        saveSettingAction("default_crawl_concurrency", concurrency),
        saveSettingAction("default_user_agent", userAgent),
      ]);
      setSaveStatus("Settings saved successfully!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("❌ Failed to save settings:", err);
      setSaveStatus("Failed to save settings.");
    }
  }

  return (
    <div className="space-y-6">
      {/* PageSpeed API Key Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-accent" />
              Google PageSpeed Insights API
            </CardTitle>
            {psiKey ? (
              <Badge tone="success">Custom API Key</Badge>
            ) : (
              <Badge tone="outline">Free Anonymous Quota Tier</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Google PSI audits run out-of-the-box using the free anonymous quota.
            Adding a Google Cloud API key increases your daily rate limit.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="psi_key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="psi_key"
                type="password"
                value={psiKey}
                onChange={(e) => setPsiKey(e.target.value)}
                placeholder="AIzaSy…"
                className="max-w-md font-mono text-[13px]"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleTestPsi}
                disabled={isTesting}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                    Testing…
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
            </div>
          </div>

          {testResult ? (
            <div
              className={`flex items-center gap-2 text-[13px] rounded-lg p-3 ${
                testResult.success
                  ? "bg-success-subtle/30 text-success"
                  : "bg-critical-subtle/30 text-critical"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <XCircle className="size-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Default Crawler Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="size-4 text-accent" />
            Global Crawler Defaults
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="depth">Default Crawl Depth</Label>
              <Input
                id="depth"
                type="number"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="limit">Default Page Limit</Label>
              <Input
                id="limit"
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="concurrency">Concurrency (Workers)</Label>
              <Input
                id="concurrency"
                type="number"
                value={concurrency}
                onChange={(e) => setConcurrency(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="userAgent">Default User-Agent</Label>
            <Input
              id="userAgent"
              value={userAgent}
              onChange={(e) => setUserAgent(e.target.value)}
              className="font-mono text-[12px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {saveStatus ? (
            <span className="text-[13px] font-medium text-success">
              {saveStatus}
            </span>
          ) : null}
        </div>
        <Button variant="primary" onClick={handleSave}>
          <Save className="size-4" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
