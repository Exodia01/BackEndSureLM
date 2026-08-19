import { NextRequest, NextResponse } from "next/server";
import { validateAuth } from "@/lib/auth/keycloak";

export const runtime = "nodejs";

const PROTECTED_ROUTES = ["/dashboard", "/policies", "/crm"];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isProtectedRoute(pathname)) {
    const { valid } = await validateAuth(req);

    if (!valid) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/policies/:path*",
    "/crm/:path*",
    "/api/:path*",
  ],
};