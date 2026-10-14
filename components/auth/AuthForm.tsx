"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, Phone, User } from "lucide-react";
import { errorText } from "@/lib/api";
import { signIn, signUp, useSession } from "@/lib/session";
import { site } from "@/lib/site";
import { googleConfig, requestPasswordReset, resetPasswordWithGoogle, type GoogleConfig } from "@/lib/google";
import GoogleButton from "@/components/auth/GoogleButton";
import KidSkills from "@/components/KidSkills";
import { useT } from "@/lib/i18n";

// A pill-shaped field with its icon on the left; a bad value turns the ring red and shows the message under it.
const field = "flex items-center gap-3 rounded-full bg-white/80 px-5 py-4 shadow-sm ring-1 transition focus-within:ring-2";
const inputCls = "w-full bg-transparent text-[15px] font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400";

// Only same-site paths are accepted as the page to return to.
function nextPath() {
  const n = new URLSearchParams(window.location.search).get("next") ?? "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function AuthForm() {
  const session = useSession();
  const t = useT();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [google, setGoogle] = useState<GoogleConfig | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (mode !== "reset" || google) return;
    googleConfig().then(setGoogle).catch(() => setGoogle({ configured: false, clientId: null }));
  }, [mode, google]);

  const phoneOk = /^9\d{9}$/.test(phone);
  const phoneBad = phone.length > 0 && !phoneOk;
  const ok = phoneOk && password.length >= 6 && (mode === "in" || name.trim().length >= 2);

  function go(m: "in" | "up" | "reset") {
    setMode(m);
    setError(null);
    setDone(null);
    setSent(false);
    setPassword("");
  }

  async function resetGoogle(idToken: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await resetPasswordWithGoogle({ phoneNumber: phone, idToken, newPassword: password });
      go("in");
      setDone("Your password was changed. You can sign in now.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function askVenue() {
    if (busy || !phoneOk) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(phone);
      setSent(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "reset" || !ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "in") await signIn(phone, password);
      else await signUp({ name: name.trim(), phone, password });
      window.location.assign(nextPath());
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  if (session?.registered) {
    return (
      <div className="glass space-y-4 rounded-3xl p-6 text-center">
        <p className="text-lg font-medium">You&apos;re signed in as {session.name}</p>
        <Link href="/" className="glass-btn block rounded-full py-3.5 text-sm font-semibold text-white">Go to Home</Link>
      </div>
    );
  }

  const title = t(mode === "in" ? "Welcome Back" : mode === "up" ? "Create your account" : "Reset your password");
  const sub =
    mode === "in" ? t("Sign in to book your next game.") : mode === "up" ? "Book faster, earn points and play with your team." : "We'll ask the venue to set a new password for you.";
  const primary =
    "flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0c0b5d] to-[#3f3fd1] py-4 text-base font-semibold text-white shadow-[0_12px_28px_-10px_rgba(12,11,93,0.7)] transition disabled:opacity-50";

  return (
    <div className="space-y-6 desk:mx-auto desk:max-w-md">
      {/* brand banner */}
      <div className="relative min-h-[170px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0c0b5d] via-[#1a1a8f] to-[#3f3fd1] p-6 text-white shadow-[0_18px_40px_-18px_rgba(12,11,93,0.8)]">
        <div className="relative z-10 max-w-[58%]">
          <p className="text-3xl font-extrabold leading-none tracking-tight">Unique<span className="text-white">.</span></p>
          <p className="mt-0.5 text-3xl font-extrabold leading-none tracking-tight text-white">Futsal</p>
          <p className="mt-3 text-sm text-white/85">Book your court,<br />right from your phone.</p>
          <span className="mt-3 inline-block rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0c0b5d]">Live slots · Instant booking</span>
        </div>
        <KidSkills className="pointer-events-none absolute -bottom-2 right-2 h-[175px] w-auto" />
      </div>

      <header className="text-center">
        <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{sub}</p>
      </header>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === "up" && (
          <div className={`${field} ring-white/80 focus-within:ring-brand`}>
            <User size={18} className="shrink-0 text-slate-400" />
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Full name")} aria-label="Full name" autoComplete="name" />
          </div>
        )}

        <div>
          <div className={`${field} ${phoneBad ? "ring-2 ring-rose-400" : "ring-white/80 focus-within:ring-brand"}`}>
            <Phone size={18} className={`shrink-0 ${phoneBad ? "text-rose-400" : "text-slate-400"}`} />
            <input
              className={inputCls}
              value={phone}
              inputMode="numeric"
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder={t("Mobile number (98XXXXXXXX)")}
              aria-label="Mobile number"
              aria-invalid={phoneBad}
              autoComplete="tel"
            />
          </div>
          {phoneBad && <p className="mt-1.5 px-5 text-sm font-medium text-rose-500">{t("That mobile number doesn't look right")}</p>}
        </div>

        {mode !== "reset" && (
          <div className={`${field} ring-white/80 focus-within:ring-brand`}>
            <Lock size={18} className="shrink-0 text-slate-400" />
            <input
              className={inputCls}
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "up" ? "Choose a password (6+ characters)" : t("Password")}
              aria-label="Password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
            />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="shrink-0 p-1 text-slate-400">
              {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        )}

        {mode === "in" && (
          <div className="flex justify-end px-1">
            <button type="button" onClick={() => go("reset")} className="text-sm font-semibold text-accent">{t("Forgot Password?")}</button>
          </div>
        )}

        {done && mode === "in" && <p role="status" className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{done}</p>}
        {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}

        {mode === "reset" ? (
          <div className="space-y-4">
            {sent ? (
              <div role="status" className="space-y-1 rounded-3xl bg-emerald-500/10 px-5 py-4 text-sm text-emerald-800">
                <p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} /> Request sent</p>
                <p>
                  If that number has an account, the venue has been told. They will call you and set a new password, then you can sign in. Need it sooner? Call{" "}
                  <a href={`tel:${site.phone}`} className="font-semibold underline">{site.phone}</a>.
                </p>
              </div>
            ) : (
              <button type="button" onClick={askVenue} disabled={!phoneOk || busy} className={primary}>
                {busy ? <><Loader2 size={18} className="animate-spin" /> Please wait…</> : t("Ask the venue to reset it")}
              </button>
            )}

            {google?.configured && google.clientId && (
              <div className="space-y-3 rounded-3xl bg-white/60 p-4">
                <p className="text-center text-xs font-medium text-slate-500">Or reset instantly with the Google account linked in Profile</p>
                <div className={`${field} ring-white/80 focus-within:ring-brand`}>
                  <Lock size={18} className="shrink-0 text-slate-400" />
                  <input className={inputCls} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (6+ characters)" aria-label="New password" autoComplete="new-password" />
                </div>
                {phoneOk && password.length >= 6 ? (
                  <GoogleButton clientId={google.clientId} onToken={resetGoogle} />
                ) : (
                  <p className="text-center text-xs text-slate-500">Enter your mobile number and a new password, then continue with Google.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <button type="submit" disabled={!ok || busy} className={primary}>
            {busy ? <><Loader2 size={18} className="animate-spin" /> Please wait…</> : mode === "in" ? t("Log In") : t("Create account")}
          </button>
        )}
      </form>

      <div className="flex items-center gap-3 text-xs text-slate-400" aria-hidden>
        <span className="h-px flex-1 bg-slate-300/70" /> or <span className="h-px flex-1 bg-slate-300/70" />
      </div>
      <Link href="/book" className="flex w-full items-center justify-center rounded-full bg-white/80 py-3.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-white">
        {t("Continue as a guest")}
      </Link>

      <p className="text-center text-sm text-slate-500">
        {mode === "in" ? (
          <>{t("Don't have an account?")} <button type="button" onClick={() => go("up")} className="font-bold text-accent">{t("Sign Up")}</button></>
        ) : (
          <>{t(mode === "up" ? "Already have an account?" : "Remembered it?")} <button type="button" onClick={() => go("in")} className="font-bold text-accent">{t("Sign In")}</button></>
        )}
      </p>
    </div>
  );
}
