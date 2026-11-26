"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { forgetRecall, useRecallState } from "@/lib/recall";
import { CheckCircle2, ChevronRight, ImagePlus, Loader2, MessageSquareWarning, UserRound, X } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { errorText } from "@/lib/api";
import { FALLBACK_RULES, loadRules, sendComplaint, shrinkPhoto, type Complaint, type ComplaintRules } from "@/lib/complaints";

export default function ComplaintsPage() {
  const session = useSession();
  const [rules, setRules] = useState<ComplaintRules>(FALLBACK_RULES);
  const [category, setCategory] = useRecallState("complaints.category", "");
  const [message, setMessage] = useRecallState("complaints.message", "");
  const [bookingCode, setBookingCode] = useRecallState("complaints.booking", "");
  const [photos, setPhotos] = useState<string[]>([]); // already shrunk, ready to send
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Complaint | null>(null);
  // a finished request is not remembered: the next visit starts fresh
  useEffect(() => {
    if (sent) forgetRecall("complaints.");
  }, [sent]);
  const picker = useRef<HTMLInputElement>(null);

  const registered = session?.registered === true;

  useEffect(() => {
    let live = true;
    loadRules().then((r) => live && setRules(r)).catch(() => {});
    return () => { live = false; };
  }, []);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setPhotoBusy(true);
    try {
      const room = rules.maxPhotos - photos.length;
      const next: string[] = [];
      for (const f of Array.from(files).slice(0, room)) next.push(await shrinkPhoto(f));
      setPhotos((p) => [...p, ...next]);
      if (files.length > room) setError(`You can attach up to ${rules.maxPhotos} photos.`);
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
    if (!category) return setError("Choose what your complaint is about.");
    if (message.trim().length < rules.messageMin) return setError(`Please describe the problem (at least ${rules.messageMin} characters).`);
    setBusy(true);
    try {
      const c = await sendComplaint({ category, message: message.trim(), bookingCode: bookingCode.trim() || undefined, photos });
      setSent(c);
      setCategory("");
      setMessage("");
      setBookingCode("");
      setPhotos([]);
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
        <h1 className="mt-6 text-2xl font-semibold">Complaints</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Sign in so we can follow up with you and show you our reply.</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-400/20 text-emerald-600"><CheckCircle2 size={38} /></span>
        <h1 className="mt-6 text-2xl font-semibold">We got your complaint</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Your reference is <strong className="font-mono text-slate-700">{sent.code}</strong>. The venue will look into it and reply here and in your notifications.</p>
        <Link href="/profile/complaints" className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">See my complaints</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4 desk:mx-auto desk:max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Complaints</h1>
        <p className="text-sm text-slate-500">Something went wrong? Tell us and we will look into it.</p>
      </header>

      <section aria-label="Confidentiality" className="rounded-2xl bg-white px-3.5 py-2.5 text-xs leading-snug text-[#0c0b5d] shadow-sm ring-1 ring-slate-200">
        <p>Complaints go directly to the Owner and stay strictly confidential. Your identity is never disclosed, even to staff. Track progress: Received, Reviewed, Solved, Closed. You&apos;ll get updates.</p>
      </section>

      <form onSubmit={submit} className="glass space-y-5 rounded-3xl p-5" aria-label="New complaint">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">What is it about?</legend>
          <div className="flex flex-wrap gap-1.5">
            {rules.categories.map((c) => (
              <button type="button" key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}
                className={`rounded-full px-3 py-1 text-xs ${category === c.id ? "bg-brand font-semibold text-white" : "bg-white/60 text-slate-600"}`}>{c.label}</button>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm font-medium">What happened?
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={rules.messageMax} placeholder="Tell us what happened, when, and what you would like us to do."
            className="mt-1.5 w-full rounded-2xl bg-white/70 px-4 py-2 text-sm font-normal outline-none ring-1 ring-black/5 placeholder:text-slate-400 focus:ring-brand" />
          <span className="mt-1 block text-right text-xs font-normal text-slate-400">{message.length} / {rules.messageMax}</span>
        </label>

        <label className="block text-sm font-medium">Booking code <span className="font-normal text-slate-400">(optional)</span>
          <input value={bookingCode} onChange={(e) => setBookingCode(e.target.value.toUpperCase())} maxLength={20} placeholder="e.g. UF-7K3QX9"
            className="mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 font-mono text-sm outline-none ring-1 ring-black/5 placeholder:font-sans placeholder:text-slate-400 focus:ring-brand" />
        </label>

        <div>
          <p className="mb-1.5 text-sm font-medium">Photos <span className="font-normal text-slate-400">(optional, up to {rules.maxPhotos})</span></p>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative h-16 w-16 overflow-hidden rounded-2xl bg-white/60">
                {/* a local data URL preview, so next/image is not needed */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"><X size={14} /></button>
              </div>
            ))}
            {photos.length < rules.maxPhotos && (
              <button type="button" disabled={photoBusy} onClick={() => picker.current?.click()}
                className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 text-xs text-slate-500 disabled:opacity-60">
                {photoBusy ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={24} />}
                {photoBusy ? "Adding…" : "Add photo"}
              </button>
            )}
          </div>
          <input ref={picker} type="file" accept="image/*" multiple className="sr-only" aria-label="Choose photos" onChange={(e) => addPhotos(e.target.files)} />
          <p className="mt-1.5 text-xs text-slate-400">Photos are shrunk before sending; venue staff can see them.</p>
        </div>

        {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

        <button type="submit" disabled={busy || photoBusy} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : "Send complaint"}
        </button>
        <p className="text-center text-xs text-slate-400">You can send up to {rules.perDay} a day. For something urgent, call the venue.</p>
      </form>

      <Link href="/profile/complaints" className="glass flex items-center justify-between gap-3 rounded-3xl p-4 text-sm font-medium text-[#0c0b5d]">
        <span className="flex items-center gap-2"><MessageSquareWarning size={18} className="text-brand" /> View your complaints in Profile</span>
        <ChevronRight size={18} className="text-slate-400" />
      </Link>
    </div>
  );
}
