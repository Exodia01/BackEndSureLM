import { NextRequest, NextResponse } from "next/server";

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

export async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.KEYCLOAK_URL || "http://localhost:8443/auth"}/realms/${
        process.env.KEYCLOAK_REALM || "surelm_realm"
      }/protocol/openid-connect/userinfo`,
      {
        headers: { Authorization: `Bearer ${token}` },
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    return response.ok;
  } catch (error) {
    console.error("Keycloak token validation error:", error);
    return false;
  }
}

export async function keycloakAuth(req: NextRequest) {
  const token = localStorage.getItem("keycloak_access_token");

  if (!token || !(await validateToken(token))) {
    localStorage.removeItem("keycloak_access_token");
    localStorage.removeItem("keycloak_refresh_token");
    return { authenticated: false } as const;
  }

  try {
    const response = await fetch(
      `${process.env.KEYCLOAK_URL || "http://localhost:8443/auth"}/realms/${
        process.env.KEYCLOAK_REALM || "surelm_realm"
      }/protocol/openid-connect/userinfo`,
      {
        headers: { Authorization: `Bearer ${token}` },
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      localStorage.removeItem("keycloak_access_token");
      localStorage.removeItem("keycloak_refresh_token");
      return { authenticated: false } as const;
    }

    const data = await response.json();

    return {
      authenticated: true,
      keycloakId: data.sub,
      email: data.email,
      name: data.name,
      role: (data.role as import("./types").Role) || "AGENT",
    } as const;
  } catch (error) {
    console.error("Keycloak userinfo error:", error);
    localStorage.removeItem("keycloak_access_token");
    localStorage.removeItem("keycloak_refresh_token");
    return { authenticated: false } as const;
  }
}

export async function keycloakAuthMiddleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  if (isProtectedRoute(path)) {
    const token = localStorage.getItem("keycloak_access_token");

    if (!token || !(await validateToken(token))) {
      url.pathname = "/sign-in";
      return NextResponse.redirect(url);
    }

    const response = await fetch(
      `${process.env.KEYCLOAK_URL || "http://localhost:8443/auth"}/realms/${
        process.env.KEYCLOAK_REALM || "surelm_realm"
      }/protocol/openid-connect/userinfo`,
      {
        headers: { Authorization: `Bearer ${token}` },
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      url.pathname = "/sign-in";
      return NextResponse.redirect(url);
    }

    const data = await response.json();

    req.headers.set("X-Keycloak-User-Id", data.sub || "");
    req.headers.set("X-Keycloak-Email", data.email || "");

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
