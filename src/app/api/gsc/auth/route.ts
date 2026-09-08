import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.GSC_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      {
        error: "GSC_CLIENT_ID is not configured in .env.local",
        setupInstructions: "Add GSC_CLIENT_ID and GSC_CLIENT_SECRET to your .env.local file first.",
      },
      { status: 400 },
    );
  }

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/gsc/callback`;
  const scope = encodeURIComponent("https://www.googleapis.com/auth/webmasters.readonly");

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId,
  )}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

  return NextResponse.redirect(authUrl);
}
