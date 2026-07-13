$content = @"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/context";

export default function SignUpPage() {
  const { login, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      window.location.href = `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/registrations`;
    }
  }, [isLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div style={{ 
        padding: "24px", 
        fontSize: "16px",
        color: "#64748b" 
      }}>
        Redirecting to Keycloak registration...
      </div>
    </div>
  );
}
"@;

$filePath = "S:\BackEndSureLM\app\(auth)\sign-up\[[...sign-up]]\page.tsx";
Set-Content -Path $filePath -Value $content;
Write-Host "Updated sign-up page";
