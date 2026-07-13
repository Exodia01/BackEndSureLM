"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/context";

export default function SignInSection() {
  const { login, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      login();
    }
  }, [login, isLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div style={{ 
        padding: "24px", 
        fontSize: "16px",
        color: "#64748b" 
      }}>
        Redirecting to Keycloak...
      </div>
    </div>
  );
}
