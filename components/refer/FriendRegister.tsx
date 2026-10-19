"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Loader2, MessageCircle, UserPlus } from "lucide-react";
import { errorText } from "@/lib/api";
import { loadFriends, registerFriend, type MyFriend, type RegisteredFriend } from "@/lib/refer";

const field = "mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-normal outline-none ring-1 ring-black/5 placeholder:text-slate-400 focus:ring-brand";

// Refer & Earn: register a friend who has no account, then share their sign-in details. When the friend signs in with the
// shared password (and sets their own), you both get the points. The password is shown only right after registering.
export default function FriendRegister({ enabled, open, onToggle }: { enabled: boolean; open: boolean; onToggle: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<RegisteredFriend | null>(null);
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState<MyFriend[]>([]);

  const refresh = useCallback(() => { loadFriends().then(setFriends).catch(() => {}); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setMade(await registerFriend({ name: name.trim(), phone }));
      setName("");
      setPhone("");
      refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const details = (f: RegisteredFriend) => `Contact No: ${f.phone}\nPassword: ${f.password}`;
  const message = (f: RegisteredFriend) =>
    `Hi ${f.name}! I made you a Unique Futsal account.\n\n${details(f)}\n\nSign in at ${typeof window !== "undefined" ? window.location.origin : "uniquefutsal.com"} and set your own password when asked. We both get ${f.points} loyalty points when you sign in.`;

  async function copy(f: RegisteredFriend) {
    try { await navigator.clipboard.writeText(details(f)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the text is on screen to copy by hand */ }
  }

  return (
    <section className="rounded-3xl bg-[#dcebff] text-[#0c0b5d]" aria-label="Register a friend">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 p-5 text-left">
        <span className="flex items-center gap-2 text-lg font-semibold"><UserPlus size={20} /> Register a friend</span>
        <ChevronDown size={20} className={`shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
      <div className="px-5 pb-5">
      <p className="text-sm text-[#0c0b5d]/75">Friend has no account yet? Create one for them and share their sign-in details. When they sign in and set their own password, you both get 5 loyalty points.</p>

      {made ? (
        <div className="mt-4 rounded-2xl bg-white p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><Check size={16} /> {made.name} is registered</p>
          <dl className="mt-3 space-y-1 rounded-xl bg-[#f4f8ff] p-3 font-mono text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Contact No</dt><dd className="font-semibold">{made.phone}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Password</dt><dd className="font-semibold">{made.password}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-slate-500">Share these now: the password is not shown again. Your friend will be asked to set a new password at the first sign-in.</p>
          <div className="mt-3 flex gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(message(made))}`} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-semibold text-white"><MessageCircle size={16} /> Share on WhatsApp</a>
            <button type="button" onClick={() => copy(made)} className="flex items-center justify-center gap-2 rounded-full bg-[#0c0b5d] px-5 py-3 text-sm font-semibold text-white">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy"}</button>
          </div>
          <button type="button" onClick={() => setMade(null)} className="mt-3 w-full text-center text-sm font-medium text-brand">Register another friend</button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4">
          <label className="block text-xs font-medium text-slate-600">Friend&apos;s name
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} autoComplete="off" placeholder="Full name" className={field} />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600">Friend&apos;s mobile number
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))} inputMode="numeric" autoComplete="off" placeholder="98XXXXXXXX" className={field} />
          </label>
          {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
          <button type="submit" disabled={!enabled || busy || name.trim().length < 2 || phone.length !== 10} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#0c0b5d] py-3.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <><Loader2 size={16} className="animate-spin" /> Registering…</> : "Register and get sign-in details"}
          </button>
        </form>
      )}

      {friends.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Friends you registered">
          {friends.map((f) => (
            <li key={f.phone} className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-2.5 text-sm">
              <span className="min-w-0"><span className="block truncate font-medium">{f.name || f.phone}</span><span className="block font-mono text-[11px] text-slate-400">{f.phone}</span></span>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${f.signedIn ? "bg-emerald-400/25 text-emerald-700" : "bg-amber-400/25 text-amber-700"}`}>{f.signedIn ? `Signed in · +${f.points} pts` : "Waiting to sign in"}</span>
            </li>
          ))}
        </ul>
      )}
      </div>
      )}
    </section>
  );
}
