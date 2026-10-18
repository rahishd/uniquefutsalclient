"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ambulance, CheckCircle2, ImagePlus, Loader2, PhoneCall, PhoneOff, ShieldPlus, Siren, UserRound, X } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { errorText } from "@/lib/api";
import { markReadByTypes } from "@/lib/notifications";
import { site } from "@/lib/site";
import {
  FALLBACK_OPTIONS, STATUS_TEXT, fileClaim, hasNepali, loadMyClaims, loadOptions, lookupEmergency, photoUrl, shrinkPhoto,
  type EmergencyLookup, type InsuranceClaim, type InsuranceOptions, type Severity,
} from "@/lib/insurance";
import SlideToCall from "@/components/insurance/SlideToCall";

const field = "mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-normal outline-none ring-1 ring-black/5 placeholder:text-slate-400 focus:ring-brand";
const MOBILE = /^9\d{9}$/;

// The device's calendar day as YYYY-MM-DD (the server checks the date again in Nepal time).
function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// The "calling" screen shown for a moment before the phone's own dialer takes over (a web app cannot place the call
// itself: the tel: link hands the number to the regular phone call).
function CallingScreen({ name, relation, masked, phone, onCancel }: { name: string; relation: string | null; masked: string; phone: string; onCancel: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => { window.location.href = `tel:${phone}`; }, 1800);
    return () => clearTimeout(t);
  }, [phone]);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Calling ${name}`} className="fixed inset-0 z-[80] flex flex-col items-center justify-between bg-gradient-to-b from-[#0c0b5d] to-[#1e1b8f] px-6 pb-[calc(env(safe-area-inset-bottom)+3rem)] pt-[calc(env(safe-area-inset-top)+5rem)] text-white">
      <div className="flex flex-col items-center text-center">
        <span className="relative flex h-28 w-28 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
          <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/15"><PhoneCall size={40} /></span>
        </span>
        <p className="mt-8 text-sm uppercase tracking-[0.25em] text-white/70">Emergency call</p>
        <p className="mt-2 text-3xl font-semibold">{name}</p>
        {relation && <p className="mt-1 text-white/75">{relation}</p>}
        <p className="mt-3 font-mono text-lg tracking-wider text-white/90">{masked}</p>
        <p className="mt-6 max-w-xs text-sm text-white/70">Switching to your phone&apos;s regular call…</p>
      </div>
      <div className="flex w-full max-w-xs flex-col items-center gap-3">
        <a href={`tel:${phone}`} className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 py-4 text-base font-semibold" style={{ color: "#ffffff" }}><PhoneCall size={20} /> Call now</a>
        <button type="button" onClick={onCancel} className="flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 py-4 text-base font-semibold text-white"><PhoneOff size={20} /> Cancel</button>
      </div>
    </div>
  );
}

export default function InsurancePage() {
  const session = useSession();
  const [opts, setOpts] = useState<InsuranceOptions>(FALLBACK_OPTIONS);
  const [mine, setMine] = useState<InsuranceClaim[] | null>(null);
  const [severity, setSeverity] = useState<Severity | "">("");
  // null = not typed yet: the injured player is usually the person filing, so their own name and number show first
  const [patientNameIn, setPatientName] = useState<string | null>(null);
  const [patientPhoneIn, setPatientPhone] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [witnessName, setWitnessName] = useState("");
  const [witnessNameNe, setWitnessNameNe] = useState("");
  const [witnessPhone, setWitnessPhone] = useState("");
  const [incidentDate, setIncidentDate] = useState(() => dayKey());
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<InsuranceClaim | null>(null);
  const [calling, setCalling] = useState<EmergencyLookup["contact"]>(null);
  const [lookup, setLookup] = useState<{ busy: boolean; error: string | null; none: boolean }>({ busy: false, error: null, none: false });
  const picker = useRef<HTMLInputElement>(null);
  const registered = session?.registered === true;
  const patientName = patientNameIn ?? (session?.registered ? session.name : "");
  const patientPhone = patientPhoneIn ?? (session?.registered ? session.phone : "");

  useEffect(() => {
    let live = true;
    loadOptions().then((o) => live && setOpts(o)).catch(() => {});
    return () => { live = false; };
  }, []);

  const refresh = useCallback(() => loadMyClaims().then(setMine).catch(() => setMine([])), []);
  useEffect(() => {
    if (!registered) return;
    let live = true;
    loadMyClaims().then((m) => live && setMine(m)).catch(() => live && setMine([]));
    markReadByTypes(["insurance"]);
    return () => { live = false; };
  }, [registered]);

  async function callEmergency() {
    if (!MOBILE.test(patientPhone)) {
      setLookup({ busy: false, error: "Enter the injured player's registered mobile number first.", none: false });
      return;
    }
    setLookup({ busy: true, error: null, none: false });
    try {
      const r = await lookupEmergency(patientPhone);
      if (r.contact) {
        setCalling(r.contact);
        setLookup({ busy: false, error: null, none: false });
      } else {
        setLookup({ busy: false, error: null, none: true });
      }
    } catch (e) {
      setLookup({ busy: false, error: errorText(e), none: false });
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setPhotoBusy(true);
    try {
      const room = opts.maxPhotos - photos.length;
      const next: string[] = [];
      for (const f of Array.from(files).slice(0, room)) next.push(await shrinkPhoto(f));
      setPhotos((p) => [...p, ...next]);
      if (files.length > room) setError(`You can attach up to ${opts.maxPhotos} photos.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That photo could not be added.");
    } finally {
      setPhotoBusy(false);
      if (picker.current) picker.current.value = "";
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (photos.length === 0) return setError("Add at least one photo of the incident or injury.");
    if (patientName.trim().length < 2) return setError("Enter the name of the injured player.");
    if (!MOBILE.test(patientPhone)) return setError("Enter the injured player's 10-digit registered mobile number.");
    if (witnessName.trim().length < 2) return setError("Enter the witness's name.");
    if (!hasNepali(witnessNameNe)) return setError("Enter the witness's name in Nepali (साक्षीको नाम नेपालीमा).");
    if (witnessPhone && !MOBILE.test(witnessPhone)) return setError("Enter the witness's 10-digit mobile number, or leave it empty.");
    if (!severity) return setError("Choose the injury case: Minor or Emergency.");
    setBusy(true);
    try {
      const c = await fileClaim({
        patientName: patientName.trim(), patientPhone, witnessName: witnessName.trim(), witnessNameNe: witnessNameNe.trim(),
        witnessPhone: witnessPhone || undefined, severity, incidentDate, description: description.trim() || undefined, photos,
      });
      setSent(c);
      setWitnessName(""); setWitnessNameNe(""); setWitnessPhone(""); setDescription(""); setPhotos([]); setSeverity("");
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  if (!registered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand"><UserRound size={34} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Claim Insurance</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Sign in to file an insurance claim for an injury at the venue.</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
        <a href={`tel:${opts.ambulance}`} className="mt-6 flex items-center gap-2 text-sm font-semibold text-rose-600"><Ambulance size={18} /> Emergency? Call ambulance {opts.ambulance}</a>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-400/20 text-emerald-600"><CheckCircle2 size={38} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Claim received</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Your reference is <strong className="font-mono text-slate-700">{sent.code}</strong>. The venue will review it and reply here and in your notifications.</p>
        <button type="button" onClick={() => setSent(null)} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">See my claims</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4 desk:mx-auto desk:max-w-3xl">
      {calling && <CallingScreen name={calling.name} relation={calling.relation} masked={calling.masked} phone={calling.phone} onCancel={() => setCalling(null)} />}

      <header>
        <h1 className="text-2xl font-semibold">Claim Insurance</h1>
        <p className="text-sm text-slate-500">Hurt during a game at the venue? File your claim here with a photo and a witness.</p>
      </header>

      <form onSubmit={submit} className="glass space-y-5 rounded-3xl p-5" aria-label="New insurance claim">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Injury case <span className="font-normal text-slate-400">/ चोटको अवस्था</span></legend>
          <div className="grid grid-cols-2 gap-2">
            {([["minor", "Minor", "सामान्य"], ["emergency", "Emergency", "आपतकालीन"]] as const).map(([id, en, ne]) => (
              <button type="button" key={id} aria-pressed={severity === id} onClick={() => setSeverity(id)}
                className={`flex flex-col items-center rounded-2xl px-3 py-3 text-sm ${severity === id ? (id === "emergency" ? "bg-rose-600 font-semibold text-white" : "bg-brand font-semibold text-white") : "bg-white/60 text-slate-600"}`}>
                <span className="flex items-center gap-1.5">{id === "emergency" ? <Siren size={16} /> : <ShieldPlus size={16} />} {en}</span>
                <span className="text-xs opacity-80">{ne}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {severity === "emergency" && (
          <div className="space-y-3 rounded-3xl bg-rose-50 p-4 ring-1 ring-rose-200">
            <p className="text-sm font-semibold text-rose-700">Emergency: call for help first, then finish the claim.</p>
            <p className="text-xs text-rose-800/80">Slide to call the emergency contact saved on the injured player&apos;s account ({MOBILE.test(patientPhone) ? patientPhone : "enter their number below"}). Your phone switches to a regular call.</p>
            <SlideToCall label="Slide to call emergency contact" onComplete={callEmergency} busy={lookup.busy} disabled={!MOBILE.test(patientPhone)} />
            {lookup.error && <p role="alert" className="text-sm text-rose-700">{lookup.error}</p>}
            {lookup.none && <p role="status" className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-700">This player has not saved an emergency contact. Call the ambulance or the venue instead.</p>}
            <div className="grid grid-cols-2 gap-2">
              <a href={`tel:${opts.ambulance}`} className="flex items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-semibold text-rose-600 ring-1 ring-rose-200"><Ambulance size={18} /> Ambulance {opts.ambulance}</a>
              <a href={`tel:${site.phone}`} className="flex items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-semibold text-brand ring-1 ring-slate-200"><PhoneCall size={18} /> Call venue</a>
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">Photo of the incident or injury <span className="font-normal text-rose-500">(required, up to {opts.maxPhotos})</span></p>
          <div className="flex flex-wrap gap-3">
            {photos.map((p, i) => (
              <div key={i} className="relative h-24 w-24 overflow-hidden rounded-2xl bg-white/60">
                {/* a local data URL preview, so next/image is not needed */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"><X size={14} /></button>
              </div>
            ))}
            {photos.length < opts.maxPhotos && (
              <button type="button" disabled={photoBusy} onClick={() => picker.current?.click()}
                className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 text-xs text-slate-500 disabled:opacity-60">
                {photoBusy ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={24} />}
                {photoBusy ? "Adding…" : "Add photo"}
              </button>
            )}
          </div>
          <input ref={picker} type="file" accept="image/*" capture="environment" multiple className="sr-only" aria-label="Choose photos" onChange={(e) => addPhotos(e.target.files)} />
          <p className="mt-2 text-xs text-slate-400">Photos are shrunk before sending. Only venue staff can see them.</p>
        </div>

        <label className="block text-sm font-medium">Name of the patient <span className="font-normal text-slate-400">/ बिरामीको नाम</span>
          <input value={patientName} onChange={(e) => setPatientName(e.target.value)} maxLength={80} placeholder="Full name of the injured player" className={field} />
        </label>

        <label className="block text-sm font-medium">Registered number in Unique Futsal account
          <input value={patientPhone} inputMode="numeric" onChange={(e) => setPatientPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98XXXXXXXX" className={`${field} font-mono`} />
          <span className="mt-1 block text-xs font-normal text-slate-400">The injured player must have a Unique Futsal account. Filing for a teammate? Enter their number.</span>
        </label>

        <fieldset className="space-y-3 rounded-3xl bg-white/40 p-4">
          <legend className="text-sm font-medium">Witness <span className="font-normal text-slate-400">/ साक्षी</span></legend>
          <label className="block text-sm font-medium">Witness name (English)
            <input value={witnessName} onChange={(e) => setWitnessName(e.target.value)} maxLength={80} placeholder="e.g. Ram Thapa" className={field} />
          </label>
          <label className="block text-sm font-medium" lang="ne">साक्षीको नाम (नेपालीमा)
            <input value={witnessNameNe} onChange={(e) => setWitnessNameNe(e.target.value)} maxLength={80} placeholder="जस्तै: राम थापा" lang="ne" className={field} />
            {witnessNameNe.length > 0 && !hasNepali(witnessNameNe) && <span className="mt-1 block text-xs font-medium text-rose-600">Please type the name in Nepali letters (नेपाली अक्षर).</span>}
          </label>
          <label className="block text-sm font-medium">Witness mobile <span className="font-normal text-slate-400">(optional)</span>
            <input value={witnessPhone} inputMode="numeric" onChange={(e) => setWitnessPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98XXXXXXXX" className={`${field} font-mono`} />
          </label>
        </fieldset>

        <label className="block text-sm font-medium">Day of the injury
          <input type="date" value={incidentDate} max={dayKey(new Date(now))} min={dayKey(new Date(now - opts.daysBack * 86400000))} onChange={(e) => setIncidentDate(e.target.value)} className={field} />
        </label>

        <label className="block text-sm font-medium">What happened? <span className="font-normal text-slate-400">(optional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={opts.descriptionMax} placeholder="How the injury happened and what treatment was needed." className={field} />
        </label>

        {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

        <button type="submit" disabled={busy || photoBusy} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : "Submit claim"}
        </button>
        <p className="text-center text-xs text-slate-400">Claims must be filed within {opts.daysBack} days of the injury. Up to {opts.perDay} a day.</p>
      </form>

      <section aria-label="My insurance claims" className="space-y-3">
        <h2 className="text-lg font-medium">My claims</h2>
        {mine === null && <div className="h-24 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />}
        {mine?.length === 0 && (
          <div className="glass flex flex-col items-center gap-2 rounded-3xl px-4 py-8 text-center text-sm text-slate-500">
            <ShieldPlus size={28} className="text-slate-400" />
            No insurance claims yet.
          </div>
        )}
        <ul className="space-y-3">
          {mine?.map((c) => {
            const st = STATUS_TEXT[c.status];
            return (
              <li key={c.id} className="glass space-y-2 rounded-3xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    {c.severity === "emergency" ? <Siren size={15} className="text-rose-600" /> : <ShieldPlus size={15} className="text-brand" />}
                    {c.patientName}{c.severity === "emergency" ? " · Emergency" : " · Minor"}
                  </p>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${st.tone}`}>{st.label}</span>
                </div>
                <p className="text-xs text-slate-400"><span className="font-mono">{c.code}</span> · injury {c.incidentDate} · filed {when(c.createdAt)}{c.filedByMe ? "" : " · filed for you"}</p>
                <p className="text-xs text-slate-500">Witness: {c.witnessName} / <span lang="ne">{c.witnessNameNe}</span></p>
                {c.description && <p className="whitespace-pre-line text-sm text-slate-600">{c.description}</p>}
                {c.photos.length > 0 && (
                  <div className="flex gap-2">
                    {c.photos.map((p, i) => (
                      <a key={p} href={photoUrl(p)} target="_blank" rel="noopener noreferrer" aria-label={`Open photo ${i + 1}`} className="block h-16 w-16 overflow-hidden rounded-xl bg-white/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoUrl(p)} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {c.staffReply && (
                  <div className="rounded-2xl bg-brand/10 px-4 py-3 text-sm">
                    <p className="text-xs font-semibold text-brand">Reply from the venue</p>
                    <p className="mt-1 whitespace-pre-line text-slate-700">{c.staffReply}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
