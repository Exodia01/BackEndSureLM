import { NextRequest, NextResponse } from "next/server";
import { validateRequest as jwtValidateRequest } from "./jwt";

export const validateRequest = jwtValidateRequest;

export const isProtectedRoute = (path: string): boolean => {
  return (
    path.startsWith("/dashboard")
    || path.startsWith("/crm")
    || path.startsWith("/leads")
    || path.startsWith("/documents")
    || path.startsWith("/api/leads")
    || path.startsWith("/api/documents")
    || path.startsWith("/api/brochures")
    || path.startsWith("/api/checklist")
    || path.startsWith("/api/orchestrate")
  );
};

export async function keycloakAuthMiddleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  if (isProtectedRoute(path)) {
    const { authenticated, user } = await validateRequest(req);

    if (!authenticated || !user) {
      url.pathname = "/sign-in";
      return NextResponse.redirect(url);
    }

    req.headers.set("X-Keycloak-User-Id", user.keycloakId);
    req.headers.set("X-Keycloak-Email", user.email);

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/crm/:path*",
    "/leads/:path*",
    "/documents/:path*",
    "/api/leads/:path*",
    "/api/documents/:path*",
    "/api/brochures/:path*",
    "/api/checklist/:path*",
    "/api/orchestrate/:path*",
  ],
};
