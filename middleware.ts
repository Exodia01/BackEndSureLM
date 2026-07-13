import { keycloakAuthMiddleware } from "@/lib/auth/middleware";

export default keycloakAuthMiddleware;

export const config = {
  matcher: ["/dashboard/:path*", "/crm/:path*"],
};
