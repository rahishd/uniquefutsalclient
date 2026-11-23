"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Crown, Loader2, Play, Search, Share2, UserMinus, UserPlus, X } from "lucide-react";
import { errorText } from "@/lib/api";
import {
  acceptInvite, cancelInvite, cancelRoom, declineInvite, fetchFriends, inviteFriend, kickPlayer, leaveGame, ludoStore, setReady, startRoom,
  type LudoFriend, type LudoGame, type LudoPlayer,
} from "@/lib/ludo";
import { COLORS } from "@/lib/ludo-board";
import { ludoSound } from "@/lib/ludo-sound";
import { Avatar } from "@/components/ludo/parts";

function Slot({ p, game, onKick, busy }: { p: LudoPlayer | null; game: LudoGame; onKick: (id: string) => void; busy: boolean }) {
  if (!p) {
    return (
      <div className="lu-pcard" style={{ borderStyle: "dashed", minHeight: "3.6rem" }}>
        <span className="lu-avatar lu-wait" style={{ background: "transparent", borderStyle: "dashed", ["--ring" as string]: "#ffffff55" }}>?</span>
        <p className="lu-muted lu-wait text-sm font-semibold">Waiting for a player…</p>
      </div>
    );
  }
  const ready = p.isHost || p.ready;
  return (
    <div className="lu-pcard lu-fade" style={{ ["--ring" as string]: COLORS[p.color].main }}>
      <Avatar name={p.name} src={p.avatar} color={p.color} size={42} />
      <div className="min-w-0 flex-1">
        <p className="nm flex items-center gap-1">{p.isMe ? "You" : p.name}{p.isHost && <Crown size={13} className="lu-gold" aria-label="Host" />}</p>
        <p className="sub flex items-center gap-1.5"><span className={`lu-dot${p.online ? " on" : ""}`} />{p.online ? "Online" : "Offline"}<span aria-hidden>·</span>{COLORS[p.color].name}</p>
      </div>
      <span className={`lu-chip ${ready ? "good" : ""}`}>{ready ? <><Check size={12} /> Ready</> : "Waiting"}</span>
      {game.isHost && !p.isHost && (
        <button type="button" className="lu-icon" style={{ width: "2.2rem", height: "2.2rem" }} disabled={busy} onClick={() => onKick(p.id)} aria-label={`Remove ${p.name}`}><UserMinus size={15} /></button>
      )}
    </div>
  );
}

export default function Lobby({ game, onError, onInfo, onRefresh, onLeft }: {
  game: LudoGame; onError: (m: string) => void; onInfo: (m: string) => void; onRefresh: () => void; onLeft: () => void;
}) {
  const [friends, setFriends] = useState<LudoFriend[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const me = ludoStore.use().data;
  const seated = game.players.filter((p) => p.status === "joined");
  const meP = seated.find((p) => p.isMe);
  const isInvitee = !meP && !!game.myInviteId;
  const guestsReady = seated.every((p) => p.isHost || p.ready);
  const canStart = game.isHost && seated.length >= 2 && guestsReady;
  const link = typeof window !== "undefined" ? `${window.location.origin}/ludo/room/${game.code}` : "";
  const left = me?.limits.multi.left;

  const load = useCallback(async () => {
    if (!game.isHost) return;
    try { setFriends(await fetchFriends(game.id, q)); } catch { /* the list is a convenience; the room still works */ }
  }, [game.id, game.isHost, q]);
  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q, game.players.length, game.invites.length]);
  useEffect(() => { if (!game.isHost) return; const t = setInterval(() => void load(), 15000); return () => clearInterval(t); }, [game.isHost, load]);

  // tell the host when someone joins or answers
  const seen = useRef({ n: seated.length, inv: game.invites.map((i) => i.id + i.status).join() });
  useEffect(() => {
    if (seated.length > seen.current.n) { onInfo("A friend joined the room."); ludoSound.turn(); }
    if (seated.length < seen.current.n && game.isHost) onInfo("A player left the room.");
    const declined = game.invites.filter((i) => i.status === "declined" && !seen.current.inv.includes(i.id + "declined"));
    if (declined.length && game.isHost) onInfo(`${declined[0].name} declined the invitation.`);
    seen.current = { n: seated.length, inv: game.invites.map((i) => i.id + i.status).join() };
  }, [seated.length, game.invites, game.isHost, onInfo]);

  async function run<T>(key: string, fn: () => Promise<T>, after?: (r: T) => void) {
    setBusy(key);
    try { const r = await fn(); after?.(r); onRefresh(); void load(); } catch (e) { onError(errorText(e)); } finally { setBusy(null); }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { onInfo(`Room code: ${game.code}`); }
  }
  async function share() {
    ludoSound.button();
    if (navigator.share) { try { await navigator.share({ title: "Unique Ludo", text: `Join my Unique Ludo room ${game.code}`, url: link }); return; } catch { /* cancelled */ } }
    void copy(link);
  }

  if (game.status === "lobby" && isInvitee) {
    return (
      <div className="lu-wrap mx-auto max-w-lg py-4">
        <div className="lu-panel lu-pop p-5 text-center">
          <p className="lu-chip gold mx-auto w-fit">Invitation</p>
          <h2 className="mt-3 text-xl font-extrabold">{game.hostName} invited you to play Unique Ludo</h2>
          <p className="lu-muted mt-1 text-sm">{seated.length} of {game.maxPlayers} players are in the room. Entry fee {game.you.fee} Loyalty Point, winner gets +{game.you.reward}.</p>
          <div className="mt-4 space-y-2 text-left">{seated.map((p) => <Slot key={p.id} p={p} game={game} onKick={() => undefined} busy />)}</div>
          <div className="mt-5 flex gap-2">
            <button type="button" className="lu-btn ghost block" disabled={busy !== null} onClick={() => void run("decline", () => declineInvite(game.myInviteId!), onLeft)}>Decline</button>
            <button type="button" className="lu-btn block" disabled={busy !== null} onClick={() => void run("accept", () => acceptInvite(game.myInviteId!), () => ludoSound.turn())}>
              {busy === "accept" ? <Loader2 size={16} className="lu-spin" /> : <Check size={16} />} Join room
            </button>
          </div>
        </div>
      </div>
    );
  }

  const slots: (LudoPlayer | null)[] = Array.from({ length: game.maxPlayers }, (_, i) => seated.find((p) => p.seat === i) ?? null);
  const pending = game.invites.filter((i) => i.status === "invited");

  return (
    <div className="lu-wrap grid grid-cols-[minmax(0,1fr)] gap-4 py-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="space-y-4">
        {/* the room */}
        <section className="lu-panel p-4" aria-label="Room">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="lu-h2 !mb-0.5">Room code</p>
              <p className="text-3xl font-black tracking-[0.25em]" aria-label={`Room code ${game.code.split("").join(" ")}`}>{game.code}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="lu-icon" onClick={() => { ludoSound.button(); void copy(game.code); }} aria-label="Copy room code">{copied ? <Check size={18} /> : <Copy size={18} />}</button>
              <button type="button" className="lu-icon" onClick={share} aria-label="Share invite link"><Share2 size={18} /></button>
            </div>
          </div>
          <p className="lu-muted mt-2 text-xs">Private room. Only friends the host invites can join, and the code alone is not enough.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="lu-chip">Entry {game.you.fee} point</span>
            <span className="lu-chip gold">Winner +{game.you.reward} points</span>
            {left !== undefined && <span className="lu-chip">{me!.limits.multi.used} / {me!.limits.multi.limit} games today</span>}
          </div>
        </section>

        <section aria-label="Players" className="space-y-2">
          <p className="lu-h2">Players ({seated.length} / {game.maxPlayers})</p>
          {slots.map((p, i) => <Slot key={p?.id ?? `empty-${i}`} p={p} game={game} busy={busy !== null} onKick={(id) => void run("kick" + id, () => kickPlayer(game.id, id))} />)}
        </section>

        {pending.length > 0 && (
          <section aria-label="Invitations">
            <p className="lu-h2">Invited</p>
            <ul className="space-y-2">
              {pending.map((i) => (
                <li key={i.id} className="lu-pcard">
                  <Avatar name={i.name} src={i.avatar} size={34} />
                  <p className="nm flex-1">{i.name}</p>
                  <span className="lu-chip"><span className={`lu-dot${i.online ? " on" : ""}`} />{i.online ? "Online" : "Offline"}</span>
                  <span className="lu-chip lu-wait">Waiting</span>
                  {game.isHost && <button type="button" className="lu-icon" style={{ width: "2.2rem", height: "2.2rem" }} onClick={() => void run("ci" + i.id, () => cancelInvite(game.id, i.id))} aria-label={`Cancel invitation to ${i.name}`}><X size={15} /></button>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* actions */}
        <section className="lu-panel p-4">
          {game.isHost ? (
            <>
              <button type="button" className="lu-btn block" disabled={!canStart || busy !== null} onClick={() => { ludoSound.button(); void run("start", () => startRoom(game.id), () => ludoSound.turn()); }}>
                {busy === "start" ? <Loader2 size={18} className="lu-spin" /> : <Play size={18} />} Start game
              </button>
              <p className="lu-muted mt-2 text-center text-xs" aria-live="polite">
                {seated.length < 2 ? "Invite at least one friend to start." : !guestsReady ? "Waiting for everyone to be ready." : `Starting takes ${game.you.fee} Loyalty Point from each player.`}
              </p>
              <button type="button" className="lu-btn danger small mt-3 block w-full" disabled={busy !== null} onClick={() => void run("cancel", () => cancelRoom(game.id), onLeft)}>Cancel room</button>
            </>
          ) : (
            <>
              <button type="button" className="lu-btn block" disabled={busy !== null} onClick={() => { ludoSound.button(); void run("ready", () => setReady(game.id, !meP?.ready)); }}>
                {meP?.ready ? "Not ready" : <><Check size={18} /> I&apos;m ready</>}
              </button>
              <p className="lu-muted mt-2 text-center text-xs">Waiting for {game.hostName} to start the game.</p>
              <button type="button" className="lu-btn ghost small mt-3 block w-full" disabled={busy !== null} onClick={() => void run("leave", () => leaveGame(game.id), onLeft)}>Leave room</button>
            </>
          )}
        </section>
      </div>

      {/* friends */}
      {game.isHost && (
        <section className="lu-panel h-fit p-4" aria-label="Invite friends">
          <p className="lu-h2">Invite friends</p>
          <label className="relative block">
            <Search size={16} className="lu-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
            <input className="lu-input" style={{ paddingLeft: "2.3rem" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your friends" aria-label="Search friends" />
          </label>
          <ul className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {friends === null && <li className="lu-muted lu-wait py-4 text-center text-sm">Loading friends…</li>}
            {friends?.length === 0 && (
              <li className="lu-muted py-4 text-center text-sm">{q ? "No friend matches your search." : "You have no friends yet. Add friends in Chat, then invite them here."}</li>
            )}
            {friends?.map((f) => {
              const st = f.invite;
              return (
                <li key={f.phone} className="lu-pcard">
                  <Avatar name={f.name} src={f.avatar} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="nm">{f.name}</p>
                    <p className="sub flex items-center gap-1.5"><span className={`lu-dot${f.online ? " on" : ""}`} />{f.online ? "Online" : "Offline"}</p>
                  </div>
                  {st === "joined" ? <span className="lu-chip good"><Check size={12} /> Joined</span>
                    : st === "invited" ? <span className="lu-chip lu-wait">Invited</span>
                    : (
                      <button type="button" className="lu-btn small" disabled={busy !== null || seated.length >= game.maxPlayers}
                        onClick={() => { ludoSound.button(); void run("inv" + f.phone, () => inviteFriend(game.id, f.phone), () => onInfo(`Invitation sent to ${f.name}.`)); }}>
                        {busy === "inv" + f.phone ? <Loader2 size={14} className="lu-spin" /> : <UserPlus size={14} />} {st === "declined" ? "Invite again" : "Invite"}
                      </button>
                    )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
