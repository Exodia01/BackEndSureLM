"use client";

import { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { generatePKCECodes } from "./utils/pkce";

export interface KeycloakUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role: "AGENT" | "ADMIN";
}

export interface AuthContextType {
  user: KeycloakUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  error: string | null;
}

const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || process.env.KEYCLOAK_URL;
const REALM = process.env.KEYCLOAK_REALM || "surelm_realm";
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "web-app";
const REDIRECT_URI = process.env.KEYCLOAK_REDIRECT_URI || "http://localhost:3000/callback";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeToken(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

function isTokenExpired(exp?: number): boolean {
  if (!exp) return true;
  return Date.now() >= exp * 1000;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<KeycloakUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const token = localStorage.getItem("keycloak_access_token");
      if (token) {
        const payload = decodeToken(token);
        if (payload && !isTokenExpired(payload.exp)) {
          setUser({
            id: payload.sub,
            email: payload.email || "",
            name: payload.name || payload.preferred_username || "",
            avatar: payload.picture,
            role: (payload.role as "AGENT" | "ADMIN") || "AGENT",
          });
        } else {
          localStorage.removeItem("keycloak_access_token");
        }
      }
    } catch (error) {
      console.error("Session check failed:", error);
      setError("Failed to load user session");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshToken(): Promise<boolean> {
    const currentToken = localStorage.getItem("keycloak_access_token");
    if (!currentToken) return false;

    const token = decodeToken(currentToken);
    if (token?.refresh_expires_in && !isTokenExpired(token.exp)) {
      return true;
    }

    const refreshToken = localStorage.getItem("keycloak_refresh_token");
    if (!refreshToken) {
      localStorage.removeItem("keycloak_access_token");
      setUser(null);
      return false;
    }

    try {
      const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || process.env.KEYCLOAK_URL;
      const REALM = process.env.KEYCLOAK_REALM || "surelm_realm";
      const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "web-app";
      
      const response = await fetch(KEYCLOAK_URL + "/realms/" + REALM + "/protocol/openid-connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: CLIENT_ID,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) throw new Error("Token refresh failed");

      const data = await response.json();
      
      setUser((prevUser) => {
        if (data.access_token && prevUser) {
          const payload = decodeToken(data.access_token);
          if (payload) {
            return {
              id: payload.sub,
              email: payload.email || "",
              name: payload.name || payload.preferred_username || "",
              avatar: payload.picture,
              role: (payload.role as "AGENT" | "ADMIN") || "AGENT",
            };
          }
        }
        return prevUser;
      });

      localStorage.setItem("keycloak_access_token", data.access_token);
      if (data.refresh_token) {
        localStorage.setItem("keycloak_refresh_token", data.refresh_token);
      }
      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      localStorage.removeItem("keycloak_access_token");
      localStorage.removeItem("keycloak_refresh_token");
      setUser(null);
      setError("Session expired. Please login again.");
      return false;
    }
  }

  async function logout(): Promise<void> {
    const currentToken = localStorage.getItem("keycloak_access_token");
    
    if (currentToken) {
    try {
      const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || process.env.KEYCLOAK_URL;
      const REALM = process.env.KEYCLOAK_REALM || "surelm_realm";
      const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "web-app";
        
        await fetch(KEYCLOAK_URL + "/realms/" + REALM + "/protocol/openid-connect/logout", {
          method: "POST",
          headers: { 
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            refresh_token: localStorage.getItem("keycloak_refresh_token") || "",
          }),
        });
      } catch (error) {
        console.error("Keycloak logout error:", error);
      }
    }

    localStorage.removeItem("keycloak_access_token");
    localStorage.removeItem("keycloak_refresh_token");
    setUser(null);
    setError(null);
  }

async function login(): Promise<void> {
  const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || process.env.KEYCLOAK_URL;
  const REALM = process.env.KEYCLOAK_REALM || "surelm_realm";
  const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "web-app";
  const REDIRECT_URI = process.env.KEYCLOAK_REDIRECT_URI || "http://localhost:3000/callback";

  const domain = typeof window !== "undefined" 
    ? (process.env.COOKIE_DOMAIN || new URL(window.location.href).hostname)
    : "localhost";

  const { codeVerifier, codeChallenge, state } = await generatePKCECodes();

  const expires = new Date(Date.now() + 5 * 60 * 1000);
  document.cookie = `pkce_state=${state}; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax;_DOMAIN=${domain}`;
  document.cookie = `pkce_verifier=${codeVerifier}; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax;_DOMAIN=${domain}`;

  const authUrl = KEYCLOAK_URL + "/realms/" + REALM + "/protocol/openid-connect/auth";

  window.location.href = `${authUrl}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=openid%20email%20profile&code_challenge=${codeChallenge}&code_challenge_method=S256`;
}

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshToken,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
