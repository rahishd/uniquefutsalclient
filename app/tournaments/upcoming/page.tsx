"use client";

import { useState } from "react";
import Link from "next/link";
import { Banknote, CalendarDays, CheckCircle2, ChevronLeft, Phone, Trophy, Users } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";
import { dateKey, formatRs } from "@/lib/booking";
import { fmtDay } from "@/lib/promos";
import { errorText } from "@/lib/api";
import { askConfirm } from "@/lib/confirm";
import { site } from "@/lib/site";
import { cancelMyRegistration, canRegister, myRegistrationsStore, registrationPath, tournamentListStore } from "@/lib/tournament";

// "View Upcoming Tournaments": every tournament that has not started yet, soonest first, each with its dates, format,
// entry fee and prize and a button to register a team. Sign-up closes when a tournament starts, so a started one is never listed.
const daysUntil = (day: string) => Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${dateKey(new Date())}T00:00:00Z`)) / 86_400_000);

export default function UpcomingTournamentsPage() {
  const store = tournamentListStore.use();
  const mine = myRegistrationsStore.use().data ?? [];
  const [cancelling, setCancelling] = useState("");
  const [cancelError, setCancelError] = useState("");
  async function cancel(regId: string, team: string) {
    if (!(await askConfirm(`Cancel the registration of ${team}? You can register again later while sign-up is open.`, { confirmLabel: "Cancel registration", cancelLabel: "Keep it", danger: true }))) return;
    setCancelling(regId); setCancelError("");
    try { await cancelMyRegistration(regId); await myRegistrationsStore.refresh(); } catch (e) { setCancelError(errorText(e)); } finally { setCancelling(""); }
  }
  if (store.status === "error") return <p role="alert" className="glass rounded-3xl px-4 py-10 text-center text-sm text-rose-600">{store.error}</p>;
  if (store.status === "idle" || store.status === "loading") return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  const upcoming = (store.data ?? []).filter((t) => t.status === "upcoming").sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div>
      <Link href="/tournaments" className="inline-flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Tournament</Link>
      <header className="mt-4">
        <h1 className="text-2xl font-bold leading-tight text-slate-900">Upcoming tournaments</h1>
        <p className="mt-1 text-sm text-slate-500">Register your team before a tournament starts. Sign-up closes on the first day.</p>
      </header>

      {upcoming.length === 0 ? (
        <div className="mt-6"><PlaceholderPage icon={Trophy} title="No upcoming tournament yet" note="Check back soon for the next one." /></div>
      ) : (
        <ul className="mt-6 space-y-4">
          {upcoming.map((t) => {
            const n = daysUntil(t.startDate);
            const reg = mine.find((r) => r.tournamentId === t.id);
            return (
              <li key={t.id} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center justify-between bg-sky-50 px-5 py-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-sky-700">{n <= 0 ? "Starts today" : n === 1 ? "Starts tomorrow" : `Starts in ${n} days`}</span>
                  {t.prizePool > 0 && <span className="flex items-center gap-1 text-xs font-semibold text-amber-600"><Trophy size={13} /> {formatRs(t.prizePool)}</span>}
                </div>
                <div className="p-5">
                  <h2 className="text-lg font-bold leading-snug text-slate-900">{t.name}</h2>
                  <dl className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2"><CalendarDays size={16} className="shrink-0 text-brand" /><dd>{fmtDay(t.startDate)}{t.startDate !== t.endDate ? ` – ${fmtDay(t.endDate)}` : ""}</dd></div>
                    <div className="flex items-center gap-2"><Users size={16} className="shrink-0 text-brand" /><dd>{t.hosted ? `Hosted by ${t.hosted.hostName ?? "the venue"}` : t.format ?? `${t.teams} teams`}</dd></div>
                    <div className="flex items-center gap-2"><Banknote size={16} className="shrink-0 text-brand" /><dd>{t.entryFee && t.entryFee > 0 ? `${formatRs(t.entryFee)} per team` : "Free entry"}</dd></div>
                  </dl>
                  {reg ? (
                    <div role="status" className="mt-4 space-y-2.5 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800 ring-1 ring-emerald-200">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={22} className="shrink-0 text-emerald-600" />
                        <div className="min-w-0 leading-tight"><p className="text-sm font-bold">You registered</p><p className="text-xs text-emerald-700">{reg.teamName} · {reg.status === "approved" ? "Confirmed by the host" : "Waiting for the host to confirm"}</p></div>
                      </div>
                      {reg.status === "approved" ? (
                        <a href={`tel:${reg.callPhone ?? site.phone}`} className="flex items-center justify-center gap-2 rounded-full border border-emerald-300 bg-white py-2 text-xs font-semibold text-emerald-800"><Phone size={14} /> Call the host to cancel</a>
                      ) : (
                        <button type="button" disabled={cancelling === reg.id} onClick={() => cancel(reg.id, reg.teamName)} className="w-full rounded-full border border-rose-200 bg-white py-2 text-xs font-semibold text-rose-600 disabled:opacity-60">{cancelling === reg.id ? "Cancelling…" : "Cancel registration"}</button>
                      )}
                      {cancelError && <p role="alert" className="text-xs text-rose-600">{cancelError}</p>}
                    </div>
                  ) : canRegister(t) && (
                    <Link href={registrationPath(t.id)} className="glass-btn mt-4 flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold text-white">Register your team</Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
