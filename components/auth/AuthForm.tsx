"use client";

import { startLoginSplash } from "@/lib/splash";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cake, CheckCircle2, Eye, EyeOff, HeartPulse, KeyRound, Loader2, Lock, MessageSquareText, Phone, User } from "lucide-react";
import { errorText } from "@/lib/api";
import { completeSignUp, requestOtp, signIn, signInWithOtp, useSession, verifySignupOtp } from "@/lib/session";
import { site } from "@/lib/site";
import { googleConfig, requestPasswordReset, resetPasswordWithGoogle, type GoogleConfig } from "@/lib/google";
import GoogleButton from "@/components/auth/GoogleButton";
import { useT } from "@/lib/i18n";
import { dobKey, dobOk } from "@/lib/age";

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
  const [dob, setDob] = useState("");
  // emergency contact: who to call if the player is hurt at the venue (required to create an account)
  const [emName, setEmName] = useState("");
  const [emPhone, setEmPhone] = useState("");
  const [emRelation, setEmRelation] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // one-time codes: "Continue with OTP" on sign-in, and the new customer's 3 steps (details, code, password)
  const [via, setVia] = useState<"password" | "otp">("password");
  const [step, setStep] = useState<"details" | "code" | "password">("details");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0); // seconds until another code may be asked for
  const [signupToken, setSignupToken] = useState("");
  useEffect(() => {
    if (wait <= 0) return;
    const h = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(h);
  }, [wait]);
  // opening the app straight on the sign-in page (a bookmark, a restored tab, a cold start) goes to Home instead: Home has the Log in and
  // Create account buttons. Coming from inside the app (the Log in buttons, or a page that needs a sign-in, which add ?next= or ?mode=) stays here.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (!q.has("next") && !q.has("mode") && sessionStorage.getItem("uf-in-app") !== "1") window.location.replace("/");
    } catch { /* storage blocked: stay on the sign-in page */ }
  }, []);
  // /login?mode=up (the "Create account" button on Home) opens on the sign-up form
  useEffect(() => {
    const h = setTimeout(() => { if (new URLSearchParams(window.location.search).get("mode") === "up") setMode("up"); }, 0);
    return () => clearTimeout(h);
  }, []);

  useEffect(() => {
    if (mode !== "reset" || google) return;
    googleConfig().then(setGoogle).catch(() => setGoogle({ configured: false, clientId: null }));
  }, [mode, google]);

  const phoneOk = /^9\d{9}$/.test(phone);
  const phoneBad = phone.length > 0 && !phoneOk;
  const dobBad = dob.length > 0 && !dobOk(dob);
  const emPhoneOk = /^9\d{9}$/.test(emPhone) && emPhone !== phone;
  const emPhoneBad = emPhone.length === 10 && !emPhoneOk;
  const emOk = emName.trim().length >= 2 && emPhoneOk;
  const detailsOk = phoneOk && name.trim().length >= 2 && dobOk(dob) && emOk;
  const codeOk = /^d{6}$/.test(code);
  const ok =
    mode === "in" ? phoneOk && (via === "otp" ? (codeSent ? codeOk : true) : password.length >= 6)
    : step === "details" ? detailsOk
    : step === "code" ? codeOk
    : password.length >= 6;

  function go(m: "in" | "up" | "reset") {
    setMode(m);
    setError(null);
    setDone(null);
    setSent(false);
    setPassword("");
    setVia("password");
    setStep("details");
    setCodeSent(false);
    setCode("");
    setSignupToken("");
  }

  // texts a code: for sign-in ("continue with OTP") or for the new customer's number
  async function sendCode(purpose: "login" | "signup") {
    if (busy || wait > 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await requestOtp(phone, purpose);
      setCode("");
      setWait(r.resendInSeconds || 60);
      if (purpose === "login") setCodeSent(true);
      else setStep("code");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
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
    // the steps that only texts or checks a code
    if (mode === "in" && via === "otp" && !codeSent) return void sendCode("login");
    if (mode === "up" && step === "details") return void sendCode("signup");
    setBusy(true);
    setError(null);
    try {
      if (mode === "up" && step === "code") {
        setSignupToken(await verifySignupOtp(phone, code));
        setStep("password");
        setBusy(false);
        return;
      }
      if (mode === "in") await (via === "otp" ? signInWithOtp(phone, code) : signIn(phone, password));
      else await completeSignUp({ signupToken, name: name.trim(), password, dateOfBirth: dob, emergencyName: emName.trim(), emergencyPhone: emPhone, emergencyRelation: emRelation.trim() });
      startLoginSplash(); // the splash screen plays once on the next page, only after a sign-in
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
    mode === "in" ? (via === "otp" ? "We will text a 6-digit code to your mobile number." : "Book courts, Gamezone and EV charging, and see your points.")
    : mode === "up" ? (step === "details" ? "We will text a code to verify your number. Then you choose a password." : step === "code" ? "Enter the 6-digit code we texted you." : "Number verified. Choose a password to finish.")
    : "Enter the mobile number on your account.";

  return (
    <div className="mx-auto max-w-md rounded-[32px] bg-white px-5 pb-7 pt-8 shadow-[0_20px_50px_-24px_rgba(12,11,93,0.35)] ring-1 ring-slate-100 desk:px-8">
      {/* brand mark */}
      <div className="flex flex-col items-center gap-2">
        {/* the kicking player alone, in the brand navy, with no tile behind it */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="" aria-hidden className="h-16 w-auto" />
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
        {mode === "up" && step === "details" && (
          <div className={`${field} ring-transparent focus-within:ring-sky-300`}>
            <User size={18} className="shrink-0 text-slate-400" />
            <input style={noBorder} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Full name")} aria-label="Full name" autoComplete="name" />
          </div>
        )}

        {mode === "up" && step === "details" && (
          <div>
            <label className={`${field} ${dobBad ? "ring-2 ring-rose-400" : "ring-transparent focus-within:ring-sky-300"}`}>
              <Cake size={18} className={`shrink-0 ${dobBad ? "text-rose-400" : "text-slate-400"}`} />
              <span className="shrink-0 text-[15px] text-slate-400">{t("Date of birth")}</span>
              <input
                style={noBorder}
                className={`${inputCls} min-w-0 text-right`}
                type="date"
                value={dob}
                min={dobKey(100)}
                max={dobKey(5)}
                onChange={(e) => setDob(e.target.value)}
                aria-label="Date of birth"
                aria-invalid={dobBad}
                autoComplete="bday"
              />
            </label>
            {dobBad && <p className="mt-1.5 px-5 text-sm font-medium text-rose-500">{t("Enter a real date of birth")}</p>}
          </div>
        )}

        {mode === "up" && step !== "details" && (
          <p className="flex items-center justify-between gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
            <span className="flex items-center gap-2"><Phone size={16} className="text-slate-400" /> {phone}{step === "password" && <CheckCircle2 size={16} className="text-emerald-600" aria-label="Verified" />}</span>
            {step === "code" && <button type="button" onClick={() => { setStep("details"); setCode(""); setError(null); }} className="font-semibold text-[#0c0b5d]">Change</button>}
          </p>
        )}
        <div className={mode === "up" && step !== "details" ? "hidden" : ""}>
          <div className={`${field} ${phoneBad ? "ring-2 ring-rose-400" : "ring-transparent focus-within:ring-sky-300"}`}>
            <Phone size={18} className={`shrink-0 ${phoneBad ? "text-rose-400" : "text-slate-400"}`} />
            <input
              style={noBorder}
              className={inputCls}
              value={phone}
              inputMode="numeric"
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              disabled={mode === "in" && via === "otp" && codeSent}
              placeholder={t("Mobile number (98XXXXXXXX)")}
              aria-label="Mobile number"
              aria-invalid={phoneBad}
              autoComplete="tel"
            />
          </div>
          {phoneBad && <p className="mt-1.5 px-5 text-sm font-medium text-rose-500">{t("That mobile number doesn't look right")}</p>}
        </div>

        {mode === "up" && step === "details" && (
          <fieldset className="space-y-2.5 rounded-3xl bg-rose-50/70 p-3 ring-1 ring-rose-100">
            <legend className="sr-only">Emergency contact</legend>
            <p className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-800"><HeartPulse size={17} className="text-rose-500" aria-hidden /> {t("Emergency contact")}</p>
            <p className="px-1 text-xs text-slate-500">{t("Who should we call if you get hurt at the venue? Required.")}</p>
            <div className={`${field} bg-white ring-transparent focus-within:ring-sky-300`}>
              <User size={18} className="shrink-0 text-slate-400" />
              <input style={noBorder} className={inputCls} value={emName} onChange={(e) => setEmName(e.target.value)} maxLength={80} placeholder={t("Their name")} aria-label="Emergency contact name" autoComplete="off" />
            </div>
            <div>
              <div className={`${field} bg-white ${emPhoneBad ? "ring-2 ring-rose-400" : "ring-transparent focus-within:ring-sky-300"}`}>
                <Phone size={18} className={`shrink-0 ${emPhoneBad ? "text-rose-400" : "text-slate-400"}`} />
                <input style={noBorder} className={inputCls} value={emPhone} inputMode="numeric" onChange={(e) => setEmPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder={t("Their mobile number (98XXXXXXXX)")} aria-label="Emergency contact mobile number" aria-invalid={emPhoneBad} autoComplete="off" />
              </div>
              {emPhoneBad && <p className="mt-1.5 px-5 text-sm font-medium text-rose-500">{emPhone === phone ? t("Use someone else's number, not your own") : t("That mobile number doesn't look right")}</p>}
            </div>
            <div className={`${field} bg-white ring-transparent focus-within:ring-sky-300`}>
              <HeartPulse size={18} className="shrink-0 text-slate-400" />
              <input style={noBorder} className={inputCls} value={emRelation} onChange={(e) => setEmRelation(e.target.value)} maxLength={40} placeholder={t("Relation, e.g. Father (optional)")} aria-label="Relation to you" autoComplete="off" />
            </div>
          </fieldset>
        )}

        {((mode === "in" && via === "password") || (mode === "up" && step === "password")) && (
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

        {mode === "in" && via === "password" && (
          <div className="flex justify-end px-1">
            <button type="button" onClick={() => go("reset")} className="text-sm font-semibold text-[#0c0b5d]">{t("Forgot Password?")}</button>
          </div>
        )}

        {/* the one-time code: sign-in with OTP (after "Send code"), and the new customer's second step */}
        {((mode === "in" && via === "otp" && codeSent) || (mode === "up" && step === "code")) && (
          <div className="space-y-2">
            <div className={`${field} ring-transparent focus-within:ring-sky-300`}>
              <KeyRound size={18} className="shrink-0 text-slate-400" />
              <input style={noBorder} className={`${inputCls} tracking-[0.4em]`} value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
                onChange={(e) => setCode(e.target.value.replace(/D/g, "").slice(0, 6))} placeholder="6-digit code" aria-label="6-digit code" />
            </div>
            <p className="flex items-center justify-between px-1 text-xs text-slate-500">
              <span>We texted a code to {phone}.</span>
              <button type="button" disabled={wait > 0 || busy} onClick={() => sendCode(mode === "in" ? "login" : "signup")} className="font-semibold text-[#0c0b5d] disabled:text-slate-400">
                {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
              </button>
            </p>
          </div>
        )}

        {mode === "in" && (
          <button type="button" onClick={() => { setVia(via === "otp" ? "password" : "otp"); setCodeSent(false); setCode(""); setError(null); }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-[#0c0b5d] ring-1 ring-slate-200 transition hover:bg-slate-50">
            {via === "otp" ? <><Lock size={16} /> Use my password instead</> : <><MessageSquareText size={16} /> Continue with OTP</>}
          </button>
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
          <>
            <button type="submit" disabled={!ok || busy} className={primary}>
              {busy ? <><Loader2 size={18} className="animate-spin" /> Please wait…</>
                : mode === "in" ? (via === "otp" ? (codeSent ? t("Log In") : "Send code") : t("Log In"))
                : step === "details" ? "Send verification code" : step === "code" ? "Verify number" : t("Create account")}
            </button>
          </>
        )}
      </form>

      </div>

      {mode !== "in" && (
        <p className="mt-5 text-center text-sm text-slate-500">
          {t(mode === "up" ? "Already have an account?" : "Remembered it?")} <button type="button" onClick={() => go("in")} className="font-bold text-[#0c0b5d]">{t("Sign In")}</button>
        </p>
      )}

      <div className="mt-5 flex items-center gap-3 text-xs text-slate-400" aria-hidden>
        <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
      </div>
      <Link href="/book" className="mt-4 flex w-full items-center justify-center rounded-2xl py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
        {t("Continue as a guest")}
      </Link>
    </div>
  );
}
