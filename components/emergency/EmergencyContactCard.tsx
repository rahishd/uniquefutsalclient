"use client";

import { useState } from "react";
import { Check, HeartPulse, Loader2, Pencil, Phone, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { profileStore, saveEmergency } from "@/lib/profile";
import { markEmergencySaved, useSession } from "@/lib/session";

const input = "w-full rounded-2xl bg-white/80 px-4 py-3 text-sm outline-none ring-1 ring-black/5 placeholder:text-slate-400 focus:ring-brand";

// Profile > Emergency contact: who the venue (or a teammate, by "slide to call" on Claim Insurance) rings if this
// player is hurt. Required at sign-up; anyone who skipped it (older accounts, Google sign-in) adds it here.
export default function EmergencyContactCard() {
  const profile = profileStore.use().data;
  const session = useSession();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;
  const own = session?.registered ? session.phone : "";
  const saved = !!profile.emergencyPhone;
  const phoneOk = /^9\d{9}$/.test(phone) && phone !== own;
  const canSave = name.trim().length >= 2 && phoneOk && !busy;

  function open() {
    setName(profile?.emergencyName ?? "");
    setPhone(profile?.emergencyPhone ?? "");
    setRelation(profile?.emergencyRelation ?? "");
    setError(null);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await saveEmergency({ emergencyName: name.trim(), emergencyPhone: phone, emergencyRelation: relation.trim() });
      markEmergencySaved();
      setEditing(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="emergency" aria-label="Emergency contact" className={`glass scroll-mt-28 rounded-3xl p-5 desk:col-span-2 ${saved ? "" : "ring-2 ring-rose-300"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600"><HeartPulse size={22} /></span>
          <div className="min-w-0">
            <p className="font-medium">Emergency contact</p>
            {saved ? (
              <p className="text-sm text-slate-500">
                {profile.emergencyName}{profile.emergencyRelation ? ` (${profile.emergencyRelation})` : ""} · {profile.emergencyPhone}
              </p>
            ) : (
              <p className="text-sm font-medium text-rose-600">Not added yet. Add someone we can call if you get hurt at the venue.</p>
            )}
          </div>
        </div>
        {!editing && (
          <button type="button" onClick={open} aria-label={saved ? "Change emergency contact" : "Add emergency contact"}
            className={saved ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/60 text-brand" : "shrink-0 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white"}>
            {saved ? <Pencil size={18} /> : "Add now"}
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="mt-4 space-y-3">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Their name" aria-label="Emergency contact name" />
          <label className="relative block">
            <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${input} pl-10`} value={phone} inputMode="numeric" onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Their mobile number (98XXXXXXXX)" aria-label="Emergency contact mobile number" />
          </label>
          {phone.length === 10 && !phoneOk && <p className="-mt-1 px-1 text-xs font-medium text-rose-600">{phone === own ? "Use someone else's number, not your own." : "That mobile number doesn't look right."}</p>}
          <input className={input} value={relation} onChange={(e) => setRelation(e.target.value)} maxLength={40} placeholder="Relation, e.g. Father (optional)" aria-label="Relation to you" />
          {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setEditing(false)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/70 py-3 text-sm font-medium text-slate-600"><X size={16} /> Cancel</button>
            <button type="submit" disabled={!canSave} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-brand py-3 text-sm font-medium text-white disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
