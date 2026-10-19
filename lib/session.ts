// Who is using the app: a signed-in customer or a guest, from the real backend login
// (phone + password; there is no OTP/SMS step for now).
//
// The token is kept in this browser (lib/auth-token.ts). The server decides who a token belongs to
// (GET /auth/me); the browser never decides identity or rights.

import { useSyncExternalStore } from "react";
import { api, ApiError } from "@/lib/api";
import { getTokens, setTokens, subscribeTokens } from "@/lib/auth-token";

export type Session =
  | { registered: true; id: string; name: string; phone: string; avatar?: string | null; logins?: number; emergency?: boolean; mustChange?: boolean }
  | { registered: false };

const USER_KEY = "uf-user-v1"; // last known account, so the screen does not flash while /auth/me loads
const listeners = new Set<() => void>();
const GUEST: Session = { registered: false };

let cached: Session | undefined; // undefined = still loading
let cachedFor: string | null = null; // which token `cached` belongs to
let verifying: string | null = null;

interface ApiUser {
  id: string;
  name: string;
  phoneNumber: string;
  role: string;
  avatar?: string | null;
  loginCount?: number;
  hasEmergencyContact?: boolean;
  mustChangePassword?: boolean; // a friend's first sign-in with the shared password: a new one is owed
}

const toSession = (u: ApiUser): Session => ({ registered: true, id: u.phoneNumber, name: u.name || "Player", phone: u.phoneNumber, avatar: u.avatar ?? null, logins: u.loginCount, emergency: u.hasEmergencyContact, mustChange: Boolean(u.mustChangePassword) });

function emit() {
  listeners.forEach((l) => l());
}

function readCachedUser(): Session | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveUser(s: Session | null) {
  try {
    if (s) localStorage.setItem(USER_KEY, JSON.stringify(s));
    else localStorage.removeItem(USER_KEY);
  } catch {
    // storage blocked
  }
}

// Ask the server who this token is (and whether it is still valid).
function verify(token: string) {
  if (verifying === token) return;
  verifying = token;
  api<ApiUser>("/auth/me")
    .then((u) => {
      if (getTokens()?.token !== token) return;
      cached = toSession(u);
      cachedFor = token;
      saveUser(cached);
      emit();
    })
    .catch((e) => {
      if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
        setTokens(null);
      }
    })
    .finally(() => {
      verifying = null;
    });
}

function read(): Session | undefined {
  const t = getTokens();
  if (!t) {
    cached = GUEST;
    cachedFor = null;
    return GUEST;
  }
  if (cachedFor === t.token && cached) return cached;
  const known = readCachedUser();
  verify(t.token);
  if (known && known.registered) {
    cached = known;
    cachedFor = t.token;
    return cached;
  }
  return undefined; // signed in, but we do not know who yet
}

// Tokens changed (sign in / out / refresh): recompute.
subscribeTokens(() => {
  const t = getTokens();
  if (!t) {
    cached = GUEST;
    cachedFor = null;
    saveUser(null);
  } else if (cachedFor && cachedFor !== t.token) {
    // a refreshed token for the same person: keep who they are
    cachedFor = t.token;
  }
  emit();
});

export interface AuthResult {
  token: string;
  refreshToken: string;
  user: ApiUser;
}

export async function signIn(phone: string, password: string) {
  applyLogin(await api<AuthResult>("/auth/login", { method: "POST", body: { identifier: phone, password }, auth: "none" }));
}

/** The friend has replaced the shared first password: stop asking. */
export function markPasswordSet() {
  if (cached && cached.registered) {
    cached = { ...cached, mustChange: false };
    saveUser(cached);
    emit();
  }
}

/** Keeps a finished sign-in (password or Face ID): who they are, and the tokens. */
export function applyLogin(r: AuthResult) {
  cached = toSession(r.user);
  saveUser(cached);
  setTokens({ token: r.token, refreshToken: r.refreshToken });
  cachedFor = r.token;
  emit();
}

export async function signUp(input: { name: string; phone: string; password: string; dateOfBirth: string; emergencyName: string; emergencyPhone: string; emergencyRelation?: string }) {
  const r = await api<AuthResult>("/auth/signup", {
    method: "POST",
    body: { name: input.name, phoneNumber: input.phone, password: input.password, dateOfBirth: input.dateOfBirth, emergencyName: input.emergencyName, emergencyPhone: input.emergencyPhone, emergencyRelation: input.emergencyRelation || undefined },
    auth: "none",
  });
  cached = { ...toSession(r.user), registered: true, emergency: true } as Session;
  saveUser(cached);
  setTokens({ token: r.token, refreshToken: r.refreshToken });
  cachedFor = r.token;
  emit();
}

// After the customer edits their name, show the new name straight away.
export function updateSessionName(name: string) {
  if (cached && cached.registered) {
    cached = { ...cached, name };
    saveUser(cached);
    emit();
  }
}

// After the customer saves an emergency contact, stop the reminder straight away.
export function markEmergencySaved() {
  if (cached && cached.registered) {
    cached = { ...cached, emergency: true };
    saveUser(cached);
    emit();
  }
}

export function updateSessionAvatar(avatar: string | null) {
  if (cached && cached.registered) {
    cached = { ...cached, avatar };
    saveUser(cached);
    emit();
  }
}

export function signOut() {
  setTokens(null);
  saveUser(null);
  cached = GUEST;
  cachedFor = null;
  emit();
}

// Opens the sign-in page and comes back to this page afterwards.
export function openSignIn() {
  const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
  // a full page load on purpose: every cached screen starts fresh for the next sign-in
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// undefined while the page is still loading on the client (avoids flashing the wrong screen).
export function useSession(): Session | undefined {
  return useSyncExternalStore<Session | undefined>(subscribe, read, () => undefined);
}
