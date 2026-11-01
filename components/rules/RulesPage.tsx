"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Armchair, Ban, Banknote, Baby, Bike, CalendarClock, Cctv, ChevronDown, CigaretteOff, Clock, CupSoda, Droplets, Eye, Fence, FileSignature, Footprints, Gamepad2, Gavel, Gem, GlassWater,
  Hammer, Heart, HeartHandshake, Hourglass, MapPin, Megaphone, ParkingCircle, ScrollText, ShieldAlert, ShieldCheck, Shirt, Siren, Sofa, Timer, TriangleAlert, UserX, Users, WineOff,
} from "lucide-react";
import { COMMITMENT, FINES, NOTICE, RULES_INTRO, SECTORS, type Rule, type RuleIcon, type RulePoint, type Sector } from "@/lib/rules";

const ICONS: Record<RuleIcon, LucideIcon> = {
  footprints: Footprints, fence: Fence, alert: TriangleAlert, drink: CupSoda, alcohol: WineOff, smoking: CigaretteOff, child: Baby, jewellery: Gem, furniture: Armchair, dispute: ShieldAlert,
  timer: Timer, seating: Users, changing: Shirt, parking: ParkingCircle, journey: Bike,
  agreement: FileSignature, schedule: CalendarClock, extension: Hourglass, damage: Hammer, water: Droplets, crowd: Megaphone, deck: Sofa, infant: Ban,
  clock: Clock, gamepad: Gamepad2, glass: GlassWater,
};
const NOTICE_ICONS = { monitor: Eye, penalty: Gavel, deny: Ban, suspend: UserX, police: Siren } as const;

// One colour family per sector (full class names, so Tailwind keeps them)
const LOOK = { tile: "bg-slate-100 text-black", num: "bg-black text-white", head: "from-[#eaf3ff] to-[#cbe0ff] ring-[#bfd7ff] text-black", eyebrow: "text-slate-800", big: "text-black/5", dot: "bg-black", soft: "bg-slate-50 ring-slate-200" };
const TONES: Record<Sector["tone"], typeof LOOK> = { blue: LOOK, emerald: LOOK, violet: LOOK, cyan: LOOK };

const ALL_RULES = SECTORS.flatMap((s) => s.rules.map((r) => r.n));

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

// Rules & Regulations: the venue's Code of Conduct, Safety Rules & Tournament Regulations (text in lib/rules.ts).
// Every rule is a card with its own icon that opens to its points; fines are highlighted; the three sectors, the monitoring notice and the commitment follow.
export default function RulesPage() {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const allOpen = open.size === ALL_RULES.length;
  const toggle = (n: number) => setOpen((cur) => { const next = new Set(cur); if (next.has(n)) next.delete(n); else next.add(n); return next; });

  return (
    <div className="space-y-5 pb-4">
      {/* hero */}
      <header className="relative overflow-hidden rounded-3xl bg-white p-5 text-black shadow-sm ring-1 ring-slate-200 desk:p-8">
        <div className="relative flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-black"><ScrollText size={24} /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">Unique Futsal</p>
            <h1 className="mt-1 text-xl font-bold leading-snug desk:text-3xl">{RULES_INTRO.title}</h1>
          </div>
        </div>
        <p className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-semibold text-black"><ShieldCheck size={16} aria-hidden /> {RULES_INTRO.tagline}</p>
        <p className="relative mt-3 text-sm leading-relaxed text-slate-900">{RULES_INTRO.welcome}</p>
      </header>

      {/* fines at a glance */}
      <section aria-label="Penalties at a glance" className="grid gap-3 sm:grid-cols-2">
        {FINES.map((f) => (
          <button key={f.n} type="button" onClick={() => { setOpen((cur) => new Set(cur).add(f.n)); setTimeout(() => jump(`rule-${f.n}`), 50); }}
            className="flex items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-200 transition active:scale-[0.99]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-black"><Banknote size={22} /></span>
            <span className="min-w-0">
              <span className="block text-lg font-extrabold leading-none text-black">{f.fine}</span>
              <span className="mt-1 block text-xs font-semibold text-slate-800">{f.title} · Rule {f.n}</span>
            </span>
          </button>
        ))}
      </section>

      {/* jump to a part, and open or close every rule */}
      <nav aria-label="Jump to" className="flex items-center gap-2">
        <div className="-mx-5 flex min-w-0 flex-1 gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTORS.map((s) => (
            <button key={s.id} type="button" onClick={() => jump(s.id)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black shadow-sm ring-1 ring-slate-200">
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${TONES[s.tone].num}`}>{s.n}</span> {s.short}
            </button>
          ))}
          <button type="button" onClick={() => jump("notice")} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black shadow-sm ring-1 ring-slate-200"><Cctv size={14} /> Notice</button>
        </div>
        <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(ALL_RULES))} className="shrink-0 text-xs font-semibold text-black underline underline-offset-2">{allOpen ? "Close all" : "Open all"}</button>
      </nav>

      {SECTORS.map((s) => <SectorBlock key={s.id} sector={s} open={open} onToggle={toggle} />)}

      {/* monitoring, enforcement and management rights */}
      <section id="notice" aria-label="Important notice" className="scroll-mt-24 overflow-hidden rounded-3xl bg-red-50 text-black shadow-sm ring-1 ring-red-200">
        <div className="flex items-center gap-3 bg-red-100 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-black shadow-sm"><Cctv size={22} /></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-900">Important notice</p>
            <h2 className="text-base font-bold leading-snug">Monitoring, Enforcement &amp; Management Rights</h2>
          </div>
        </div>
        <div className="space-y-3 p-4 text-sm text-black">
          <p className="leading-relaxed">{NOTICE.intro}</p>
          <p className="font-semibold text-black">{NOTICE.lead}</p>
          <ul className="space-y-2">
            {NOTICE.rights.map((r) => {
              const Icon = NOTICE_ICONS[r.icon];
              return (
                <li key={r.text} className="flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-red-100">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-100 text-black"><Icon size={16} /></span>
                  <span className="leading-relaxed">{r.text}</span>
                </li>
              );
            })}
          </ul>
          <p className="flex items-start gap-2 rounded-xl bg-white p-3 font-semibold text-black ring-1 ring-red-100"><HeartHandshake size={18} className="mt-0.5 shrink-0" aria-hidden /> <span>{NOTICE.closing}</span></p>
        </div>
      </section>

      {/* commitment */}
      <section aria-label="Our commitment" className="relative overflow-hidden rounded-3xl bg-white p-5 text-center text-black shadow-sm ring-1 ring-slate-200">
        <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-black"><HeartHandshake size={26} /></span>
        <p className="relative mt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">{COMMITMENT.title}</p>
        <p className="relative mt-2 text-xl font-bold leading-snug">&ldquo;{COMMITMENT.quote}&rdquo;</p>
        <p className="relative mt-3 text-sm leading-relaxed text-slate-900">{COMMITMENT.text}</p>
        <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-black"><Heart size={14} aria-hidden /> {COMMITMENT.thanks}</p>
      </section>

      {/* who is behind the rules */}
      <footer className="rounded-3xl bg-white px-5 py-7 text-center shadow-sm ring-1 ring-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark-navy.png" alt="" aria-hidden className="mx-auto h-12 w-auto" />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700">{COMMITMENT.by}</p>
        <p className="mt-1 text-xl font-extrabold uppercase tracking-wide text-black">{COMMITMENT.org}</p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-800"><MapPin size={13} className="shrink-0" aria-hidden /> {COMMITMENT.address}</p>
      </footer>
    </div>
  );
}

function SectorBlock({ sector, open, onToggle }: { sector: Sector; open: Set<number>; onToggle: (n: number) => void }) {
  const tone = TONES[sector.tone];
  return (
    <section id={sector.id} aria-label={`Sector ${sector.n}: ${sector.title}`} className="scroll-mt-24 space-y-3">
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 shadow-sm ring-1 ${tone.head}`}>
        <span aria-hidden className={`pointer-events-none absolute -right-2 -top-6 select-none text-[88px] font-black leading-none ${tone.big}`}>{sector.n}</span>
        <p className={`relative text-[10px] font-bold uppercase tracking-[0.22em] ${tone.eyebrow}`}>Sector {sector.n}</p>
        <h2 className="relative mt-0.5 text-lg font-bold leading-snug desk:text-xl">{sector.title}</h2>
        {sector.intro && <p className="relative mt-2 text-sm leading-relaxed text-slate-700">{sector.intro}</p>}
      </div>
      <ul className="space-y-2.5">
        {sector.rules.map((r) => <RuleCard key={r.n} rule={r} tone={tone} isOpen={open.has(r.n)} onToggle={() => onToggle(r.n)} />)}
      </ul>
    </section>
  );
}

function RuleCard({ rule, tone, isOpen, onToggle }: { rule: Rule; tone: (typeof TONES)[Sector["tone"]]; isOpen: boolean; onToggle: () => void }) {
  const Icon = ICONS[rule.icon];
  const panel = `rule-panel-${rule.n}`;
  return (
    <li id={`rule-${rule.n}`} className="scroll-mt-24 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <button type="button" onClick={onToggle} aria-expanded={isOpen} aria-controls={panel} className="flex w-full items-center gap-3 p-3.5 text-left">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone.tile}`}><Icon size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ${tone.num}`}>{rule.n}</span>
            {rule.fine && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-black"><Banknote size={11} aria-hidden /> {rule.fine} fine</span>}
          </span>
          <span className="mt-1 block text-[15px] font-semibold leading-snug text-black">{rule.title}</span>
        </span>
        <ChevronDown size={20} className={`shrink-0 text-slate-600 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <div id={panel} role="region" aria-label={rule.title} className={`grid transition-[grid-template-rows] duration-200 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-slate-100 px-3.5 pb-4 pt-3">
            <ul className="space-y-2">
              {rule.points.map((p) => <Point key={typeof p === "string" ? p : p.text} p={p} dot={tone.dot} />)}
            </ul>
            {rule.penalty && (
              <p className="flex items-start gap-2.5 rounded-xl bg-red-50 p-3 text-sm font-semibold leading-relaxed text-black ring-1 ring-red-200">
                <Banknote size={18} className="mt-0.5 shrink-0 text-black" aria-hidden /> <span><span className="font-extrabold">Penalty: </span>{rule.penalty}</span>
              </p>
            )}
            {rule.note && (
              <p className={`flex items-start gap-2.5 rounded-xl p-3 text-sm font-semibold italic leading-relaxed text-black ring-1 ${tone.soft}`}>
                <Heart size={18} className="mt-0.5 shrink-0 text-black" aria-hidden /> <span>{rule.note}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Point({ p, dot }: { p: RulePoint; dot: string }) {
  const text = typeof p === "string" ? p : p.text;
  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-900">
      <span aria-hidden className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0">
        {text}
        {typeof p !== "string" && (
          <ul className="mt-2 space-y-1.5">
            {p.sub.map((s) => {
              const [head, ...rest] = s.split(": ");
              return <li key={s} className="rounded-lg bg-slate-50 px-3 py-2 text-[13px]"><span className="font-semibold text-slate-900">{head}</span>{rest.length ? `: ${rest.join(": ")}` : ""}</li>;
            })}
          </ul>
        )}
      </span>
    </li>
  );
}
