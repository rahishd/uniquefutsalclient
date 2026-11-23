"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Coins, Dices, Play, Trophy, Users } from "lucide-react";
import { useSession } from "@/lib/session";
import { DEFAULT_RULES, ludoStore } from "@/lib/ludo";
import Board from "@/components/ludo/Board";

const PREVIEW = [[-1, 12, 30, 0], [-1, -1, 7, 44], [3, -1, 22, 56], [-1, 18, 52, 38]];

// Home, right under Quick Access: "Unique Ludo · Play. Compete. Win." A calm light-blue card in the brand colours with a
// board preview, the fee and the reward, and the usual button. (It replaced the Goal Rush card.)
export default function LudoCard() {
  const session = useSession();
  const registered = session?.registered === true;
  const me = ludoStore.use().data ?? null;
  const r = me?.rules ?? DEFAULT_RULES;

  return (
    <section aria-labelledby="ludo-heading" className="mt-8 desk:mt-10 desk:first:mt-0 desk:flex desk:h-full desk:flex-col">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="ludo-heading" className="flex items-center gap-1.5 text-lg font-bold desk:text-xl">
            <Dices size={17} strokeWidth={2.2} className="text-brand" aria-hidden /> Unique Ludo
          </h2>
          <p className="text-sm font-semibold text-slate-500">Play. Compete. Win.</p>
        </div>
        <Link href="/ludo" className="flex items-center text-sm font-semibold text-brand">
          Play <ChevronRight size={16} />
        </Link>
      </div>

      <div className="mt-4 grid gap-4 overflow-hidden rounded-3xl border border-[#d6e4fb] p-4 shadow-[0_8px_24px_rgba(37,99,235,0.08)] desk:flex-1 desk:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] desk:items-center desk:gap-8 desk:p-6" style={{ background: "linear-gradient(180deg,#f5f9ff 0%,#e6f0ff 100%)" }}>
        <div className="uf-keep mx-auto w-full max-w-[16rem] overflow-hidden rounded-2xl border border-white/80 shadow-[0_14px_30px_-14px_rgba(12,11,93,0.5)]" aria-hidden>
          <Board tokens={PREVIEW} colors={[0, 1, 2, 3]} label="Ludo board" />
        </div>
        <div>
          <span className="inline-block rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-[#0c0b5d]">Online board game · Loyalty points</span>
          <p className="mt-2 text-2xl font-semibold leading-tight text-[#0c0b5d]">Roll. Capture. Win points.</p>
          <p className="mt-1 text-sm text-slate-600">
            Play solo against the computer or race your friends in a private room. Entry {r.entryFee} Loyalty Point, the winner earns {r.winReward}.
          </p>
          <ul className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-[#0c0b5d]">
            <li className="rounded-2xl border border-[#e3ecfa] bg-white px-2 py-2.5"><Coins size={16} className="mx-auto mb-1 text-brand" />Entry {r.entryFee} point</li>
            <li className="rounded-2xl border border-[#e3ecfa] bg-white px-2 py-2.5"><Trophy size={16} className="mx-auto mb-1 text-brand" />Win +{r.winReward} points</li>
            <li className="rounded-2xl border border-[#e3ecfa] bg-white px-2 py-2.5"><Users size={16} className="mx-auto mb-1 text-brand" />2 to 4 players</li>
          </ul>
          <Link href="/ludo" className="glass-btn mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold">
            <Play size={16} /> Play Unique Ludo
          </Link>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
            <CalendarDays size={12} />
            {registered && me ? `Solo ${me.limits.solo.used}/${me.limits.solo.limit} · Multiplayer ${me.limits.multi.used}/${me.limits.multi.limit} games played today` : `${r.soloLimit} solo and ${r.multiLimit} multiplayer games a day`}
          </p>
        </div>
      </div>
    </section>
  );
}
