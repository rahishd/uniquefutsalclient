// Face ID / fingerprint sign-in (WebAuthn passkeys). The phone's own lock screen does the checking; the server only keeps the
// public key (see backend/src/modules/auth/passkey.routes.ts). Needs a secure address (https, or localhost while developing).

import { startAuthentication, startRegistration, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";
import { api } from "@/lib/api";
import { applyLogin, type AuthResult } from "@/lib/session";

export interface PasskeyRow {
  id: string;
  credentialId: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/** True when this device can ask for Face ID, a fingerprint or the screen lock. */
export async function passkeySupported(): Promise<boolean> {
  try {
    return browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable());
  } catch {
    return false;
  }
}

// The word to show: Apple devices say Face ID, everything else a fingerprint or screen lock.
export function passkeyName(): string {
  if (typeof navigator === "undefined") return "Face ID";
  return /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) ? "Face ID" : "Face ID / fingerprint";
}

const deviceLabel = () => {
  if (typeof navigator === "undefined") return "This device";
  const ua = navigator.userAgent;
  const os = /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Android/i.test(ua) ? "Android phone" : /Windows/i.test(ua) ? "Windows PC" : /Macintosh/i.test(ua) ? "Mac" : "This device";
  return os;
};

/** Cancelling the Face ID prompt is not an error worth showing. */
export const passkeyCancelled = (e: unknown) => e instanceof Error && (e.name === "NotAllowedError" || e.name === "AbortError");

export const listPasskeys = () => api<PasskeyRow[]>("/auth/passkey");
export const removePasskey = (id: string) => api(`/auth/passkey/${id}`, { method: "DELETE" });

/** Turn Face ID on for this device (the customer is signed in). */
export async function enablePasskey() {
  const { options, challengeToken } = await api<{ options: PublicKeyCredentialCreationOptionsJSON; challengeToken: string }>("/auth/passkey/register/options", { method: "POST" });
  const response = await startRegistration(options);
  await api("/auth/passkey/register/verify", { method: "POST", body: { response, challengeToken, deviceName: deviceLabel() } });
}

/** Sign in with Face ID: the phone offers the account it holds a key for, so no number or password is typed. */
export async function signInWithPasskey() {
  const { options, challengeToken } = await api<{ options: PublicKeyCredentialRequestOptionsJSON; challengeToken: string }>("/auth/passkey/login/options", { method: "POST", auth: "none" });
  const response = await startAuthentication(options);
  const r = await api<AuthResult>("/auth/passkey/login/verify", { method: "POST", body: { response, challengeToken }, auth: "none" });
  applyLogin(r);
}
