"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCw, Radio, X } from "lucide-react";
import { tournamentStore, type TieMatch } from "@/lib/tournament";

// Home, phone: while a tournament match is being played, a small card with the live score and a "Watch live" button, between the banner and
// the weather card. It is not there when nothing is live. The score comes from the venue's live updates (refreshed every 30 seconds).
// "Watch live" plays the organizer's Facebook live video inside the app (no leaving to Facebook), full screen, with a rotate button and a
// close button at the top right.
const score = (n: number | null) => (n === null ? 0 : n);
// The address of the player of a live video, by site. Facebook plays any public video; TikTok and Instagram play a video, reel or post link,
// but neither site lets an ongoing live stream (the @name/live address) be played inside another app: then src is null.
function embed(url: string): { site: string; src: string | null } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (/(^|\.)tiktok\.com$/.test(host)) {
      const id = u.pathname.match(/\/video\/(\d+)/)?.[1];
      return { site: "TikTok", src: id ? `https://www.tiktok.com/embed/v2/${id}` : null };
    }
    if (/(^|\.)(instagram\.com|instagr\.am)$/.test(host)) {
      const m = u.pathname.match(/\/(p|reel|reels|tv)\/([\w-]+)/);
      return { site: "Instagram", src: m ? `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/embed` : null };
    }
  } catch { /* fall through to Facebook */ }
  // phones block a video that starts by itself with sound (a black box), so the viewer taps play
  return { site: "Facebook", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=false&allowfullscreen=true&t=0` };
}

function Player({ match, tournament, onClose }: { match: TieMatch; tournament: string; onClose: () => void }) {
  const [turned, setTurned] = useState(false); // the player is turned sideways with the rotate button (for a phone held upright)
  const [wide, setWide] = useState(false); // the phone itself is already sideways
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const set = () => setWide(mq.matches);
    set();
    mq.addEventListener("change", set);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { mq.removeEventListener("change", set); window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);

  const player = embed(match.liveUrl!);
  const sideways = turned && !wide; // a phone that is really sideways needs no turning
  const frame: React.CSSProperties = sideways
    ? { position: "fixed", top: 0, left: 0, width: "100dvh", height: "100dvw", transformOrigin: "top left", transform: "translateX(100dvw) rotate(90deg)" }
    : { position: "fixed", inset: 0 };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Live: ${tournament}`} onClick={(e) => e.stopPropagation()} className="z-[100] flex flex-col bg-black text-white" style={{ ...frame, zIndex: 100 }}>
      <div className="flex shrink-0 items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-xs font-bold">
          <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">Live</span>
          <span className="truncate">{match.home ?? "TBD"} {score(match.homeScore)} - {score(match.awayScore)} {match.away ?? "TBD"}</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {!wide && (
            <button type="button" onClick={() => setTurned((v) => !v)} aria-label={turned ? "Back to upright" : "Rotate the screen"} aria-pressed={turned} className={`grid h-9 w-9 place-items-center rounded-full ${turned ? "bg-white text-black" : "bg-white/15"}`}><RotateCw size={18} /></button>
          )}
          <button type="button" onClick={onClose} aria-label="Close the live video" className="grid h-9 w-9 place-items-center rounded-full bg-white/15"><X size={20} /></button>
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        {player.src ? (
          <iframe src={player.src} title={`Live video: ${tournament}`} className="absolute inset-0 h-full w-full border-0" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="max-w-xs space-y-3">
              <Radio size={30} className="mx-auto text-rose-400" aria-hidden />
              <p className="text-sm font-semibold">{player.site} does not let a live stream play inside another app.</p>
              <p className="text-xs text-white/70">Ask the organizer to share the video link of the live (it works once the live is saved as a video), or watch it on {player.site}.</p>
              <a href={match.liveUrl!} target="_blank" rel="noopener noreferrer" className="inline-block rounded-full bg-rose-600 px-5 py-2 text-sm font-bold">Open on {player.site}</a>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default function LiveMatchStrip({ className = "" }: { className?: string }) {
  const t = tournamentStore.use().data ?? null;
  const [playing, setPlaying] = useState(false);
  const router = useRouter();
  // a match counts as live when the venue marked it live, or when the organizer added its Facebook Live video (and it is not finished)
  const live = t?.rounds.flatMap((r) => r.matches).filter((m) => m.status === "live" || (m.status !== "finished" && !!m.liveUrl)) ?? [];
  if (!t || live.length === 0) return null;
  const m = live.find((x) => x.status === "live" && x.liveUrl) ?? live.find((x) => x.liveUrl) ?? live[0];
  const watch = "flex shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-[#0c0b5d] transition active:scale-95";
  return (
    <section aria-label="Live match" role="link" tabIndex={0} title="See this match's goals" onClick={() => router.push(`/tournaments#live-${m.id}`)} onKeyDown={(e) => { if (e.key === "Enter") router.push(`/tournaments#live-${m.id}`); }} className={`uf-live-card cursor-pointer overflow-hidden rounded-2xl px-3 py-2.5 ${className}`} style={{ background: "#ffffff" }}>
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75 motion-reduce:animate-none" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" /></span>
          Live{live.length > 1 ? ` · ${live.length}` : ""}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-500">{t.name}</span>
        {m.liveUrl ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); setPlaying(true); }} className={watch}><Radio size={12} aria-hidden className="text-rose-500" /> Watch live</button>
        ) : (
          <Link href={`/tournaments#live-${m.id}`} onClick={(e) => e.stopPropagation()} className={watch}><Radio size={12} aria-hidden className="text-rose-500" /> Watch live</Link>
        )}
      </div>
      <p className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[#0c0b5d]">
        <span className="truncate text-right text-[13px] font-semibold">{m.home ?? "To be decided"}</span>
        <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-base font-bold tabular-nums text-[#0c0b5d]">{score(m.homeScore)} <span className="text-slate-400">–</span> {score(m.awayScore)}</span>
        <span className="truncate text-[13px] font-semibold">{m.away ?? "To be decided"}</span>
      </p>
      {playing && m.liveUrl && <Player match={m} tournament={t.name} onClose={() => setPlaying(false)} />}
    </section>
  );
}
