"use client";

import Keycloak from "keycloak-js";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface KeycloakContextType {
  keycloak: any;
  initialized: boolean;
  login: () => void;
  logout: () => void;
}

const KeycloakContext = createContext<KeycloakContextType | undefined>(undefined);

export function KeycloakProvider({ children }: { children: ReactNode }) {
  const [keycloak, setKeycloak] = useState<any>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initKeycloak = async () => {
      const keycloakInstance = new Keycloak({
        url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || "https://localhost:18443/auth",
        realm: process.env.KEYCLOAK_REALM || "surelm_realm",
        clientId: process.env.KEYCLOAK_CLIENT_ID || "web-app",
      });

      try {
        const authenticated = await keycloakInstance.init({
          onLoad: "login-required",
          checkLoginIframe: false,
        });

        setKeycloak(keycloakInstance);
        setInitialized(true);

        if (authenticated) {
          console.log("[Keycloak] Authenticated");
        }
      } catch (error) {
        console.error("[Keycloak] Initialization failed:", error);
      }
    };

    initKeycloak();
  }, []);

  const login = () => {
    keycloak?.login();
  };

  const logout = () => {
    keycloak?.logout();
  };

  return (
    <KeycloakContext.Provider value={{ keycloak, initialized, login, logout }}>
      {children}
    </KeycloakContext.Provider>
  );
}

export function useKeycloak() {
  const context = useContext(KeycloakContext);
  if (context === undefined) {
    throw new Error("useKeycloak must be used within a KeycloakProvider");
  }
  return context;
}
