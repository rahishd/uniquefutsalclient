"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clapperboard, Clock, Eye, Loader2, Pause, Play, Square, Star, Tv } from "lucide-react";
import { errorText } from "@/lib/api";
import { mediaUrl, trackAd, useContent, type AdItem } from "@/lib/content";
import { openSignIn, useSession } from "@/lib/session";
import { loyaltyStore } from "@/lib/loyalty";
import { RULES, completeView, startView, watchEarnStore } from "@/lib/watchearn";

const TICK_MS = 200;

// Every live ad of every place, once each. The server decides which ads are live right now.
function useAllAds(): AdItem[] {
  const { ads } = useContent();
  const seen = new Set<string>();
  return [...ads.inline, ...ads.popup, ...ads.header, ...ads.footer].filter((a) => !seen.has(a.id) && !!seen.add(a.id));
}

const pts = (n: number) => `${n} loyalty point${n === 1 ? "" : "s"}`;

// Watch & Earn: tap View Ads and keep watching. Each ad runs 15 seconds; 40 ads (10 minutes) = 1 loyalty point.
export default function WatchEarnPage() {
  const session = useSession();
  const registered = session?.registered === true;
  const me = watchEarnStore.use().data ?? null;
  const ads = useAllAds();
  const adsRef = useRef(ads);
  useEffect(() => { adsRef.current = ads; }, [ads]);

  const [watching, setWatching] = useState(false);
  const [paused, setPaused] = useState(false);
  const [step, setStep] = useState(0); // which ad of the session is on screen
  const [elapsed, setElapsed] = useState(0); // ms of the ad on screen
  const [watched, setWatched] = useState(0); // ads counted in this sitting
  const [earned, setEarned] = useState(0); // points earned in this sitting
  const [message, setMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const toward = me?.adsTowardNext ?? 0;
  const adMs = RULES.adSeconds * 1000;
  const ad = watching && ads.length ? ads[step % ads.length] : null;

  // the screen only counts while it is showing: leaving the tab pauses, coming back starts a fresh ad
  useEffect(() => {
    if (!watching) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") setPaused(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [watching]);

  // one ad: ask the server to start it, wait 15 seconds, ask the server to count it, then move on
  useEffect(() => {
    if (!watching || paused) return;
    const list = adsRef.current;
    if (list.length === 0) return;
    const current = list[step % list.length];
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    setElapsed(0);

    (async () => {
      try {
        const v = await startView(current.id);
        if (cancelled) return;
        trackAd(current.id, "view");
        const t0 = Date.now();
        timer = setInterval(async () => {
          const ms = Date.now() - t0;
          if (ms < adMs) return setElapsed(ms);
          clearInterval(timer);
          setElapsed(adMs);
          try {
            const r = await completeView(v.viewId);
            if (cancelled) return;
            watchEarnStore.patch(() => r);
            if (r.counted) setWatched((n) => n + 1);
            if (r.earnedNow > 0) {
              setEarned((n) => n + r.earnedNow);
              loyaltyStore.refresh();
            }
            setStep((s) => s + 1);
          } catch (e) {
            if (cancelled) return;
            setMessage(errorText(e));
            setWatching(false);
          }
        }, TICK_MS);
      } catch (e) {
        if (cancelled) return;
        setMessage(errorText(e));
        setWatching(false);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [watching, paused, step, adMs]);

  function begin() {
    if (!registered) return openSignIn();
    if (adsRef.current.length === 0) {
      setMessage("There are no ads to watch right now. Please check again later.");
      return;
    }
    setMessage(null);
    setStarting(true);
    setWatched(0);
    setEarned(0);
    setStep(0);
    setPaused(false);
    setWatching(true);
    setStarting(false);
  }

  function stop() {
    setWatching(false);
    setPaused(false);
    watchEarnStore.refresh();
  }

  const secondsLeft = Math.max(0, Math.ceil((adMs - elapsed) / 1000));
  const pct = Math.min(100, (elapsed / adMs) * 100);
  const barPct = Math.min(100, (toward / RULES.adsPerPoint) * 100);

  return (
    <div className="mx-auto w-full max-w-xl pb-10">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-[#0c0b5d]">
        <Clapperboard size={22} className="text-brand" aria-hidden /> Watch &amp; Earn
      </h1>
      <p className="mt-1 text-sm text-slate-600">Watch ads and earn loyalty points. {RULES.adsPerPoint} ads = 1 loyalty point.</p>

      <section aria-label="Your progress" className="mt-5 rounded-3xl border border-[#d6e4fb] p-5 shadow-[0_8px_24px_rgba(37,99,235,0.08)]" style={{ background: "linear-gradient(180deg,#f5f9ff 0%,#e6f0ff 100%)" }}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next loyalty point</p>
            <p className="text-3xl font-semibold text-[#0c0b5d]">{toward}<span className="text-lg text-slate-500"> / {RULES.adsPerPoint} ads</span></p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#0c0b5d] ring-1 ring-[#e3ecfa]"><Star size={15} className="text-brand" /> {me?.pointsEarned ?? 0} earned</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white ring-1 ring-[#e3ecfa]" role="progressbar" aria-valuemin={0} aria-valuemax={RULES.adsPerPoint} aria-valuenow={toward} aria-label="Ads towards the next loyalty point">
          <div className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#60a5fa] transition-[width] duration-500" style={{ width: `${barPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-600">{registered && me ? `${me.adsLeftForNext} more ad${me.adsLeftForNext === 1 ? "" : "s"} for the next point` : `Watch ${RULES.adsPerPoint} ads to earn your first point`}</p>
      </section>

      {watching ? (
        <section aria-label="Ad" className="mt-5">
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 shadow-lg" style={{ aspectRatio: "16 / 10" }}>
            {ad && (
              // ads come from the venue's own API, so next/image is not used
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${step}-${ad.id}`} src={mediaUrl(ad.imageUrl)} alt={ad.title} className={`h-full w-full object-cover ${paused ? "opacity-30" : ""}`} />
            )}
            <span className="absolute left-3 top-3 rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Ad · {step + 1}</span>
            {!paused && (
              <span className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-sm font-semibold text-white" aria-live="off">{secondsLeft}</span>
            )}
            {paused && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white">
                <Pause size={32} aria-hidden />
                <p className="text-sm font-medium">Paused. Ads only count while this screen is open.</p>
                <button type="button" onClick={() => { setPaused(false); setStep((s) => s + 1); }} className="glass-btn flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"><Play size={16} /> Keep watching</button>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/25">
              <div className="h-full bg-[#60a5fa]" style={{ width: `${pct}%`, transition: `width ${TICK_MS}ms linear` }} />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
            <span className="flex items-center gap-1.5"><Eye size={15} className="text-brand" /> {watched} ad{watched === 1 ? "" : "s"} watched{earned > 0 ? ` · +${pts(earned)}` : ""}</span>
            <button type="button" onClick={stop} className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"><Square size={13} /> Stop</button>
          </div>
          <p role="status" className="sr-only">{earned > 0 ? `You earned ${pts(earned)}` : ""}</p>
        </section>
      ) : (
        <section className="mt-5">
          <button type="button" onClick={begin} disabled={starting || session === undefined} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-4 text-base font-semibold disabled:opacity-60">
            {starting ? <Loader2 size={18} className="animate-spin" /> : <Tv size={18} />} View Ads
          </button>
          {!registered && session !== undefined && <p className="mt-2 text-center text-xs text-slate-500">Register or sign in to earn loyalty points.</p>}
          {watched > 0 && <p className="mt-3 text-center text-sm font-medium text-[#0c0b5d]">This time: {watched} ad{watched === 1 ? "" : "s"} watched{earned > 0 ? `, +${pts(earned)}` : ""}</p>}
        </section>
      )}

      {message && <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</p>}

      <ol className="mt-6 grid grid-cols-3 gap-2">
        {[
          { icon: <Clock size={20} />, title: `${RULES.adSeconds} seconds`, text: "Every ad runs 15 seconds" },
          { icon: <Eye size={20} />, title: `${RULES.adsPerPoint} ads`, text: `${RULES.minutesPerPoint} minutes of ads` },
          { icon: <Star size={20} />, title: "1 point", text: "Added to your loyalty points" },
        ].map((s) => (
          <li key={s.title} className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#e3ecfa] bg-white px-2 py-3 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-[#0c0b5d]">{s.icon}</span>
            <span className="text-sm font-semibold text-[#0c0b5d]">{s.title}</span>
            <span className="text-[11px] leading-snug text-slate-500">{s.text}</span>
          </li>
        ))}
      </ol>

      {registered && me && (
        <p className="mt-4 text-center text-xs text-slate-500">
          Ads today: {me.todayViews} · All time: {me.totalViews} · Your loyalty balance: {me.balance} · <Link href="/points" className="font-semibold text-brand">See points</Link>
        </p>
      )}
    </div>
  );
}
