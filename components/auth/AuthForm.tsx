"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, Phone, User } from "lucide-react";
import { errorText } from "@/lib/api";
import { signIn, signUp, useSession } from "@/lib/session";
import { site } from "@/lib/site";
import { googleConfig, requestPasswordReset, resetPasswordWithGoogle, type GoogleConfig } from "@/lib/google";
import GoogleButton from "@/components/auth/GoogleButton";
import { useT } from "@/lib/i18n";

// A soft grey field with its icon on the left; focus shows a blue ring, a bad value turns it red with the message under it.
const field = "flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3.5 ring-1 transition focus-within:bg-white focus-within:ring-2";
const inputCls = "w-full bg-transparent text-[15px] font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400";
const noBorder = { border: "none" }; // the site-wide input border is not wanted inside these boxes

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
      <div className="mx-auto max-w-md space-y-4 rounded-[32px] bg-white p-6 text-center shadow-[0_20px_50px_-24px_rgba(12,11,93,0.35)] ring-1 ring-slate-100">
        <p className="text-lg font-medium">You&apos;re signed in as {session.name}</p>
        <Link href="/" className="glass-btn block rounded-full py-3.5 text-sm font-semibold text-white">Go to Home</Link>
      </div>
    );
  }

  const title = t(mode === "in" ? "Welcome Back" : mode === "up" ? "Create your account" : "Reset your password");
  const sub =
    mode === "in" ? t("Sign in to book your next game.") : mode === "up" ? "Book faster, earn points and play with your team." : "We'll ask the venue to set a new password for you.";
  const primary =
    "flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0c0b5d] py-4 text-base font-semibold text-white shadow-[0_12px_24px_-12px_rgba(12,11,93,0.8)] transition active:scale-[0.99] disabled:opacity-40";
  const formTitle = mode === "in" ? t("Sign in to continue") : mode === "up" ? t("Your details") : t("Your mobile number");
  const formSub =
    mode === "in" ? "Book courts, Gamezone and EV charging, and see your points." : mode === "up" ? "It takes a minute. You can book straight away." : "Enter the mobile number on your account.";

  return (
    <div className="mx-auto max-w-md rounded-[32px] bg-white px-5 pb-7 pt-8 shadow-[0_20px_50px_-24px_rgba(12,11,93,0.35)] ring-1 ring-slate-100 desk:px-8">
      {/* brand mark */}
      <div className="flex flex-col items-center gap-2">
        <span
          aria-hidden
          className="h-12 w-12 rounded-2xl bg-[#0c0b5d] bg-no-repeat shadow-md"
          style={{ backgroundImage: "url(/logo.jpg)", backgroundSize: "82px 82px", backgroundPosition: "-15px -5px", backgroundBlendMode: "lighten" }}
        />
        <span className="text-[11px] font-bold tracking-[0.3em] text-slate-500">UNIQUE FUTSAL</span>
      </div>

      <header className="mt-6 text-center">
        <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{sub}</p>
      </header>

      {/* Sign In / Create Account switch (the reset screen has its own way back, below) */}
      {mode !== "reset" && (
        <div role="tablist" aria-label="Sign in or create an account" className="mt-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
          {(["in", "up"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => mode !== m && go(m)}
              className={`rounded-xl py-2.5 text-sm font-semibold transition ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              {m === "in" ? t("Sign In") : t("Create Account")}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-base font-bold text-slate-900">{formTitle}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{formSub}</p>
      </div>

      <div className="mt-4">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === "up" && (
          <div className={`${field} ring-transparent focus-within:ring-sky-300`}>
            <User size={18} className="shrink-0 text-slate-400" />
            <input style={noBorder} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Full name")} aria-label="Full name" autoComplete="name" />
          </div>
        )}

        <div>
          <div className={`${field} ${phoneBad ? "ring-2 ring-rose-400" : "ring-transparent focus-within:ring-sky-300"}`}>
            <Phone size={18} className={`shrink-0 ${phoneBad ? "text-rose-400" : "text-slate-400"}`} />
            <input
              style={noBorder}
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
          <div className={`${field} ring-transparent focus-within:ring-sky-300`}>
            <Lock size={18} className="shrink-0 text-slate-400" />
            <input
              style={noBorder}
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
            <button type="button" onClick={() => go("reset")} className="text-sm font-semibold text-[#0c0b5d]">{t("Forgot Password?")}</button>
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
                <div className={`${field} ring-transparent focus-within:ring-sky-300`}>
                  <Lock size={18} className="shrink-0 text-slate-400" />
                  <input style={noBorder} className={inputCls} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (6+ characters)" aria-label="New password" autoComplete="new-password" />
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

      </div>

      <p className="mt-5 text-center text-sm text-slate-500">
        {mode === "in" ? (
          <>{t("No account yet?")} <button type="button" onClick={() => go("up")} className="font-bold text-[#0c0b5d]">{t("Create one")}</button></>
        ) : (
          <>{t(mode === "up" ? "Already have an account?" : "Remembered it?")} <button type="button" onClick={() => go("in")} className="font-bold text-[#0c0b5d]">{t("Sign In")}</button></>
        )}
      </p>

      <div className="mt-5 flex items-center gap-3 text-xs text-slate-400" aria-hidden>
        <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
      </div>
      <Link href="/book" className="mt-4 flex w-full items-center justify-center rounded-2xl py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
        {t("Continue as a guest")}
      </Link>
    </div>
  );
}
