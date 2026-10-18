"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Search, UserPlus, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { MIN_SEARCH_DIGITS, acceptFriend, friendsStore, removeFriend, searchPeople, sendFriendRequest, type ChatPerson } from "@/lib/chat";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import FullScreenPanel from "@/components/chat/FullScreenPanel";

type Tab = "add" | "requests" | "friends";

const TITLES: Record<Tab, string> = { add: "Add Friend", requests: "Friend Requests", friends: "Friends" };

// Full-screen friends page, one view per menu entry: find a player by mobile number and send a request (add),
// answer requests sent to you (requests), or see and remove your friends (friends).
export default function FriendsSheet({ initialTab = "add", onClose }: { initialTab?: Tab; onClose: () => void }) {
  const { data } = friendsStore.use();
  const tab = initialTab;
  const [q, setQ] = useState("");
  const [found, setFound] = useState<ChatPerson[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const friends = data?.friends ?? [];
  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];
  const digits = q.replace(/\D/g, "");
  const searching = digits.length >= MIN_SEARCH_DIGITS;
  const shown = searching ? found : [];
  const friendSet = new Set(friends.map((f) => f.phone));
  const sentSet = new Set(outgoing.map((o) => o.to.phone));
  const askedMe = new Set(incoming.map((i) => i.from.phone));

  useEffect(() => {
    if (!searching) return;
    let live = true;
    const t = setTimeout(() => {
      searchPeople(digits).then((r) => live && setFound(r)).catch(() => live && setFound([]));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [digits, searching]);

  async function run(key: string, fn: () => Promise<unknown>, done?: string) {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      await fn();
      if (done) setNote(done);
      friendsStore.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <FullScreenPanel title={TITLES[tab]} onClose={onClose}>
      <div>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-500/10 p-2.5 text-sm text-red-600">{error}</p>}
        {note && <p role="status" className="mt-3 rounded-xl bg-emerald-500/10 p-2.5 text-sm text-emerald-700">{note}</p>}

        {tab === "add" && (
          <div className="mt-4">
            <label className="relative block">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="numeric" autoFocus placeholder="Start of their mobile number" className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-brand" />
            </label>
            <p className="mt-2 text-xs text-slate-500">Type at least {MIN_SEARCH_DIGITS} digits of their mobile number.</p>
            <ul className="mt-3 space-y-2">
              {shown.map((p) => (
                <li key={p.phone} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                  <ProfileAvatar name={p.name} captain={false} size={44} src={p.avatar} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block text-xs text-slate-500">{p.phone}</span>
                  </span>
                  {friendSet.has(p.phone) ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><Check size={14} /> Friends</span>
                  ) : sentSet.has(p.phone) ? (
                    <span className="text-xs font-semibold text-slate-400">Request sent</span>
                  ) : askedMe.has(p.phone) ? (
                    <button type="button" disabled={busy !== null} onClick={() => run(`acc-${p.phone}`, () => acceptFriend(incoming.find((i) => i.from.phone === p.phone)!.id), `${p.name} is now your friend.`)}
                      className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">Accept</button>
                  ) : (
                    <button type="button" disabled={busy !== null} onClick={() => run(`req-${p.phone}`, () => sendFriendRequest(p.phone), `Request sent to ${p.name}.`)}
                      className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                      {busy === `req-${p.phone}` ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} Add
                    </button>
                  )}
                </li>
              ))}
              {searching && shown.length === 0 && <li className="py-6 text-center text-sm text-slate-400">No player found with that number.</li>}
            </ul>
          </div>
        )}

        {tab === "requests" && (
          <div className="mt-4 space-y-4">
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sent to you</h3>
              <ul className="mt-2 space-y-2">
                {incoming.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                    <ProfileAvatar name={r.from.name} captain={false} size={44} src={r.from.avatar} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.from.name}</span>
                      <span className="block text-xs text-slate-500">{r.from.phone}</span>
                    </span>
                    <button type="button" disabled={busy !== null} onClick={() => run(`acc-${r.id}`, () => acceptFriend(r.id), `${r.from.name} is now your friend.`)} className="rounded-full bg-brand px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60">Accept</button>
                    <button type="button" disabled={busy !== null} onClick={() => run(`dec-${r.id}`, () => removeFriend(r.id))} aria-label={`Decline ${r.from.name}`} className="rounded-full bg-slate-200 p-2 text-slate-600 disabled:opacity-60"><X size={14} /></button>
                  </li>
                ))}
                {incoming.length === 0 && <li className="py-4 text-center text-sm text-slate-400">No new requests.</li>}
              </ul>
            </section>
            {outgoing.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">You sent</h3>
                <ul className="mt-2 space-y-2">
                  {outgoing.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                      <ProfileAvatar name={r.to.name} captain={false} size={44} src={r.to.avatar} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{r.to.name}</span>
                        <span className="block text-xs text-slate-500">Waiting for an answer</span>
                      </span>
                      <button type="button" disabled={busy !== null} onClick={() => run(`can-${r.id}`, () => removeFriend(r.id))} className="rounded-full bg-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 disabled:opacity-60">Cancel</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {tab === "friends" && (
          <ul className="mt-4 space-y-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <ProfileAvatar name={f.name} captain={false} size={44} src={f.avatar} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{f.name}</span>
                  <span className="block text-xs text-slate-500">{f.phone}</span>
                </span>
                <button type="button" disabled={busy !== null}
                  onClick={() => { if (window.confirm(`Remove ${f.name} from your friends?`)) void run(`rm-${f.id}`, () => removeFriend(f.id)); }}
                  className="rounded-full bg-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 disabled:opacity-60">Remove</button>
              </li>
            ))}
            {friends.length === 0 && <li className="py-8 text-center text-sm text-slate-400">No friends yet. Use Add Friend to find players.</li>}
          </ul>
        )}
      </div>
    </FullScreenPanel>
  );
}
