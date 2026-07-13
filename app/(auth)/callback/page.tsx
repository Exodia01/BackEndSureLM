"use client";

import { useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/context";

export default function CallbackPage() {
  const { isLoading } = useAuth();

  const handleCallback = useCallback(async () => {
    try {
      if (!isLoading) {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        
        if (code) {
          const response = await fetch("/api/auth/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });

          if (response.ok) {
            window.location.href = "/dashboard";
          } else {
            console.error("Code exchange failed");
            localStorage.removeItem("keycloak_access_token");
            localStorage.removeItem("keycloak_refresh_token");
            window.location.href = "/sign-in";
          }
        }
      }
    } catch (error) {
      console.error("Callback handling error:", error);
      localStorage.removeItem("keycloak_access_token");
      localStorage.removeItem("keycloak_refresh_token");
      window.location.href = "/sign-in";
    }
  }, [isLoading]);

  useEffect(() => {
    handleCallback();
  }, [handleCallback]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div style={{ 
        padding: "24px", 
        fontSize: "16px",
        color: "#64748b" 
      }}>
        Logging in...
      </div>
    </div>
  );
}
