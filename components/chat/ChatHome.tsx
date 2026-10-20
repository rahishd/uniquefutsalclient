"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Inbox, Info, Menu, Plus, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { useTeams } from "@/lib/teams";
import { chatTime, deleteChat, friendsStore, openDirect, threadsStore, type ChatPerson, type ChatThreadRow } from "@/lib/chat";
import { askConfirm } from "@/lib/confirm";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import NewChatSheet from "@/components/chat/NewChatSheet";
import FriendsSheet from "@/components/chat/FriendsSheet";
import ChatAlertsBanner from "@/components/chat/ChatAlertsBanner";
import FullScreenPanel from "@/components/chat/FullScreenPanel";
import TeamPage from "@/components/captain/TeamPage";

// One row in the chat menu: icon, label and an optional count.
function MenuItem({ label, Icon, onClick, href, badge }: { label: string; Icon: React.ElementType; onClick?: () => void; href?: string; badge?: number }) {
  const inner = (
    <>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b3bd6] to-brand text-white">
        <Icon size={18} />
      </span>
      <span className="flex-1 text-sm font-semibold text-slate-700">{label}</span>
      {badge ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{badge > 9 ? "9+" : badge}</span> : null}
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100";
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

// Chat tab: friends as round "stories" for a quick chat, shortcuts (new chat, group, add friend, my teams) and my chats.
export default function ChatHome() {
  const router = useRouter();
  const session = useSession();
  const registered = session?.registered === true;
  const { data, status } = threadsStore.use();
  const { data: social } = friendsStore.use();
  const [sheet, setSheet] = useState<"group" | "teams" | null>(null);
  const [friendsTab, setFriendsTab] = useState<"add" | "requests" | "friends" | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [section, setSection] = useState<"friends" | "groups" | "team">("friends"); // which heading of the top block is showing
  const teams = useTeams();
  const [menu, setMenu] = useState(false);
  const [target, setTarget] = useState<ChatThreadRow | null>(null); // the chat that was pressed and held (or right-clicked)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false); // a long press happened: the tap that follows must not open the chat
  const threads = data ?? [];
  const friends = social?.friends ?? [];
  const requests = social?.incoming.length ?? 0;
  const groups = threads.filter((t) => t.kind === "group");
  const groupUnread = groups.reduce((n, g) => n + g.unread, 0);
  const team = teams?.team ?? null;
  const me = session?.registered === true ? session.phone : "";
  const teammates = (team?.members ?? []).filter((m) => m.phone !== me);

  async function chatWith(p: ChatPerson) {
    setOpening(p.phone);
    try {
      const { id } = await openDirect(p.phone);
      threadsStore.refresh();
      router.push(`/chat/${id}`);
    } catch {
      setOpening(null);
    }
  }

  const startHold = (t: ChatThreadRow) => {
    held.current = false;
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => { held.current = true; setTarget(t); try { navigator.vibrate?.(20); } catch { /* not supported */ } }, 500);
  };
  const stopHold = () => clearTimeout(holdTimer.current);

  async function removeChat(t: ChatThreadRow) {
    setTarget(null);
    if (!(await askConfirm(`Delete the entire chat with ${t.title}? It is removed from your side only; ${t.kind === "group" ? "the group and its other members keep it" : "they keep their copy"}.`, { confirmLabel: "Delete chat", danger: true }))) return;
    try {
      await deleteChat(t.id);
    } finally {
      threadsStore.refresh();
    }
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-5 pb-32 pt-6 tab:max-w-2xl desk:max-w-2xl desk:pb-16">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Unique Chat</h1>
          <p className="mt-0.5 text-sm text-slate-500">Unique Community. Unique Connections</p>
        </div>
        {registered && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              aria-label="Chat menu"
              className="glass-active relative flex h-11 w-11 items-center justify-center rounded-2xl text-[#0c0b5d] active:scale-95 transition"
            >
              <Menu size={22} />
              {requests > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">{requests > 9 ? "9+" : requests}</span>}
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} aria-hidden />
                <div role="menu" className="absolute right-0 z-50 mt-2 w-56 space-y-0.5 rounded-3xl bg-white p-2 shadow-[0_18px_36px_-12px_rgba(12,11,93,0.35)] ring-1 ring-slate-100">
                  <MenuItem label="Add Friend" Icon={UserPlus} onClick={() => { setMenu(false); setFriendsTab("add"); }} />
                  <MenuItem label="Friend Requests" Icon={Inbox} badge={requests} onClick={() => { setMenu(false); setFriendsTab("requests"); }} />
                  <MenuItem label="Create Group" Icon={Users} onClick={() => { setMenu(false); setSheet("group"); }} />
                  <MenuItem label="My Teams" Icon={Shield} onClick={() => { setMenu(false); setSheet("teams"); }} />
                  <MenuItem label="About Chat" Icon={Info} href="/chat/about" />
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {!registered ? (
        <section className="glass rounded-3xl p-5 text-center">
          <p className="font-semibold">Sign in to chat</p>
          <p className="mt-1 text-sm text-slate-500">Chat is for registered Unique Futsal players.</p>
          <button type="button" onClick={openSignIn} className="glass-btn mt-4 rounded-full px-6 py-3 text-sm font-semibold">Sign in</button>
        </section>
      ) : (
        <>
          <ChatAlertsBanner />
          <section aria-label="Friends, groups and my team">
            <div role="tablist" aria-label="Show" className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
              {([
                ["friends", "Friends", requests],
                ["groups", "Groups", groupUnread],
                ["team", "My Team", 0],
              ] as const).map(([id, label, badge]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={section === id}
                  onClick={() => setSection(id)}
                  className={`relative rounded-xl py-2 text-sm font-semibold transition ${section === id ? "glass-active text-[#0c0b5d]" : "text-slate-500"}`}
                >
                  {label}
                  {badge > 0 && <span className="absolute -right-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{badge > 9 ? "9+" : badge}</span>}
                </button>
              ))}
            </div>

            {section === "friends" && (
              <>
                <div className="mb-2 flex items-center justify-end">
                  <button type="button" onClick={() => setFriendsTab("friends")} className="text-xs font-semibold text-brand">See all</button>
                </div>
                <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <li className="shrink-0">
                    <button type="button" onClick={() => setFriendsTab("add")} className="flex w-[68px] flex-col items-center gap-2" aria-label="Add a friend">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-brand/30 bg-white text-brand transition active:scale-95"><Plus size={22} /></span>
                      <span className="w-full truncate text-center text-[11px] font-medium text-slate-500">Add</span>
                    </button>
                  </li>
                  {friends.map((f) => (
                    <li key={f.id} className="shrink-0">
                      <button type="button" disabled={opening !== null} onClick={() => chatWith(f)} className="flex w-[68px] flex-col items-center gap-2 transition active:scale-95 disabled:opacity-60" aria-label={`Chat with ${f.name}`}>
                        <ProfileAvatar name={f.name} captain={false} size={56} src={f.avatar} />
                        <span className="w-full truncate text-center text-[11px] font-medium text-slate-600">{f.name.split(" ")[0]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {section === "groups" && (
              <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <li className="shrink-0">
                  <button type="button" onClick={() => setSheet("group")} className="flex w-[68px] flex-col items-center gap-2" aria-label="Create a group">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-brand/30 bg-white text-brand transition active:scale-95"><Plus size={22} /></span>
                    <span className="w-full truncate text-center text-[11px] font-medium text-slate-500">New</span>
                  </button>
                </li>
                {groups.map((g) => (
                  <li key={g.id} className="shrink-0">
                    <Link href={`/chat/${g.id}`} className="relative flex w-[68px] flex-col items-center gap-2 transition active:scale-95" aria-label={`Open group ${g.title}`}>
                      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                        <Users size={22} />
                        {g.unread > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">{g.unread > 9 ? "9+" : g.unread}</span>}
                      </span>
                      <span className="w-full truncate text-center text-[11px] font-medium text-slate-600">{g.title}</span>
                    </Link>
                  </li>
                ))}
                {groups.length === 0 && <li className="self-center pl-1 text-xs text-slate-400">No groups yet. Tap New to start one.</li>}
              </ul>
            )}

            {section === "team" && (
              team ? (
                <>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-slate-500">{team.name}</span>
                    <button type="button" onClick={() => setSheet("teams")} className="text-xs font-semibold text-brand">Open team</button>
                  </div>
                  <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {teammates.map((m) => (
                      <li key={m.userId} className="shrink-0">
                        <button type="button" disabled={opening !== null} onClick={() => chatWith({ phone: m.phone, name: m.name, avatar: null })} className="flex w-[68px] flex-col items-center gap-2 transition active:scale-95 disabled:opacity-60" aria-label={`Chat with ${m.name}`}>
                          <ProfileAvatar name={m.name} captain={m.isCaptain} size={56} src={null} />
                          <span className="w-full truncate text-center text-[11px] font-medium text-slate-600">{m.name.split(" ")[0]}</span>
                        </button>
                      </li>
                    ))}
                    {teammates.length === 0 && <li className="self-center pl-1 text-xs text-slate-400">No teammates yet. Add players from Open team.</li>}
                  </ul>
                </>
              ) : (
                <div className="rounded-3xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100">
                  <p className="text-sm font-semibold">{teams === undefined ? "Loading your team…" : "No team to show"}</p>
                  {teams !== undefined && <p className="mt-1 text-xs text-slate-500">Switch to Captain mode and create or join a team to chat with your teammates here.</p>}
                  {teams !== undefined && <button type="button" onClick={() => setSheet("teams")} className="glass-btn mt-3 rounded-full px-5 py-2 text-xs font-semibold">My Teams</button>}
                </div>
              )
            )}
          </section>

          <section aria-label="Chats">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">Chats</h2>
            {status === "loading" && threads.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Loading your chats…</p>}
            {status !== "loading" && threads.length === 0 && (
              <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
                <p className="font-semibold">No chats yet</p>
                <p className="mt-1 text-sm text-slate-500">Add a friend from the menu, then tap them to start chatting.</p>
              </div>
            )}
            {threads.length > 0 && (
              <ul className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_24px_-16px_rgba(12,11,93,0.3)] ring-1 ring-slate-100">
                {threads.map((t, i) => (
                  <li key={t.id} className={i > 0 ? "border-t border-slate-100" : ""}>
                    <Link
                      href={`/chat/${t.id}`}
                      onPointerDown={() => startHold(t)}
                      onPointerUp={stopHold}
                      onPointerLeave={stopHold}
                      onPointerCancel={stopHold}
                      onContextMenu={(e) => { e.preventDefault(); stopHold(); held.current = true; setTarget(t); }}
                      onClick={(e) => { if (held.current) { e.preventDefault(); held.current = false; } }}
                      className="flex select-none items-center gap-3 px-4 py-3 transition hover:bg-slate-50 active:bg-slate-100 [-webkit-touch-callout:none]"
                    >
                      {t.kind === "group" ? (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"><Users size={20} /></span>
                      ) : (
                        <ProfileAvatar name={t.title} captain={false} size={48} src={t.avatar} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-slate-800">{t.title}</span>
                          <span className="shrink-0 text-[11px] text-slate-400">{t.lastMessage ? chatTime(t.lastMessageAt) : ""}</span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className={`flex min-w-0 items-center gap-1 text-[13px] ${t.unread > 0 ? "font-medium text-slate-800" : "text-slate-500"}`}>
                            {t.lastMessage && t.lastSeen !== null && (t.lastSeen ? <CheckCheck size={14} className="shrink-0 text-blue-600" aria-label="Seen" /> : <Check size={14} className="shrink-0 text-slate-400" aria-label="Sent, not seen yet" />)}
                            <span className="truncate">
                              {t.lastMessage ? `${t.kind === "group" && t.lastFrom ? t.lastFrom + ": " : t.lastFrom === "You" ? "You: " : ""}${t.lastMessage}` : "No messages yet"}
                            </span>
                          </span>
                          {t.unread > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                              {t.unread > 9 ? "9+" : t.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {target && (
        <div role="dialog" aria-modal="true" aria-label={`Options for ${target.title}`} className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setTarget(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="truncate px-3 pb-2 pt-1 text-sm font-semibold text-slate-800">{target.title}</p>
            <button type="button" onClick={() => removeChat(target)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50">
              <Trash2 size={18} /> Delete entire chat
            </button>
            <button type="button" onClick={() => setTarget(null)} className="mt-1 w-full rounded-2xl px-3 py-3 text-center text-sm font-medium text-slate-500 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {sheet === "group" && <NewChatSheet onClose={() => setSheet(null)} />}
      {sheet === "teams" && <FullScreenPanel title="My Teams" onClose={() => setSheet(null)}><TeamPage /></FullScreenPanel>}
      {friendsTab && <FriendsSheet initialTab={friendsTab} onClose={() => setFriendsTab(null)} />}
    </main>
  );
}
