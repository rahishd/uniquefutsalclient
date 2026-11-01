"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, BedDouble, CalendarCheck, Check, Droplets, Flame, HeartPulse, Loader2, Lock, Scale, Trophy, Zap } from "lucide-react";
import { BarChart, LineChart, Ring } from "@/components/health/HealthCharts";
import { useSession } from "@/lib/session";
import {
  DAY_LONG, DAY_NAMES, ENERGY_WORDS, GAME_WORDS, MOOD_WORDS, SORE_WORDS, addDays, dayOfWeek, gamesByWeek, healthStore, hourLabel, lastDays, readiness, saveCheckIn, savePlan, shortDate, streak, summary,
  type HealthData, type HealthLog, type HealthPlan,
} from "@/lib/health";

const card = "rounded-3xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200";
const head = "rounded-3xl border border-[#bfd7ff] bg-gradient-to-br from-[#eaf3ff] via-[#dbeaff] to-[#cbe0ff] p-4 text-black ring-2 ring-white/80 shadow-[0_8px_20px_-12px_rgba(59,130,246,0.45)]";
const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-[#3345b0]";
const TONE = { good: "#16a34a", ok: "#d97706", rest: "#dc2626" } as const;
const TONE_BG = { good: "bg-emerald-100", ok: "bg-amber-100", rest: "bg-red-100" } as const;
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
const avgText = (v: number | null, d = 1) => (v == null ? "-" : v.toFixed(d).replace(/\.0$/, ""));

export default function HealthPage() {
  const session = useSession();
  const store = healthStore.use();
  const data = store.data ?? null;

  if (session && !session.registered) {
    return (
      <div className="space-y-4">
        <Title />
        <div className={`${card} flex items-center gap-3`}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100"><Lock size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Sign in to track your health</p>
            <p className="text-sm text-slate-700">Your check-ins and play plan are saved to your account and are private to you.</p>
          </div>
          <Link href="/login" className="shrink-0 rounded-full bg-[#0c0b5d] px-4 py-2 text-sm font-semibold text-white">Sign in</Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Title />
        {store.status === "error" ? <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{store.error ?? "Could not load your health."}</p> : <p className="flex items-center gap-2 text-sm text-slate-700"><Loader2 size={16} className="animate-spin" /> Loading…</p>}
      </div>
    );
  }
  return <Loaded data={data} />;
}

function Title() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-black shadow-sm ring-1 ring-slate-200"><HeartPulse size={22} /></span>
      <div>
        <h1 className="text-2xl font-bold text-black">My Health</h1>
        <p className="text-sm text-slate-700">Check in every day, see how your body is doing, and plan your game days.</p>
      </div>
    </div>
  );
}

function Loaded({ data }: { data: HealthData }) {
  const [pick, setPick] = useState<string | null>(null);
  const day = pick ?? data.today;
  const log = data.logs.find((l) => l.day === day) ?? null;
  const todayLog = data.logs.find((l) => l.day === data.today) ?? null;
  const ready = readiness(todayLog, data.plan);
  const run = streak(data);
  const options = Array.from({ length: 7 }, (_, i) => addDays(data.today, -i));

  return (
    <div className="space-y-4 pb-6">
      <Title />

      <section aria-label="Today" className={head}>
        <div className="flex items-center gap-4">
          {ready ? <Ring value={ready.score} color={TONE[ready.tone]} /> : <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-white ring-1 ring-slate-200"><Activity size={32} /></span>}
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700">Today</p>
            <p className="text-xl font-extrabold leading-tight">{ready ? ready.label : "No check-in yet"}</p>
            <p className="mt-1 text-sm text-slate-900">{ready ? ready.tip : "Fill in today's check-in below to see how ready you are to play."}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold"><Flame size={13} /> {run} day{run === 1 ? "" : "s"} in a row</p>
          </div>
        </div>
      </section>

      <NextGame data={data} />

      <section aria-label="Check-in" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Daily check-in</h2>
          <label className="text-sm">
            <span className="sr-only">Day</span>
            <select value={day} onChange={(e) => setPick(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-black">
              {options.map((d) => <option key={d} value={d}>{d === data.today ? "Today" : d === addDays(data.today, -1) ? "Yesterday" : shortDate(d)}</option>)}
            </select>
          </label>
        </div>
        <CheckInForm key={day + JSON.stringify(log)} day={day} initial={log} gamesThatDay={data.games.filter((g) => g.date === day).length} />
      </section>

      <Overview data={data} />
      <PlanCard key={JSON.stringify(data.plan)} plan={data.plan} />
    </div>
  );
}

// The next day of the plan (today counts while the reminder hour is still ahead), and a button to book it.
function NextGame({ data }: { data: HealthData }) {
  const days = data.plan.playDays;
  if (days.length === 0) return null;
  const playedToday = data.games.some((g) => g.date === data.today);
  let offset = 0;
  for (let i = playedToday ? 1 : 0; i < 8; i++) {
    if (days.includes(dayOfWeek(addDays(data.today, i)))) { offset = i; break; }
  }
  const when = addDays(data.today, offset);
  return (
    <section aria-label="Next game day" className={`${card} flex items-center gap-3`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100"><CalendarCheck size={22} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Next play day</p>
        <p className="font-bold">{offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : DAY_LONG[dayOfWeek(when)]}, {shortDate(when)}</p>
      </div>
      <Link href="/book" className="shrink-0 rounded-full bg-[#0c0b5d] px-4 py-2 text-sm font-semibold text-white">Book a slot</Link>
    </section>
  );
}

// A 1 to 5 scale shown as numbered buttons; the word for the chosen number is shown next to the label.
function Scale5({ label, value, onChange, words, icon }: { label: string; value: number | null; onChange: (v: number | null) => void; words: string[]; icon: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="flex items-center gap-1.5 text-sm font-semibold">{icon} {label}{value ? <span className="font-normal text-slate-700"> · {words[value - 1]}</span> : null}</legend>
      <div className="mt-1.5 grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} aria-label={`${label}: ${n}, ${words[n - 1]}`} onClick={() => onChange(value === n ? null : n)}
            className={`rounded-xl py-2.5 text-base font-bold ring-1 transition ${value === n ? "bg-[#0c0b5d] text-white ring-[#0c0b5d]" : "bg-slate-50 text-black ring-slate-200"}`}>{n}</button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>{words[0]}</span><span>{words[4]}</span></div>
    </fieldset>
  );
}

function CheckInForm({ day, initial, gamesThatDay }: { day: string; initial: HealthLog | null; gamesThatDay: number }) {
  const [sleep, setSleep] = useState(initial?.sleepHours != null ? String(initial.sleepHours) : "");
  const [water, setWater] = useState<number | null>(initial?.water ?? null);
  const [energy, setEnergy] = useState<number | null>(initial?.energy ?? null);
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [sore, setSore] = useState<number | null>(initial?.soreness ?? null);
  const [perf, setPerf] = useState<number | null>(initial?.performance ?? null);
  const [weight, setWeight] = useState(initial?.weightKg != null ? String(initial.weightKg) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setError(""); setSaved(false);
    try {
      await saveCheckIn({ day, sleepHours: sleep.trim() ? Number(sleep) : null, water, energy, mood, soreness: sore, performance: perf, weightKg: weight.trim() ? Number(weight) : null, note });
      setSaved(true);
    } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold"><span className="flex items-center gap-1.5"><BedDouble size={15} /> Sleep (hours)</span>
          <input value={sleep} onChange={(e) => setSleep(e.target.value)} inputMode="decimal" placeholder="7.5" className={`${input} mt-1.5`} /></label>
        <label className="text-sm font-semibold"><span className="flex items-center gap-1.5"><Scale size={15} /> Weight (kg)</span>
          <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="optional" className={`${input} mt-1.5`} /></label>
      </div>

      <fieldset>
        <legend className="flex items-center gap-1.5 text-sm font-semibold"><Droplets size={15} /> Water (glasses){water != null ? <span className="font-normal text-slate-700"> · {water}</span> : null}</legend>
        <div className="mt-1.5 flex items-center gap-2">
          <button type="button" aria-label="Less water" onClick={() => setWater(Math.max(0, (water ?? 0) - 1))} className="h-10 w-10 rounded-xl bg-slate-100 text-lg font-bold ring-1 ring-slate-200">−</button>
          <div className="flex min-h-10 flex-1 flex-wrap items-center gap-1 rounded-xl bg-slate-50 px-2 py-1 ring-1 ring-slate-200" aria-hidden>
            {Array.from({ length: Math.max(8, water ?? 0) }, (_, i) => <Droplets key={i} size={16} className={i < (water ?? 0) ? "text-[#3345b0]" : "text-slate-300"} />)}
          </div>
          <button type="button" aria-label="More water" onClick={() => setWater(Math.min(30, (water ?? 0) + 1))} className="h-10 w-10 rounded-xl bg-slate-100 text-lg font-bold ring-1 ring-slate-200">+</button>
        </div>
      </fieldset>

      <Scale5 label="Energy" value={energy} onChange={setEnergy} words={ENERGY_WORDS} icon={<Zap size={15} />} />
      <Scale5 label="Mood" value={mood} onChange={setMood} words={MOOD_WORDS} icon={<HeartPulse size={15} />} />
      <Scale5 label="Muscle soreness" value={sore} onChange={setSore} words={SORE_WORDS} icon={<Activity size={15} />} />
      <Scale5 label={gamesThatDay > 0 ? "How did you play?" : "How did you play? (if you played)"} value={perf} onChange={setPerf} words={GAME_WORDS} icon={<Trophy size={15} />} />

      <label className="block text-sm font-semibold">Note
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} placeholder="Anything to remember: a knock, tired legs, a great goal…" className={`${input} mt-1.5`} /></label>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><Check size={15} /> Saved</p>}
      <button type="button" onClick={save} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c0b5d] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save check-in
      </button>
    </div>
  );
}

function Overview({ data }: { data: HealthData }) {
  const [span, setSpan] = useState<7 | 30>(7);
  const days = lastDays(data, span);
  const labels = days.map((d) => shortDate(d.day));
  const s = summary(data, span);
  const weeks = gamesByWeek(data, 8);
  const weights = days.map((d) => d.log?.weightKg ?? null);
  const tiles: { icon: React.ReactNode; label: string; value: string; sub: string }[] = [
    { icon: <BedDouble size={18} />, label: "Sleep", value: avgText(s.sleep), sub: `hrs · goal ${data.plan.sleepGoal}` },
    { icon: <Droplets size={18} />, label: "Water", value: avgText(s.water), sub: `glasses · goal ${data.plan.waterGoal}` },
    { icon: <Zap size={18} />, label: "Energy", value: avgText(s.energy), sub: "out of 5" },
    { icon: <Trophy size={18} />, label: "Games", value: String(s.games), sub: `${s.hours} hr played` },
  ];

  return (
    <section aria-label="Health overview" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-black">How you are doing</h2>
        <div role="group" aria-label="Period" className="flex rounded-full bg-white p-0.5 ring-1 ring-slate-200">
          {([7, 30] as const).map((n) => <button key={n} type="button" aria-pressed={span === n} onClick={() => setSpan(n)} className={`rounded-full px-3 py-1 text-xs font-semibold ${span === n ? "bg-[#0c0b5d] text-white" : "text-black"}`}>{n} days</button>)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={card}>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">{t.icon} {t.label}</p>
            <p className="mt-1 text-2xl font-extrabold leading-none">{t.value}</p>
            <p className="mt-1 text-[11px] text-slate-700">{t.sub}</p>
          </div>
        ))}
      </div>

      <Strip days={days} plan={data.plan} />

      <div className={card}>
        <h3 className="text-sm font-bold">Sleep (hours)</h3>
        <LineChart series={[{ name: "Sleep", color: "#3345b0", values: days.map((d) => d.log?.sleepHours ?? null) }]} labels={labels} min={0} max={12} goal={data.plan.sleepGoal} label="Sleep hours per day" />
        <p className="text-[11px] text-slate-700">Dashed line: your sleep goal.</p>
      </div>
      <div className={card}>
        <h3 className="text-sm font-bold">Water (glasses)</h3>
        <BarChart values={days.map((d) => d.log?.water ?? null)} labels={labels} max={Math.max(12, data.plan.waterGoal + 2)} goal={data.plan.waterGoal} color="#38bdf8" label="Glasses of water per day" />
        <p className="text-[11px] text-slate-700">Dashed line: your water goal.</p>
      </div>
      <div className={card}>
        <h3 className="text-sm font-bold">Energy, mood and soreness</h3>
        <LineChart
          series={[
            { name: "Energy", color: "#16a34a", values: days.map((d) => d.log?.energy ?? null) },
            { name: "Mood", color: "#3345b0", values: days.map((d) => d.log?.mood ?? null) },
            { name: "Soreness", color: "#dc2626", values: days.map((d) => d.log?.soreness ?? null) },
          ]}
          labels={labels} min={1} max={5} label="Energy, mood and soreness per day" />
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-800">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#16a34a]" /> Energy</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#3345b0]" /> Mood</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#dc2626]" /> Soreness (lower is better)</span>
        </p>
      </div>
      <div className={card}>
        <h3 className="text-sm font-bold">How you played</h3>
        <LineChart series={[{ name: "Game rating", color: "#d97706", values: days.map((d) => d.log?.performance ?? null) }]} labels={labels} min={1} max={5} label="Game rating per day" />
        <p className="text-[11px] text-slate-700">1 = played low, 5 = played great. Average: {avgText(s.performance)}{s.performance != null ? ` (${GAME_WORDS[Math.round(s.performance) - 1]})` : ""}</p>
      </div>
      <div className={card}>
        <h3 className="text-sm font-bold">Games per week</h3>
        <BarChart values={weeks.map((w) => w.games)} labels={weeks.map((w) => w.label)} max={Math.max(4, ...weeks.map((w) => w.games)) + 1} goal={data.plan.playDays.length || undefined} color="#0c0b5d" label="Games played per week" />
        <p className="text-[11px] text-slate-700">Last 8 weeks.{data.plan.playDays.length ? " Dashed line: your plan." : ""}</p>
      </div>
      {weights.filter((w) => w != null).length >= 2 && (
        <div className={card}>
          <h3 className="text-sm font-bold">Weight (kg)</h3>
          <LineChart series={[{ name: "Weight", color: "#0c0b5d", values: weights }]} labels={labels} min={Math.floor(Math.min(...(weights.filter((w) => w != null) as number[])) - 2)} max={Math.ceil(Math.max(...(weights.filter((w) => w != null) as number[])) + 2)} label="Weight per day" />
        </div>
      )}
    </section>
  );
}

// One dot per day: the colour is that day's readiness, a ball marks a game, grey is "no check-in".
function Strip({ days, plan }: { days: ReturnType<typeof lastDays>; plan: HealthPlan }) {
  const shown = days.slice(-14);
  return (
    <div className={card}>
      <h3 className="text-sm font-bold">Last 14 days</h3>
      <ul className="mt-2 grid grid-cols-7 gap-x-1 gap-y-2">
        {shown.map((d) => {
          const r = readiness(d.log, plan);
          return (
            <li key={d.day} className="flex flex-col items-center gap-0.5" title={`${shortDate(d.day)}${r ? `: ${r.label} (${r.score})` : ": no check-in"}${d.games ? ", played" : ""}`}>
              <span className="text-[10px] text-slate-700">{DAY_NAMES[dayOfWeek(d.day)]}</span>
              <span className={`relative grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold ${r ? `${TONE_BG[r.tone]} text-black` : "bg-slate-100 text-slate-500"}`}>
                {r ? r.score : "·"}
                {d.games > 0 && <span aria-label="Played a game" className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[#0c0b5d] text-[9px] text-white">⚽</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-800">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-300" /> Ready</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-300" /> Take it easy</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-red-300" /> Rest</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-slate-300" /> No check-in</span>
      </p>
    </div>
  );
}

function PlanCard({ plan }: { plan: HealthPlan }) {
  const [days, setDays] = useState<number[]>(plan.playDays);
  const [hour, setHour] = useState(plan.remindHour);
  const [remind, setRemind] = useState(plan.remind);
  const [sleepGoal, setSleepGoal] = useState(String(plan.sleepGoal));
  const [waterGoal, setWaterGoal] = useState(String(plan.waterGoal));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const toggle = (d: number) => setDays((x) => (x.includes(d) ? x.filter((v) => v !== d) : [...x, d].sort()));
  async function save() {
    setBusy(true); setError(""); setSaved(false);
    try {
      await savePlan({ playDays: days, remindHour: hour, remind, sleepGoal: Number(sleepGoal) || 8, waterGoal: Number(waterGoal) || 8 });
      setSaved(true);
    } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  }

  return (
    <section aria-label="Play plan and reminders" className={card}>
      <h2 className="text-lg font-bold">My play plan</h2>
      <p className="text-sm text-slate-700">Pick the days you want to play. On those days we remind you on the Home screen to book your game.</p>

      <div className="mt-3 grid grid-cols-7 gap-1.5" role="group" aria-label="Play days">
        {DAY_NAMES.map((n, d) => (
          <button key={n} type="button" aria-pressed={days.includes(d)} onClick={() => toggle(d)} className={`rounded-xl py-2.5 text-xs font-bold ring-1 ${days.includes(d) ? "bg-[#0c0b5d] text-white ring-[#0c0b5d]" : "bg-slate-50 text-black ring-slate-200"}`}>{n}</button>
        ))}
      </div>

      <label className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
        <span className="text-sm font-semibold">Remind me to book</span>
        <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} className="h-5 w-5 accent-[#0c0b5d]" />
      </label>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <label className="text-xs font-semibold">Remind at
          <select value={hour} onChange={(e) => setHour(Number(e.target.value))} disabled={!remind} className={`${input} mt-1.5`}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select></label>
        <label className="text-xs font-semibold">Sleep goal (hrs)
          <input value={sleepGoal} onChange={(e) => setSleepGoal(e.target.value)} inputMode="decimal" className={`${input} mt-1.5`} /></label>
        <label className="text-xs font-semibold">Water goal (glasses)
          <input value={waterGoal} onChange={(e) => setWaterGoal(e.target.value)} inputMode="numeric" className={`${input} mt-1.5`} /></label>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><Check size={15} /> Plan saved</p>}
      <button type="button" onClick={save} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c0b5d] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save plan
      </button>
    </section>
  );
}
