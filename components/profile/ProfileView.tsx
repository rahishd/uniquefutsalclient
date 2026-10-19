"use client";

import { useRef, useState } from "react";
import HeaderToggles from "@/components/HeaderToggles";
import EmergencyContactCard from "@/components/emergency/EmergencyContactCard";
import Link from "next/link";
import { CalendarCheck, Camera, Check, ChevronDown, ChevronRight, Crown, Layers, Loader2, LogOut, Pencil, Receipt, Settings as SettingsIcon, Trophy, UserRound, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { openSignIn, signOut, useSession } from "@/lib/session";
import { useTeams } from "@/lib/teams";
import { setPref, usePrefs } from "@/lib/prefs";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { fmtPts } from "@/lib/points";
import { loyaltyStore } from "@/lib/loyalty";
import { POSITIONS, profileStore, removeAvatar, saveProfile, squarePhoto, uploadAvatar } from "@/lib/profile";
import { useRecords } from "@/components/profile/ProfileRecords";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import { CaptainSummary, ModeToggle } from "@/components/captain/CaptainProfile";
import AccountSecurity from "@/components/profile/AccountSecurity";
import DigitalIdButton from "@/components/digitalid/DigitalIdButton";
import { myMembershipStore } from "@/lib/membership";
import { dobKey, dobOk } from "@/lib/age";

// A card that opens and closes: tap the heading. Closed, it still shows a one-line summary.
function DropCard({ id, title, summary, icon, open, onToggle, children }: { id?: string; title: string; summary: string; icon?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section id={id} className="glass rounded-3xl">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 p-5 text-left">
        <span className="min-w-0">
          <span className="block text-base font-medium">{title}</span>
          <span className="block truncate text-xs text-slate-400">{summary}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">{icon}<ChevronDown size={20} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} /></span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

// A record card on Profile: the title and a one-line summary. Tap it to open the detail page.
function RecordCard({ href, title, summary, icon }: { href: string; title: string; summary: string; icon?: React.ReactNode }) {
  return (
    <Link href={href} className="glass flex items-center justify-between gap-3 rounded-3xl p-5 transition active:scale-[0.99]">
      <span className="min-w-0">
        <span className="block text-base font-medium">{title}</span>
        <span className="block truncate text-xs text-slate-400">{summary}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">{icon}<ChevronRight size={20} className="text-slate-400" /></span>
    </Link>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

const input = "w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand";

// Registered customers see their profile; guests are asked to sign in.
export default function ProfileView() {
  const session = useSession();
  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;
  if (!session.registered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand"><UserRound size={34} /></span>
        <h1 className="mt-6 text-2xl font-semibold">You&apos;re browsing as a guest</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Sign in to see your bookings and points, and to book without typing your details each time.</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
        <Link href="/book" className="mt-4 text-sm font-medium text-brand">Continue to book as a guest</Link>
      </div>
    );
  }
  return <RegisteredProfile />;
}

function RegisteredProfile() {
  const teams = useTeams();
  const captainMode = teams?.mode === "captain";
  const profileState = profileStore.use();
  const profile = profileState.data ?? null;
  const rec = useRecords();
  const loy = loyaltyStore.use().data ?? null;
  const membership = myMembershipStore.use().data?.current ?? null;
  const prefs = usePrefs();
  const t = useT();
  const [lang, setLang] = useLang();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", location: "", position: "", dob: "" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (profileState.status === "error") return <p role="alert" className="glass rounded-3xl px-4 py-10 text-center text-sm text-rose-600">{profileState.error}</p>;
  if (!profile || !rec) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  const registeredSince = new Date(profile.registeredAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const canSave = draft.name.trim().length >= 2 && (!draft.dob || dobOk(draft.dob));

  async function choosePhoto(file: File | null) {
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await uploadAvatar(await squarePhoto(file));
    } catch (err) {
      setPhotoError(errorText(err));
    } finally {
      setPhotoBusy(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  async function dropPhoto() {
    if (photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await removeAvatar();
    } catch (err) {
      setPhotoError(errorText(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveProfile({ name: draft.name.trim(), email: draft.email.trim(), location: draft.location.trim(), position: draft.position, dateOfBirth: profile?.dateOfBirth ? undefined : draft.dob });
      setEditing(false);
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 desk:grid desk:grid-cols-2 desk:items-start desk:gap-6 desk:space-y-0">
      <h1 className="text-2xl font-semibold desk:col-span-2 desk:text-3xl">Profile</h1>

      {/* Identity */}
      <section className={`rounded-3xl p-5 desk:col-span-2 ${profile.vip ? "border border-rose-300 bg-rose-100 shadow-[0_4px_20px_rgba(225,29,72,0.15)]" : "glass"}`}>
        <div className="flex items-center gap-4">
          {/* tap the picture to choose a photo from the phone's gallery or camera */}
          <div className="relative shrink-0">
            <ProfileAvatar name={profile.name} captain={captainMode} size={72} src={profile.avatar} />
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              disabled={photoBusy}
              aria-label={profile.avatar ? "Change profile photo" : "Add a profile photo"}
              className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white shadow ring-2 ring-white disabled:opacity-60"
            >
              {photoBusy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
            </button>
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Profile photo" onChange={(e) => void choosePhoto(e.target.files?.[0] ?? null)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-medium">{profile.name}</p>
            <p className="text-sm text-slate-500">{profile.phone}</p>
            <p className="text-xs text-slate-400">ID {profile.customerCode} · Since {registeredSince}{profile.age !== null && profile.age !== undefined ? ` · Age ${profile.age}` : ""}</p>
            {profile.avatar && (
              <button type="button" onClick={() => void dropPhoto()} disabled={photoBusy} className="mt-1 text-xs font-medium text-rose-500 disabled:opacity-60">Remove photo</button>
            )}
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => { setDraft({ name: profile.name, email: profile.email ?? "", location: profile.location ?? "", position: profile.position ?? "", dob: "" }); setSaveError(null); setEditing(true); }}
              aria-label="Edit profile"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-brand"
            >
              <Pencil size={18} />
            </button>
          )}
        </div>

        {photoError && <p role="alert" className="mt-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{photoError}</p>}

        {/* language and dark mode (moved here from the top bar) */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200/70 pt-4 [&_button]:h-12 [&_button]:w-12 [&_button]:text-base [&_svg]:h-6 [&_svg]:w-6">
          <span className="text-base text-slate-500">Dark Mode &amp; Language</span>
          <HeaderToggles />
        </div>

        {editing && (
          <form className="mt-5 space-y-3" onSubmit={save}>
            <input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Full name" aria-label="Full name" />
            <input className={`${input} opacity-60`} value={profile.phone} readOnly aria-label="Mobile number (cannot be changed here)" />
            <p className="-mt-1 text-[11px] text-slate-400">To change your mobile number, please contact the venue.</p>
            <input className={input} type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" aria-label="Email" />
            <input className={input} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Location" aria-label="Location" />
            {profile.dateOfBirth ? (
              <>
                <input className={`${input} opacity-60`} value={profile.dateOfBirth} readOnly aria-label="Date of birth (cannot be changed here)" />
                <p className="-mt-1 text-[11px] text-slate-400">To change your date of birth, please contact the venue.</p>
              </>
            ) : (
              <>
                <label className="block text-[11px] text-slate-400">Date of birth (needed for age-group games; saved once)</label>
                <input className={input} type="date" value={draft.dob} min={dobKey(100)} max={dobKey(5)} onChange={(e) => setDraft({ ...draft, dob: e.target.value })} aria-label="Date of birth" />
              </>
            )}
            <select className={input} value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} aria-label="Preferred position">
              <option value="">Preferred position</option>
              {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {saveError && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{saveError}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setEditing(false)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/70 py-3 text-sm font-medium text-slate-600"><X size={16} /> Cancel</button>
              <button type="submit" disabled={!canSave || saving} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-brand py-3 text-sm font-medium text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save</button>
            </div>
          </form>
        )}
      </section>

      <EmergencyContactCard />

      <div className="desk:col-span-2"><ModeToggle /></div>
      {captainMode && <div className="desk:col-span-2"><CaptainSummary /></div>}

      {!captainMode && (<>
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 text-center desk:col-span-2">
        {([
          ["Games", rec.played.length, "/profile/games", "Open my played games"],
          ["Upcoming", rec.upcomingList.length, rec.ownUpcoming.length > 0 || !rec.upcomingList.some((b) => b.bulk) ? "/profile/bookings" : "/profile/bulk", "Open my upcoming bookings"],
          ["Points", loy ? fmtPts(loy.remaining) : "–", "/points", "Open my loyalty points"],
        ] as const).map(([k, v, href, label]) => (
          <Link key={k} href={href} aria-label={`${label}: ${v}`} className="glass block rounded-2xl py-4 transition hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-brand active:scale-[0.97]">
            <p className="text-xl font-semibold">{v}</p>
            <p className="text-[11px] text-slate-400">{k}</p>
          </Link>
        ))}
      </div>

      <div className="desk:col-span-2"><DigitalIdButton variant="row" /></div>

      {/* Record cards: tap one to open its detail page */}
      <RecordCard
        href="/member"
        title="Membership"
        summary={membership ? `${membership.plan}: ${membership.status === "active" ? `active until ${new Date(membership.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "waiting for your payment at the venue"}` : "No membership yet"}
        icon={<Crown size={20} className="text-brand" />}
      />
      <RecordCard href="/profile/bookings" title="My bookings" summary={rec.summary.bookings} icon={<CalendarCheck size={20} className="text-brand" />} />
      <RecordCard href="/profile/bulk" title="Bulk Booking" summary={rec.summary.bulk} icon={<Layers size={20} className="text-brand" />} />
      <RecordCard href="/profile/games" title="Games played" summary={rec.summary.games} icon={<Trophy size={20} className="text-amber-500" />} />
      <RecordCard href="/profile/payments" title="Payment history" summary={rec.summary.payments} icon={<Receipt size={20} className="text-brand" />} />

      </>)}

      {/* Settings */}
      <DropCard id="sec-settings" title={t("Settings")} summary="Reminders, alerts, password and language" icon={<SettingsIcon size={20} className="text-brand" />} open={settingsOpen} onToggle={() => setSettingsOpen((o) => !o)}>
        <ul className="space-y-4 text-sm">
          <li className="flex items-center justify-between gap-4"><span>{t("Pop-up reminder")}<span className="block text-xs text-slate-400">Full-screen slider 1 hour before your game, to tell the venue &ldquo;I&apos;m coming&rdquo;</span></span><Switch checked={prefs.popup} onChange={(v) => setPref("popup", v)} label="Pop-up reminder, 1 hour before your game" /></li>
          <li className="flex items-center justify-between gap-4"><span>{t("Promotional notifications")}<span className="block text-xs text-slate-400">{t("Offers and tournaments")}</span></span><Switch checked={prefs.promos} onChange={(v) => setPref("promos", v)} label="Promotional notifications" /></li>
          <AccountSecurity />
          <li className="flex items-center justify-between gap-4"><label htmlFor="lang">{t("Language")}</label>
            <select id="lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-xl bg-white/70 px-3 py-2 text-sm outline-none ring-1 ring-white/80">
              <option value="en">English</option><option value="ne">नेपाली</option>
            </select>
          </li>
        </ul>
      </DropCard>

      <button type="button" onClick={signOut} className="glass flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-rose-500 desk:col-span-2"><LogOut size={16} /> {t("Sign out")}</button>
    </div>
  );
}
