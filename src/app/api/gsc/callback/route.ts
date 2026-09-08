import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    console.error("❌ [GSC OAuth] Google authorization returned error:", error);
    return new NextResponse(
      `<html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2>❌ Google Authorization Failed</h2>
        <p>${error}</p>
        <a href="/">Return to Dashboard</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  if (!code) {
    return new NextResponse(
      `<html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2>❌ Missing authorization code</h2>
        <a href="/">Return to Dashboard</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  let clientId = process.env.GSC_CLIENT_ID;
  let clientSecret = process.env.GSC_CLIENT_SECRET;

  try {
    const envPath = resolve(process.cwd(), ".env.local");
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf8");
      const idMatch = content.match(/GSC_CLIENT_ID=["']?([^"'\r\n]+)["']?/);
      const secretMatch = content.match(/GSC_CLIENT_SECRET=["']?([^"'\r\n]+)["']?/);
      if (idMatch && idMatch[1]) clientId = idMatch[1].trim();
      if (secretMatch && secretMatch[1]) clientSecret = secretMatch[1].trim();
    }
  } catch (err) {
    console.warn("⚠️ [GSC OAuth] Error reading .env.local dynamically:", err);
  }

  if (!clientId || !clientSecret) {
    return new NextResponse(
      `<html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2>❌ GSC_CLIENT_ID or GSC_CLIENT_SECRET not configured</h2>
        <p>Please configure them in your .env.local file first.</p>
        <a href="/">Return to Dashboard</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  const redirectUri = `${request.nextUrl.origin}/api/gsc/callback`;

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const payload = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!tokenResponse.ok || !payload.refresh_token) {
      const errDetail = payload.error_description || payload.error || "No refresh token returned";
      console.error("❌ [GSC OAuth] Token exchange error:", errDetail);
      return new NextResponse(
        `<html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h2>❌ Google Token Exchange Failed</h2>
          <p>${errDetail}</p>
          <p style="color: #666; font-size: 13px;">Make sure "access_type=offline" and "prompt=consent" were requested.</p>
          <a href="/api/gsc/auth">Retry Authorization</a>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } },
      );
    }

    const refreshToken = payload.refresh_token;

    // Automatically append or update GSC_REFRESH_TOKEN in .env.local if present
    try {
      const envPath = resolve(process.cwd(), ".env.local");
      if (existsSync(envPath)) {
        let content = readFileSync(envPath, "utf8");
        if (content.includes("GSC_REFRESH_TOKEN=")) {
          content = content.replace(/GSC_REFRESH_TOKEN=.*$/m, `GSC_REFRESH_TOKEN=${refreshToken}`);
        } else {
          content += `\nGSC_REFRESH_TOKEN=${refreshToken}\n`;
        }
        writeFileSync(envPath, content, "utf8");
      }
      process.env.GSC_REFRESH_TOKEN = refreshToken;
    } catch (saveErr) {
      console.warn("⚠️ [GSC OAuth] Could not auto-write to .env.local:", saveErr);
    }

    return new NextResponse(
      `<html>
        <body style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 60px auto; padding: 30px; background: #09090b; color: #f4f4f5; border-radius: 12px; border: 1px solid #27272a; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 12px;">🎉</div>
          <h2 style="margin: 0 0 10px; font-size: 22px; color: #10b981;">Google Search Console Connected!</h2>
          <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 24px;">Your refresh token was successfully generated and saved to your environment.</p>
          <div style="background: #18181b; padding: 14px; border-radius: 8px; font-family: monospace; font-size: 12px; word-break: break-all; color: #38bdf8; margin-bottom: 24px; text-align: left;">
            GSC_REFRESH_TOKEN=${refreshToken}
          </div>
          <a href="/" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Return to Dashboard</a>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  } catch (err: any) {
    console.error("❌ [GSC OAuth] Unexpected callback error:", err);
    return new NextResponse(
      `<html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2>❌ Authorization Error</h2>
        <p>${err?.message}</p>
        <a href="/">Return to Dashboard</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }
}
