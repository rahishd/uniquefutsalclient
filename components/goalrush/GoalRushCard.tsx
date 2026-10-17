"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Gamepad2, Goal, Play, Star, Trophy } from "lucide-react";
import { useSession } from "@/lib/session";
import { RULES, goalRushStore, pts } from "@/lib/goalrush";

const NAVY = "#0c0b5d";

// Home, right under Quick Access: "Unique Goal Rush · Play & Earn". A calm light-blue card in the brand colours: a short
// line about the game, a daylight illustration (the #10 in the navy kit about to strike, the keeper waiting), the three
// steps and the usual light-blue button.
export default function GoalRushCard() {
  const session = useSession();
  const registered = session?.registered === true;
  const me = goalRushStore.use().data ?? null;
  const a = me?.allowance;

  return (
    <section aria-labelledby="goal-rush-heading" className="mt-8 desk:mt-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="goal-rush-heading" className="flex items-center gap-1.5 text-lg font-bold desk:text-xl">
            <Goal size={17} strokeWidth={2.2} className="text-brand" aria-hidden /> Unique Goal Rush
          </h2>
          <p className="text-sm font-semibold text-slate-500">Play &amp; Earn</p>
        </div>
        <Link href="/goal-rush" className="flex items-center text-sm font-semibold text-brand">
          Play <ChevronRight size={16} />
        </Link>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-[#d6e4fb] shadow-[0_8px_24px_rgba(37,99,235,0.08)]" style={{ background: "linear-gradient(180deg,#f5f9ff 0%,#e6f0ff 100%)" }}>
        <div className="px-5 pt-5">
          <span className="inline-block rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-[#0c0b5d]">Mini game · Loyalty points</span>
          <p className="mt-2 text-2xl font-semibold leading-tight text-[#0c0b5d]">Play. Score. Earn.</p>
          <p className="mt-1 text-sm text-slate-600">
            Take {RULES.shotsPerGame} penalties against our goalkeeper. Score {RULES.goalsToQualify} or more and win {pts(RULES.pointsPerGame)}.
          </p>
        </div>

        {/* the illustration keeps its own colours in dark mode, like a photo */}
        <div className="uf-keep mx-4 mt-4 overflow-hidden rounded-2xl border border-white/70" style={{ aspectRatio: "400 / 250" }}>
          <Scene />
        </div>

        <ol className="mt-4 grid grid-cols-3 gap-2 px-4">
          <Step n={1} title="Play" text="Aim and shoot past the keeper" icon={<Gamepad2 size={20} />} />
          <Step n={2} title="Win" text={`Score ${RULES.goalsToQualify}+ of ${RULES.shotsPerGame} shots`} icon={<Trophy size={20} />} />
          <Step n={3} title="Earn" text={`Get ${pts(RULES.pointsPerGame)} a winning game`} icon={<Star size={20} />} />
        </ol>

        <div className="px-4 pb-5 pt-4">
          <Link href="/goal-rush" className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold">
            <Play size={16} /> Play &amp; Earn Now
          </Link>
          <div className="mt-3 flex items-center justify-center gap-3 whitespace-nowrap text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-brand" /> {RULES.gamesPerDay} games a day</span>
            <span aria-hidden className="h-3 w-px bg-slate-300" />
            <span className="flex items-center gap-1.5"><Star size={14} className="text-brand" /> Up to {RULES.maxPointsPerDay} points a day</span>
          </div>
          {registered && a ? (
            <p className="mt-2 text-center text-[11px] text-slate-500">Games Played Today: {a.used}/{a.limit} · Points today: {a.pointsToday}</p>
          ) : !registered ? (
            <p className="mt-2 text-center text-[11px] text-slate-500">Practice as a guest · register to earn points</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Step({ n, title, text, icon }: { n: number; title: string; text: string; icon: React.ReactNode }) {
  return (
    <li className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#e3ecfa] bg-white px-2 py-3 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-[#0c0b5d]">{icon}</span>
      <span className="text-sm font-semibold text-[#0c0b5d]">{n}. {title}</span>
      <span className="text-[11px] leading-snug text-slate-500">{text}</span>
    </li>
  );
}

// A daylight penalty: the stands, the goal, the keeper and the #10 striker (drawn in a 400 x 410 space, the lower part shown).
function Scene() {
  return (
    <svg viewBox="0 150 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden className="block h-full w-full">
      <defs>
        <linearGradient id="grsPitch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9ed7a8" />
          <stop offset="1" stopColor="#74bf84" />
        </linearGradient>
        <pattern id="grsCrowd" width="9" height="7" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.3" fill="#ffffff" fillOpacity="0.55" />
          <circle cx="6.5" cy="5" r="1.2" fill="#0c0b5d" fillOpacity="0.12" />
          <circle cx="5" cy="1.5" r="0.9" fill="#60a5fa" fillOpacity="0.3" />
        </pattern>
        <pattern id="grsNet" width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M0 0 L7 7 M7 0 L0 7" stroke="#64748b" strokeOpacity="0.32" strokeWidth="0.7" />
        </pattern>
        <linearGradient id="grsShirt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d1c86" />
          <stop offset="1" stopColor={NAVY} />
        </linearGradient>
        <linearGradient id="grsKeeper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#86c96f" />
          <stop offset="1" stopColor="#5a9f4b" />
        </linearGradient>
        <radialGradient id="grsBall" cx="0.35" cy="0.3">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e2e8f0" />
        </radialGradient>
      </defs>

      {/* sky and stands */}
      <rect x="0" y="0" width="400" height="410" fill="#e3efff" />
      <path d="M0 120 Q200 100 400 120 L400 190 L0 190 Z" fill="#cddff7" />
      <path d="M0 120 Q200 100 400 120 L400 190 L0 190 Z" fill="url(#grsCrowd)" />
      <path d="M0 150 Q200 134 400 150 M0 172 Q200 160 400 172" stroke="#b7cbe8" strokeWidth="1.5" fill="none" />

      {/* advertising boards */}
      <rect x="0" y="186" width="400" height="12" fill="#ffffff" />
      <text x="14" y="195" fontSize="7" fontWeight="700" fill={NAVY} letterSpacing="2" fontFamily="system-ui, sans-serif">UNIQUE FUTSAL · PLAY · SCORE · EARN · UNIQUE FUTSAL · PLAY · SCORE · EARN</text>

      {/* pitch */}
      <rect x="0" y="198" width="400" height="212" fill="url(#grsPitch)" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${-80 + i * 110} 410 L${40 + i * 70} 198 L${75 + i * 70} 198 L${-25 + i * 110} 410 Z`} fill="#ffffff" fillOpacity="0.07" />
      ))}
      <path d="M0 252 L400 244" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="2" />
      <path d="M188 251 L170 286 L400 279 L400 244" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.8" fill="none" />
      <path d="M100 254 L40 330 L400 316" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.8" fill="none" />

      {/* goal */}
      <rect x="236" y="166" width="166" height="80" fill="#ffffff" fillOpacity="0.28" />
      <rect x="236" y="166" width="166" height="80" fill="url(#grsNet)" />
      <path d="M222 174 L236 166 L236 246 L222 251 Z" fill="url(#grsNet)" />
      <path d="M222 251 L222 174 L404 166" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M224 251 L224 176" stroke="#cbd5e1" strokeWidth="1.5" />

      {/* goalkeeper, ready */}
      <g transform="translate(318 249)">
        <ellipse cx="0" cy="2" rx="24" ry="4" fill="#0f172a" opacity="0.14" />
        <path d="M-7 -30 L-15 -15 L-12 -2" stroke="#334155" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M7 -30 L15 -15 L12 -2" stroke="#334155" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M-14 -12 L-12 -3 M14 -12 L12 -3" stroke="#5a9f4b" strokeWidth="6.5" strokeLinecap="round" />
        <ellipse cx="-14" cy="-1" rx="6" ry="3" fill="#1e293b" />
        <ellipse cx="14" cy="-1" rx="6" ry="3" fill="#1e293b" />
        <rect x="-13" y="-36" width="26" height="10" rx="3" fill="#334155" />
        <path d="M-15 -62 Q0 -66 15 -62 L14 -36 L-14 -36 Z" fill="url(#grsKeeper)" />
        <text x="0" y="-45" textAnchor="middle" fontSize="11" fontWeight="800" fill="#ffffff" fontFamily="system-ui, sans-serif">1</text>
        <path d="M-14 -58 L-30 -50 L-38 -36" stroke="url(#grsKeeper)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M14 -58 L30 -50 L38 -36" stroke="url(#grsKeeper)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="-39" cy="-33" r="5.5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
        <circle cx="39" cy="-33" r="5.5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
        <rect x="-3" y="-69" width="6" height="6" fill="#c08a5c" />
        <circle cx="0" cy="-76" r="9" fill="#d4a373" />
        <path d="M-9 -78 Q-8 -88 0 -87 Q9 -88 9 -78 Q4 -83 -9 -78 Z" fill="#3b2716" />
      </g>

      {/* the #10 striker in the navy kit, from behind */}
      <g transform="translate(-6 34)">
        <ellipse cx="170" cy="352" rx="46" ry="7" fill="#0f172a" opacity="0.14" />
        <path d="M150 284 L138 316" stroke="#ffffff" strokeWidth="15" strokeLinecap="round" />
        <path d="M138 316 L126 344" stroke="#d4a373" strokeWidth="11" strokeLinecap="round" />
        <path d="M134 326 L124 348" stroke={NAVY} strokeWidth="11" strokeLinecap="round" />
        <path d="M112 352 Q120 344 132 350 L130 356 Q120 358 112 356 Z" fill="#1e293b" />
        <path d="M170 282 L192 308" stroke="#ffffff" strokeWidth="15" strokeLinecap="round" />
        <path d="M192 308 L214 326" stroke="#d4a373" strokeWidth="11" strokeLinecap="round" />
        <path d="M200 316 L216 330" stroke={NAVY} strokeWidth="11" strokeLinecap="round" />
        <path d="M212 330 Q222 326 232 334 L228 341 Q218 340 210 337 Z" fill="#1e293b" />
        <path d="M138 262 L180 262 L184 288 L162 292 L160 282 L156 292 L134 288 Z" fill="#ffffff" />
        <path d="M138 262 L180 262 L181 268 L137 268 Z" fill="#e2e8f0" />
        <path d="M136 214 L112 236 L100 256" stroke="url(#grsShirt)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M108 240 L100 256" stroke="#d4a373" strokeWidth="9" strokeLinecap="round" />
        <circle cx="99" cy="259" r="5" fill="#d4a373" />
        <path d="M180 216 L198 238 L206 258" stroke="url(#grsShirt)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M200 244 L206 258" stroke="#d4a373" strokeWidth="9" strokeLinecap="round" />
        <circle cx="207" cy="261" r="5" fill="#d4a373" />
        <path d="M134 214 Q158 204 182 214 L184 264 Q160 270 136 264 Z" fill="url(#grsShirt)" />
        <path d="M134 214 Q158 204 182 214" stroke="#93c5fd" strokeWidth="2" fill="none" />
        <text x="159" y="252" textAnchor="middle" fontSize="28" fontWeight="800" fill="#ffffff" fontFamily="system-ui, sans-serif">10</text>
        <rect x="152" y="195" width="12" height="13" rx="3" fill="#c08a5c" />
        <ellipse cx="143.5" cy="188" rx="3" ry="4.5" fill="#d4a373" />
        <ellipse cx="172.5" cy="188" rx="3" ry="4.5" fill="#d4a373" />
        <circle cx="158" cy="185" r="14.5" fill="#3b2716" />
        <path d="M146 178 Q152 171 160 172 M150 186 Q158 181 167 184" stroke="#5a3d22" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </g>

      {/* the ball */}
      <g transform="translate(-6 34)">
        <path d="M190 318 L164 313 M192 326 L156 325" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="236" cy="334" r="16" fill="url(#grsBall)" stroke="#334155" strokeWidth="1" />
        <path d="M236 327 L242 331.5 L239.6 338.6 L232.4 338.6 L230 331.5 Z" fill="#1e293b" />
        <path d="M236 318 L236 327 M242 331.5 L251 328.6 M239.6 338.6 L245 346 M232.4 338.6 L227 346 M230 331.5 L221 328.6" stroke="#1e293b" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
