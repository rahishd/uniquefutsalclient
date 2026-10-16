"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Plus, Shield, UserPlus, Users } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { chatTime, friendsStore, openDirect, threadsStore, type ChatPerson } from "@/lib/chat";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import NewChatSheet from "@/components/chat/NewChatSheet";
import FriendsSheet from "@/components/chat/FriendsSheet";

// A rounded action tile: icon on a soft gradient, label under it.
function Action({ label, Icon, onClick, href, badge }: { label: string; Icon: React.ElementType; onClick?: () => void; href?: string; badge?: number }) {
  const inner = (
    <>
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3b3bd6] to-brand text-white shadow-[0_10px_20px_-10px_rgba(12,11,93,0.7)]">
        <Icon size={22} />
        {badge ? <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">{badge > 9 ? "9+" : badge}</span> : null}
      </span>
      <span className="text-[12px] font-semibold text-slate-700">{label}</span>
    </>
  );
  const cls = "flex flex-col items-center gap-1.5 text-center active:scale-95 transition";
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

// Chat tab: friends as round "stories" for a quick chat, shortcuts (new chat, group, add friend, my teams) and my chats.
export default function ChatHome() {
  const router = useRouter();
  const session = useSession();
  const registered = session?.registered === true;
  const { data, status } = threadsStore.use();
  const { data: social } = friendsStore.use();
  const [sheet, setSheet] = useState<"direct" | "group" | null>(null);
  const [friendsTab, setFriendsTab] = useState<"add" | "requests" | "friends" | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const threads = data ?? [];
  const friends = social?.friends ?? [];
  const requests = social?.incoming.length ?? 0;

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

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-5 pb-32 pt-6 desk:max-w-2xl desk:pb-16">
      <header className="rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#1d1c8f] to-[#3b3bd6] p-5 text-white shadow-[0_18px_36px_-18px_rgba(12,11,93,0.8)]">
        <h1 className="text-2xl font-semibold">Unique Community</h1>
        <p className="mt-0.5 text-sm font-medium text-white/80">Unique Connections</p>
        <p className="mt-2 text-sm text-white/70">Talk to other players, or make a group for your team.</p>
      </header>

      {!registered ? (
        <section className="glass rounded-3xl p-5 text-center">
          <p className="font-semibold">Sign in to chat</p>
          <p className="mt-1 text-sm text-slate-500">Chat is for registered Unique Futsal players.</p>
          <button type="button" onClick={openSignIn} className="glass-btn mt-4 rounded-full px-6 py-3 text-sm font-semibold">Sign in</button>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            <Action label="New chat" Icon={MessageSquarePlus} onClick={() => setSheet("direct")} />
            <Action label="New group" Icon={Users} onClick={() => setSheet("group")} />
            <Action label={requests ? "Requests" : "Add friend"} Icon={UserPlus} onClick={() => setFriendsTab(requests ? "requests" : "add")} badge={requests} />
            <Action label="My teams" Icon={Shield} href="/team" />
          </div>

          <section aria-label="Friends">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Friends</h2>
              {friends.length > 0 && <button type="button" onClick={() => setFriendsTab("friends")} className="text-xs font-semibold text-brand">See all</button>}
            </div>
            <ul className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <li className="shrink-0">
                <button type="button" onClick={() => setFriendsTab("add")} className="flex w-[64px] flex-col items-center gap-1.5" aria-label="Add a friend">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-brand/40 bg-brand/5 text-brand"><Plus size={24} /></span>
                  <span className="w-full truncate text-center text-xs font-medium text-slate-600">Add</span>
                </button>
              </li>
              {friends.map((f) => (
                <li key={f.id} className="shrink-0">
                  <button type="button" disabled={opening !== null} onClick={() => chatWith(f)} className="flex w-[64px] flex-col items-center gap-1.5 disabled:opacity-60" aria-label={`Chat with ${f.name}`}>
                    <span className="rounded-full bg-gradient-to-tr from-rose-400 via-orange-400 to-amber-300 p-[3px]">
                      <span className="block rounded-full bg-white p-[2px]"><ProfileAvatar name={f.name} captain={false} size={54} src={f.avatar} /></span>
                    </span>
                    <span className="w-full truncate text-center text-xs font-medium text-slate-700">{f.name.split(" ")[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
            {friends.length === 0 && <p className="mt-1 text-xs text-slate-500">Add friends to chat with them in one tap.</p>}
          </section>

          <section aria-label="Chats">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">Chats</h2>
            {status === "loading" && threads.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Loading your chats…</p>}
            {status !== "loading" && threads.length === 0 && (
              <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
                <p className="font-semibold">No chats yet</p>
                <p className="mt-1 text-sm text-slate-500">Tap a friend above, or start a chat with a player using their mobile number.</p>
              </div>
            )}
            {threads.length > 0 && (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-[0_14px_30px_-18px_rgba(12,11,93,0.35)] ring-1 ring-slate-100">
                {threads.map((t) => (
                  <li key={t.id}>
                    <Link href={`/chat/${t.id}`} className="flex items-center gap-3.5 px-4 py-3.5 transition active:bg-slate-50">
                      {t.kind === "group" ? (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-brand"><Users size={24} /></span>
                      ) : (
                        <ProfileAvatar name={t.title} captain={false} size={56} src={t.avatar} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[15px] font-semibold text-slate-800">{t.title}</span>
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t.lastMessage ? chatTime(t.lastMessageAt) : ""}</span>
                        </span>
                        <span className="mt-1 flex items-center justify-between gap-2">
                          <span className={`truncate text-[13px] ${t.unread > 0 ? "font-medium text-blue-600" : "text-slate-500"}`}>
                            {t.lastMessage ? `${t.kind === "group" && t.lastFrom ? t.lastFrom + ": " : t.lastFrom === "You" ? "You: " : ""}${t.lastMessage}` : "No messages yet"}
                          </span>
                          {t.unread > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
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

      {sheet && <NewChatSheet initialMode={sheet} onClose={() => setSheet(null)} />}
      {friendsTab && <FriendsSheet initialTab={friendsTab} onClose={() => setFriendsTab(null)} />}
    </main>
  );
}
