"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronLeft, Loader2, Plus, Trophy, Users, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { formatRs } from "@/lib/booking";
import { fmtDay } from "@/lib/promos";
import { useSession } from "@/lib/session";
import { fetchRegistrationInfo, submitTeam, type RegistrationInfo } from "@/lib/tournament";
import ShareRegistration from "@/components/tournament/ShareRegistration";

const input = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand";

// Team registration for ONE tournament. This page is the shareable link: anyone who has it can register a team, signed in or not.
export default function RegisterPage({ id }: { id: string }) {
  const session = useSession();
  const [info, setInfo] = useState<RegistrationInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  // a signed-in customer does not retype their name and number: until they change a field it shows their own
  const [captainInput, setCaptainName] = useState<string | null>(null);
  const [phoneInput, setPhone] = useState<string | null>(null);
  const captainName = captainInput ?? (session?.registered ? session.name : "");
  const phone = phoneInput ?? (session?.registered ? session.phone : "");
  const [email, setEmail] = useState("");
  const [players, setPlayers] = useState<string[]>(["", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ teamName: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetchRegistrationInfo(id).then((r) => { if (live) setInfo(r); }).catch((e) => { if (live) setLoadError(errorText(e)); });
    return () => { live = false; };
  }, [id]);

  if (loadError) {
    return (
      <div>
        <Link href="/tournaments" className="inline-flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Tournaments</Link>
        <p role="alert" className="glass mt-6 rounded-3xl px-4 py-10 text-center text-sm text-rose-600">{loadError}</p>
      </div>
    );
  }
  if (!info) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  const min = info.minPlayers;
  const max = info.maxPlayers;
  const filled = players.map((p) => p.trim()).filter(Boolean);
  const phoneOk = /^9\d{9}$/.test(phone);
  const ready = teamName.trim().length >= 2 && captainName.trim().length >= 2 && phoneOk && filled.length >= min;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await submitTeam(id, { teamName: teamName.trim(), captainName: captainName.trim(), contactPhone: phone, contactEmail: email.trim(), players: filled });
      setDone({ teamName: r.teamName });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="desk:mx-auto desk:max-w-2xl">
      <Link href="/tournaments" className="inline-flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Tournaments</Link>

      <header className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Team registration</p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight">{info.name}</h1>
        <dl className="glass mt-4 grid grid-cols-2 gap-3 rounded-3xl p-4 text-sm">
          <div className="flex gap-2">
            <CalendarDays size={18} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <dt className="text-xs text-slate-400">Dates</dt>
              <dd className="font-medium">{fmtDay(info.startDate)}{info.startDate !== info.endDate ? ` – ${fmtDay(info.endDate)}` : ""}</dd>
            </div>
          </div>
          <div className="flex gap-2">
            <Users size={18} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <dt className="text-xs text-slate-400">{info.hosted ? "Hosted by" : "Places left"}</dt>
              <dd className="font-medium">{info.hosted ? info.hosted.hostName ?? "The venue" : info.spotsLeft === null ? "Open" : `${info.spotsLeft} of ${info.limit}`}</dd>
            </div>
          </div>
          {info.prizePool > 0 && (
            <div className="col-span-2 flex gap-2">
              <Trophy size={18} className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <dt className="text-xs text-slate-400">Prize pool</dt>
                <dd className="font-medium">{formatRs(info.prizePool)}</dd>
              </div>
            </div>
          )}
        </dl>
      </header>

      {done ? (
        <section role="status" className="glass mt-5 space-y-4 rounded-3xl p-6 text-center">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
          <h2 className="text-xl font-semibold">Team registered</h2>
          <p className="text-sm text-slate-600">
            <b>{done.teamName}</b> is registered for {info.name}. The venue will check the details and confirm your place. Keep your phone near you.
          </p>
          <div className="rounded-2xl bg-white/60 p-4">
            <p className="mb-2 text-sm font-medium">Know another team? Share the registration link.</p>
            <ShareRegistration id={id} name={info.name} />
          </div>
          <Link href="/tournaments" className="glass-btn inline-flex rounded-full px-6 py-3 text-sm font-semibold text-white">Back to tournaments</Link>
        </section>
      ) : !info.open ? (
        <section role="status" className="glass mt-5 space-y-3 rounded-3xl p-6 text-center">
          <h2 className="text-lg font-semibold">Registration is closed</h2>
          <p className="text-sm text-slate-600">{info.closedReason}</p>
          <Link href="/tournaments" className="glass-btn inline-flex rounded-full px-6 py-3 text-sm font-semibold text-white">See tournaments</Link>
        </section>
      ) : (
        <form onSubmit={submit} className="glass mt-5 space-y-4 rounded-3xl p-5" noValidate>
          <h2 className="text-lg font-semibold">Register your team</h2>

          <label className="block space-y-1 text-sm font-medium">Team name
            <input className={input} value={teamName} maxLength={40} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Tilottama Strikers" autoComplete="off" />
          </label>
          <label className="block space-y-1 text-sm font-medium">Captain&apos;s name
            <input className={input} value={captainName} maxLength={60} onChange={(e) => setCaptainName(e.target.value)} autoComplete="name" />
          </label>
          <div>
            <label className="block space-y-1 text-sm font-medium">Captain&apos;s mobile number
              <input className={input} value={phone} inputMode="numeric" onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98XXXXXXXX" autoComplete="tel" />
            </label>
            {phone.length > 0 && !phoneOk && <p className="mt-1 text-xs text-rose-500">Enter a 10-digit mobile number starting with 9.</p>}
          </div>
          <label className="block space-y-1 text-sm font-medium">Email <span className="font-normal text-slate-400">(optional)</span>
            <input className={input} value={email} type="email" onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Players <span className="font-normal text-slate-400">({min} to {max}, include the captain)</span></legend>
            {players.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={input} value={p} maxLength={40} onChange={(e) => setPlayers((l) => l.map((v, j) => (j === i ? e.target.value : v)))} placeholder={`Player ${i + 1}`} aria-label={`Player ${i + 1}`} autoComplete="off" />
                {players.length > min && (
                  <button type="button" onClick={() => setPlayers((l) => l.filter((_, j) => j !== i))} aria-label={`Remove player ${i + 1}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500"><X size={16} /></button>
                )}
              </div>
            ))}
            {players.length < max && (
              <button type="button" onClick={() => setPlayers((l) => [...l, ""])} className="flex items-center gap-1.5 text-sm font-semibold text-brand"><Plus size={16} /> Add a player</button>
            )}
            <p className="text-xs text-slate-400">{filled.length} of at least {min} player names filled in.</p>
          </fieldset>

          {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}

          <button type="submit" disabled={!ready || busy} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <><Loader2 size={18} className="animate-spin" /> Registering…</> : "Register team"}
          </button>
          <p className="text-center text-xs text-slate-400">The venue confirms every team. You will be contacted on the mobile number above.</p>
        </form>
      )}
    </div>
  );
}
