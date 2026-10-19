"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { markPasswordSet, signOut, useSession } from "@/lib/session";

// A friend who was registered through Refer & Earn signs in with the shared first password. Right after that, this pop-up
// asks for their own password. It cannot be closed until a new one is saved (the old one was seen by the person who shared it).
export default function ForcePasswordChange() {
  const session = useSession();
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session?.registered || !session.mustChange) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 6) return setError("Use at least 6 characters.");
    if (pw !== again) return setError("The two passwords do not match.");
    setBusy(true);
    try {
      await api("/auth/set-new-password", { method: "PATCH", body: { newPassword: pw } });
      markPasswordSet();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm text-[#0c0b5d] outline-none ring-1 ring-slate-200 focus:ring-brand";
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="newpw-title" className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0c0b5d]/60 p-4 backdrop-blur-sm sm:items-center">
      <form onSubmit={save} className="w-full max-w-sm rounded-3xl bg-white p-6 text-[#0c0b5d] shadow-2xl">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#dcebff]"><KeyRound size={24} /></span>
        <h2 id="newpw-title" className="mt-4 text-xl font-semibold">Set your own password</h2>
        <p className="mt-1 text-sm text-slate-500">Welcome to Unique Futsal! You signed in with the password your friend shared. Choose a new one that only you know.</p>
        <label className="mt-4 block text-xs font-medium text-slate-500">New password
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className={field} />
        </label>
        <label className="mt-3 block text-xs font-medium text-slate-500">Type it again
          <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" className={field} />
        </label>
        {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
        <button type="submit" disabled={busy || pw.length === 0} className="glass-btn mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Save new password"}
        </button>
        <button type="button" onClick={() => signOut()} className="mt-3 w-full text-center text-xs text-slate-400">Sign out</button>
      </form>
    </div>
  );
}
