export interface KeycloakUser {
  id: string;
  keycloakId: string;
  email: string;
  name?: string;
  avatar?: string;
  role: Role;
}

export type Role = "AGENT" | "ADMIN";

export interface AuthState {
  user: KeycloakUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface PKCECodes {
  codeVerifier: string;
  codeChallenge: string;
}
