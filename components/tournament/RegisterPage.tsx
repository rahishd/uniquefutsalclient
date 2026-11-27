"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, CalendarDays, CheckCircle2, ChevronLeft, Loader2, Trophy, Users } from "lucide-react";
import { errorText } from "@/lib/api";
import { formatRs } from "@/lib/booking";
import { fmtDay } from "@/lib/promos";
import { openSignIn, useSession } from "@/lib/session";
import { fetchRegistrationInfo, submitTeam, type RegistrationInfo } from "@/lib/tournament";
import ShareRegistration from "@/components/tournament/ShareRegistration";

const input = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand";

// The host's eSewa / Khalti numbers, with a Copy button, so a team can send the entry fee.
function PayNumbers({ info, team }: { info: RegistrationInfo; team?: string }) {
  const [copied, setCopied] = useState("");
  const rows = [{ label: "eSewa", number: info.esewaNumber }, { label: "Khalti", number: info.khaltiNumber }].filter((r): r is { label: string; number: string } => !!r.number);
  if (rows.length === 0) return null;
  const copy = (n: string) => { void navigator.clipboard?.writeText(n).then(() => { setCopied(n); setTimeout(() => setCopied(""), 1500); }).catch(() => {}); };
  return (
    <div className="mt-1.5 space-y-1.5">
      <p className="text-xs text-slate-500">Send the fee to the host and write {team?.trim() ? <b className="text-slate-700">{team.trim()}</b> : "your team name"} as the remarks, so the host can match it. Then the host confirms your team:</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-1.5 text-sm ring-1 ring-emerald-100">
          <span><b className="text-emerald-800">{r.label}</b> <span className="tabular-nums">{r.number}</span></span>
          <button type="button" onClick={() => copy(r.number)} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">{copied === r.number ? "Copied" : "Copy"}</button>
        </div>
      ))}
    </div>
  );
}

// Team registration for ONE tournament. This page is the shareable link: anyone signed in who has it can register a team (a guest is asked to sign in).
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
  if (session && !session.registered) {
    return (
      <div>
        <Link href="/tournaments" className="inline-flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Tournaments</Link>
        <section className="glass mt-6 rounded-3xl p-6 text-center">
          <p className="font-semibold">Sign in to register a team</p>
          <p className="mt-1 text-sm text-slate-500">{info.name}: registering a team needs an account. Guests can book a court and Gamezone only.</p>
          <button type="button" onClick={openSignIn} className="glass-btn mt-4 rounded-full px-6 py-3 text-sm font-semibold">Sign in</button>
        </section>
      </div>
    );
  }

  const phoneOk = /^9\d{9}$/.test(phone);
  const ready = teamName.trim().length >= 2 && captainName.trim().length >= 2 && phoneOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await submitTeam(id, { teamName: teamName.trim(), captainName: captainName.trim(), contactPhone: phone, contactEmail: email.trim() });
      setDone({ teamName: r.teamName });
    } catch (err) {
      const m = errorText(err);
      setError(/token|sign in|log in/i.test(m) ? "Please sign in to register your team." : m);
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
          <div className="col-span-2 flex gap-2">
            <Banknote size={18} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <dt className="text-xs text-slate-400">Entry fee</dt>
              <dd className="font-medium">{info.entryFee > 0 ? `${formatRs(info.entryFee)} per team` : "Free entry"}</dd>
              {info.entryFee > 0 && <PayNumbers info={info} team={teamName} />}
            </div>
          </div>
          {info.prizePool > 0 && (
            <div className="col-span-2 flex gap-2">
              <Trophy size={18} className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <dt className="text-xs text-slate-400">Prize pool</dt>
                <dd className="font-medium">{formatRs(info.prizePool)}</dd>
                {(info.prizes ?? []).length > 0 && (
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {(info.prizes ?? []).map((p, i) => (
                      <li key={`${p.place}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="w-9 shrink-0 font-semibold text-slate-700">{p.place}</span>
                        <span className="font-medium">{p.cash > 0 ? formatRs(p.cash) : "No cash"}</span>
                        {p.trophy && <span className="text-slate-500">+ {p.trophy}</span>}
                        {p.note && <span className="w-full pl-11 text-xs text-slate-400">{p.note}</span>}
                      </li>
                    ))}
                  </ul>
                )}
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
            <b>{done.teamName}</b> is registered for {info.name}. The tournament host will check the details and confirm your place. Keep your phone near you.
          </p>
          {info.entryFee > 0 && (info.esewaNumber || info.khaltiNumber) && (
            <div className="rounded-2xl bg-white/60 p-4 text-left">
              <p className="mb-1 text-sm font-medium">Pay the entry fee: {formatRs(info.entryFee)}</p>
              <PayNumbers info={info} team={done.teamName} />
            </div>
          )}
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


          {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}{/sign in/i.test(error) && <> <Link href={`/login?next=${encodeURIComponent(`/tournaments/${id}/register`)}`} className="font-semibold underline">Sign in</Link></>}</p>}

          <button type="submit" disabled={!ready || busy} className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-colors ${ready ? "bg-emerald-600 text-white shadow-[0_8px_20px_-8px_rgba(5,150,105,0.7)] disabled:opacity-70" : "glass-btn text-white disabled:opacity-50"}`}>
            {busy ? <><Loader2 size={18} className="animate-spin" /> Registering…</> : "Register team"}
          </button>
          <p className="text-center text-xs text-slate-400">The whole team is registered, so you do not need to list the players. The tournament host confirms every team and contacts you on the mobile number above{info.entryFee > 0 ? ` about the ${formatRs(info.entryFee)} entry fee` : ""}.</p>
        </form>
      )}
    </div>
  );
}
