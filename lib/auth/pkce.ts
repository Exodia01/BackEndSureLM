export async function generatePKCECodes(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
  let verifier = "";
  const array = new Uint8Array(128);
  
  // Use browser crypto if available, otherwise fallback
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    // Node.js fallback - won't be used in client-side code
    require("crypto").randomFillSync(array);
  }
  
  for (let i = 0; i < 128; i++) {
    verifier += chars[array[i] % chars.length];
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  let challenge = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { codeVerifier: verifier, codeChallenge: challenge };
}
