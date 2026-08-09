import { NextRequest, NextResponse } from "next/server";
import { KeycloakSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await KeycloakSession.get();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(session.user);
}