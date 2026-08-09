"use client";

import { useState, useEffect } from "react";
import Keycloak from "keycloak-js";

export default function SignInPage() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const keycloak = new Keycloak({
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || "https://localhost:18443/auth",
      realm: process.env.KEYCLOAK_REALM || "surelm_realm",
      clientId: process.env.KEYCLOAK_CLIENT_ID || "web-app",
    });

    keycloak
      .init({ onLoad: "login-required" })
      .then((authenticated) => {
        if (authenticated) {
          window.location.href = "/dashboard";
        }
        setInitialized(true);
      })
      .catch((err) => {
        console.error("[SignIn] Initialization failed:", err);
        setError("Failed to initialize authentication. Please try again.");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        {error ? (
          <>
            <h2 className="text-xl font-bold text-red-600 mb-4">Authentication Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </>
        ) : (
          <>
            {initialized ? (
              <div className="animate-pulse">Redirecting to authentication...</div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-600">Initializing authentication...</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}