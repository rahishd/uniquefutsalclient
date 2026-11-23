"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { openSignIn, useSession } from "@/lib/session";
import { getRoom, ludoStore, useLudoSocket, type LudoGame } from "@/lib/ludo";
import { ludoSound } from "@/lib/ludo-sound";
import GameScreen from "@/components/ludo/GameScreen";
import Lobby from "@/components/ludo/Lobby";
import { LudoFrame } from "@/components/ludo/parts";

// One page for a room from the moment it opens to the final result: the lobby, then the game, then the result.
export default function RoomPage({ code }: { code: string }) {
  const session = useSession();
  const router = useRouter();
  const registered = session?.registered === true;
  const [game, setGame] = useState<LudoGame | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; bad?: boolean } | null>(null);
  const id = useRef(0);
  const prevStatus = useRef<string | null>(null);

  const say = useCallback((text: string, bad = false) => {
    const n = ++id.current;
    setToast({ id: n, text, bad });
    setTimeout(() => setToast((t) => (t?.id === n ? null : t)), 3500);
  }, []);
  const err = useCallback((m: string) => say(m, true), [say]);
  const info = useCallback((m: string) => say(m), [say]);

  // keep the newest view; an older one (a late answer) never replaces a newer one
  const take = useCallback((g: LudoGame) => {
    setGame((cur) => {
      if (cur && cur.id === g.id && cur.status === g.status && cur.board && g.board && g.board.seq < cur.board.seq) return cur;
      return g;
    });
  }, []);

  const refresh = useCallback(async () => {
    try { take(await getRoom(code)); setGone(null); }
    catch (e) { if (e instanceof ApiError && (e.status === 404 || e.status === 403)) setGone(e.message); }
  }, [code, take]);

  const connected = useLudoSocket((g) => { if (g.code === code.toUpperCase()) take(g); }, () => void refresh());

  useEffect(() => {
    if (!registered) return;
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [registered, refresh]);
  // the socket brings changes at once; this is the safety net if the line drops or a message is missed
  useEffect(() => {
    if (!registered) return;
    const t = setInterval(() => void refresh(), connected ? 12000 : 3000);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [registered, connected, refresh]);

  // announce the big moments
  useEffect(() => {
    if (!game) return;
    if (prevStatus.current === "lobby" && game.status === "active") { say("Game started. Good luck!"); ludoSound.turn(); }
    if (prevStatus.current === "lobby" && game.status === "cancelled") say(game.cancelReason ?? "The room was closed.", true);
    if (prevStatus.current !== game.status) void ludoStore.refresh();
    prevStatus.current = game.status;
  }, [game, say]);

  if (session === undefined) return <LudoFrame><div className="grid flex-1 place-items-center"><Loader2 className="lu-spin" /></div></LudoFrame>;
  if (!registered) {
    return (
      <LudoFrame back={() => router.push("/ludo")}>
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="lu-panel max-w-sm p-6">
            <h2 className="text-lg font-extrabold">Sign in to play</h2>
            <p className="lu-muted mt-1 text-sm">Unique Ludo uses your Loyalty Points and your friends, so you need your Unique Futsal account.</p>
            <button type="button" className="lu-btn mt-4 block w-full" onClick={openSignIn}>Sign in</button>
          </div>
        </div>
      </LudoFrame>
    );
  }

  const title = game?.status === "lobby" ? "Game room" : game?.mode === "solo" ? "Solo game" : "Game with friends";

  return (
    <LudoFrame title="Unique Ludo" subtitle={title} back={() => router.push("/ludo")}>
      <div className="lu-scroll">
        {gone && !game ? (
          <div className="lu-wrap grid grid-cols-[minmax(0,1fr)] place-items-center py-10 text-center">
            <div className="lu-panel max-w-sm p-6">
              <h2 className="text-lg font-extrabold">Room not available</h2>
              <p className="lu-muted mt-1 text-sm">{gone}</p>
              <button type="button" className="lu-btn mt-4 block w-full" onClick={() => router.push("/ludo")}>Back to Unique Ludo</button>
            </div>
          </div>
        ) : !game ? (
          <div className="grid place-items-center py-20"><Loader2 className="lu-spin" /></div>
        ) : game.status === "cancelled" ? (
          <div className="lu-wrap grid grid-cols-[minmax(0,1fr)] place-items-center py-10 text-center">
            <div className="lu-panel max-w-sm p-6">
              <h2 className="text-lg font-extrabold">Room closed</h2>
              <p className="lu-muted mt-1 text-sm">{game.cancelReason ?? "This room was cancelled."} Nobody was charged{game.startedAt ? ", and every Loyalty Point was returned" : ""}.</p>
              <button type="button" className="lu-btn mt-4 block w-full" onClick={() => router.push("/ludo")}>Back to Unique Ludo</button>
            </div>
          </div>
        ) : game.status === "lobby" ? (
          <Lobby game={game} onError={err} onInfo={info} onRefresh={() => void refresh()} onLeft={() => router.push("/ludo")} />
        ) : game.board ? (
          <GameScreen key={game.id} game={game} connected={connected} onGame={take} onError={err} onRefresh={() => void refresh()} />
        ) : null}
      </div>
      {toast && (
        <p key={toast.id} role="status" className="lu-fade fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),1rem)] z-[130] mx-auto max-w-md rounded-2xl px-4 py-3 text-center text-sm font-bold shadow-2xl"
          style={{ background: toast.bad ? "#7f1d1d" : "#0f1b66", border: `1px solid ${toast.bad ? "#fb7185" : "rgba(255,255,255,0.25)"}`, color: "#fff" }}>{toast.text}</p>
      )}
      {!connected && game && game.mode === "multi" && game.status !== "completed" && (
        <p className="fixed inset-x-0 top-0 z-[125] bg-amber-500 py-1 text-center text-[11px] font-bold text-black">Connection lost. Reconnecting…</p>
      )}
    </LudoFrame>
  );
}
