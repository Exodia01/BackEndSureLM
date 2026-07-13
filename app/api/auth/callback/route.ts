import { NextRequest, NextResponse } from "next/server";
import { KEYCLOAK_URL, REALM, CLIENT_ID } from "@/lib/auth/auth-config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: "Authorization code required" }, { status: 400 });
    }

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code: code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/callback`,
    });

    const response = await fetch(
      `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.error_description || "Token exchange failed" }, { status: 400 });
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: "Authentication successful",
    });
  } catch (error) {
    console.error("Keycloak token exchange error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
