"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Banknote, ChevronLeft, Download, Loader2, MapPin, CalendarDays, Trophy, Users } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";
import TieSheet from "@/components/TieSheet";
import LiveGoals from "@/components/tournament/LiveGoals";
import { downloadPdf } from "@/lib/pdf";
import { dateKey, formatRs } from "@/lib/booking";
import { fmtDay } from "@/lib/promos";
import { site } from "@/lib/site";
import { HostedEvent, canRegister, eventsStore, hoursLabel, registrationPath, tieSheetPdf, tournamentStore, type Tournament } from "@/lib/tournament";
import ShareRegistration from "@/components/tournament/ShareRegistration";

// Tournaments the venue hosts for a manager: the host and the hours of each day
function EventList({ events }: { events: HostedEvent[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {events.map((e) => (
        <li key={e.id} className="glass rounded-3xl p-5">
          <p className="font-medium">{e.name}</p>
          <p className="text-xs text-slate-400">{fmtDay(e.startDate)}{e.startDate !== e.endDate ? ` – ${fmtDay(e.endDate)}` : ""}{e.hostName ? ` · Hosted by ${e.hostName}` : ""}</p>
          <p className="mt-2 text-sm"><span className="text-slate-400">Entry fee:</span> <b className="font-medium">{e.entryFee && e.entryFee > 0 ? `${formatRs(e.entryFee)} per team` : "Free entry"}</b></p>
          <ul className="mt-3 space-y-1 text-sm">{e.days.map((d) => <li key={d.date} className="flex justify-between"><span>{fmtDay(d.date)}</span><span className="text-slate-500">{hoursLabel(d)}</span></li>)}</ul>
          {/* sign-up closes when the event starts */}
          {e.startDate > dateKey(new Date()) ? <RegisterBox id={e.id} name={e.name} /> : <p className="mt-3 rounded-2xl bg-white/60 p-3 text-center text-xs text-slate-500">Registration is closed: this event has started.</p>}
        </li>
      ))}
    </ul>
  );
}

// The way in for a team: register for this tournament, and the link to send to other teams.
function RegisterBox({ id, name }: { id: string; name: string }) {
  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-white/60 p-4">
      <Link href={registrationPath(id)} className="glass-btn flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold text-white">Register your team</Link>
      <div>
        <p className="mb-2 text-center text-xs text-slate-500">Registration link for this tournament</p>
        <ShareRegistration id={id} name={name} />
      </div>
    </div>
  );
}

export default function TournamentsPage() {
  const store = tournamentStore.use();
  const events = (eventsStore.use().data ?? []).filter((e) => e.id !== store.data?.id); // the one shown below is not listed twice
  if (store.status === "error") return <p role="alert" className="glass rounded-3xl px-4 py-10 text-center text-sm text-rose-600">{store.error}</p>;
  if (store.status === "idle" || store.status === "loading") return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;
  const t = store.data ?? null;
  if (!t && events.length > 0) {
    return (
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Home</Link>
        <h1 className="mt-4 text-2xl font-semibold">Tournaments at the venue</h1>
        <EventList events={events} />
      </div>
    );
  }
  if (!t) {
    return <PlaceholderPage icon={Trophy} title="No tournament right now" note="Check back soon for the next one." />;
  }

  return (
    <div>
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-brand">
        <ChevronLeft size={18} /> Home
      </Link>

      <header className="mt-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${t.status === "live" ? "bg-rose-500/10 text-rose-600" : t.status === "upcoming" ? "bg-sky-500/10 text-sky-700" : "bg-slate-500/10 text-slate-600"}`}>{t.status === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}{t.status}</span>
        <h1 className="mt-3 text-2xl font-bold leading-tight text-slate-900">{t.name}</h1>
      </header>

      <dl className="glass mt-5 grid grid-cols-2 gap-4 rounded-3xl p-5 text-sm">
        <div className="flex gap-2">
          <CalendarDays size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <dt className="text-xs text-slate-400">Dates</dt>
            <dd className="font-medium">{fmtDay(t.startDate)} – {fmtDay(t.endDate)}</dd>
          </div>
        </div>
        <div className="flex gap-2">
          <Users size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <dt className="text-xs text-slate-400">{t.hosted ? "Hosted by" : t.format ? "Format" : "Teams"}</dt>
            <dd className="font-medium">{t.hosted ? t.hosted.hostName ?? "The venue" : t.format ?? `${t.teams} teams`}</dd>
          </div>
        </div>
        <div className="col-span-2 flex gap-2">
          <MapPin size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <dt className="text-xs text-slate-400">Venue</dt>
            <dd className="font-medium">{site.name}, {site.address}</dd>
          </div>
        </div>
        <div className="col-span-2 flex gap-2">
          <Banknote size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <dt className="text-xs text-slate-400">Entry fee</dt>
            <dd className="font-medium">{t.entryFee && t.entryFee > 0 ? `${formatRs(t.entryFee)} per team` : "Free entry"}</dd>
          </div>
        </div>
        {t.prizePool > 0 && (
          <div className="col-span-2 flex gap-2">
            <Trophy size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <div className="w-full">
              <dt className="text-xs text-slate-400">Prize pool · {formatRs(t.prizePool)}</dt>
              {t.prizes && (
                <dd className="mt-1 grid grid-cols-3 gap-2 text-center text-xs">
                  {[["1st", t.prizes.first], ["2nd", t.prizes.second], ["3rd", t.prizes.third]].map(([k, v]) => v && (
                    <span key={k} className="rounded-xl bg-white/60 py-2"><b className="block text-sm">{v}</b>{k}</span>
                  ))}
                </dd>
              )}
            </div>
          </div>
        )}
      </dl>

      {canRegister(t) && (
        <section aria-label="Register a team" className="glass mt-5 rounded-3xl p-5">
          <h2 className="text-lg font-medium">Register your team</h2>
          <p className="mt-1 text-sm text-slate-500">Teams can sign up for {t.name} here. Each tournament has its own registration link that you can share.</p>
          <RegisterBox id={t.id} name={t.name} />
        </section>
      )}

      {t.hosted && t.hosted.days.length > 0 && (
        <section className="mt-6" aria-label="Schedule">
          <h2 className="mb-3 text-lg font-medium">Schedule</h2>
          <ul className="glass divide-y divide-white/60 rounded-3xl text-sm">
            {t.hosted.days.map((d) => (
              <li key={d.date} className="flex items-center justify-between px-5 py-3"><span className="font-medium">{fmtDay(d.date)}</span><span className="text-slate-500">{hoursLabel(d)}</span></li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">The court is reserved for this tournament during these hours.</p>
        </section>
      )}

      <LiveGoals rounds={t.rounds} />

      <section aria-label="Tie-sheet" className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Tie-sheet</h2>
          {t.rounds.length > 0 && <TieSheetPdfButton t={t} />}
        </div>
        {t.rounds.length === 0 ? (
          <p className="rounded-3xl border border-slate-100 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">{t.hosted ? "The tie-sheet will appear here if the organiser shares one." : "The tie-sheet will appear here once the draw is made."}</p>
        ) : (
          <>
            <TieSheet rounds={t.rounds} />
            <p className="mt-2 text-xs text-slate-400">Swipe sideways to see every round.</p>
          </>
        )}
      </section>

      <footer className="mt-10 border-t border-slate-200/70 pt-6">
        <Link href="/tournaments/upcoming" className="group flex items-center justify-between rounded-2xl bg-[#0c0b5d] px-5 py-4 text-white shadow-[0_12px_28px_-14px_rgba(12,11,93,0.8)]">
          <span>
            <span className="block text-sm font-bold">View Upcoming Tournaments</span>
            <span className="block text-xs text-white/70">See what is coming next and register your team</span>
          </span>
          <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </footer>
    </div>
  );
}

// Downloads the tie-sheet (every match, score, status, time and scorers) as a PDF. jsPDF loads only when this is tapped.
function TieSheetPdfButton({ t }: { t: Tournament }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try { await downloadPdf(tieSheetPdf(t)); } finally { setBusy(false); }
      }}
      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#0c0b5d] shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download PDF
    </button>
  );
}
