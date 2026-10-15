"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquarePlus, Users } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { chatTime, threadsStore } from "@/lib/chat";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import NewChatSheet from "@/components/chat/NewChatSheet";

// Chat tab: my chats (one to one and groups) and a button to start a new chat or group.
export default function ChatHome() {
  const session = useSession();
  const registered = session?.registered === true;
  const { data, status } = threadsStore.use();
  const [sheet, setSheet] = useState<"direct" | "group" | null>(null);
  const threads = data ?? [];

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-5 pb-32 pt-8 desk:max-w-2xl desk:pb-16">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Chat</h1>
          <p className="mt-1 text-sm text-slate-500">Talk to other players, or make a group for your team.</p>
        </div>
      </header>

      {!registered ? (
        <section className="glass rounded-3xl p-5 text-center">
          <p className="font-semibold">Sign in to chat</p>
          <p className="mt-1 text-sm text-slate-500">Chat is for registered Unique Futsal players.</p>
          <button type="button" onClick={openSignIn} className="glass-btn mt-4 rounded-full px-6 py-3 text-sm font-semibold">Sign in</button>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setSheet("direct")} className="glass-btn flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold">
              <MessageSquarePlus size={17} /> New chat
            </button>
            <button type="button" onClick={() => setSheet("group")} className="glass-btn flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold">
              <Users size={17} /> New group
            </button>
          </div>

          {status === "loading" && threads.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Loading your chats…</p>}
          {status !== "loading" && threads.length === 0 && (
            <section className="glass rounded-3xl p-6 text-center">
              <p className="font-semibold">No chats yet</p>
              <p className="mt-1 text-sm text-slate-500">Start a chat with a player using their mobile number, or create a group for your team.</p>
            </section>
          )}

          <ul className="space-y-2">
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`/chat/${t.id}`} className="glass flex items-center gap-3 rounded-3xl p-3.5">
                  {t.kind === "group" ? (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-brand"><Users size={22} /></span>
                  ) : (
                    <ProfileAvatar name={t.title} captain={false} size={48} src={t.avatar} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{t.title}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{t.lastMessage ? chatTime(t.lastMessageAt) : ""}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-xs ${t.unread > 0 ? "font-medium text-slate-700" : "text-slate-500"}`}>
                        {t.lastMessage ? `${t.kind === "group" && t.lastFrom ? t.lastFrom + ": " : t.lastFrom === "You" ? "You: " : ""}${t.lastMessage}` : "No messages yet"}
                      </span>
                      {t.unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
                          {t.unread > 9 ? "9+" : t.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}


      {sheet && <NewChatSheet initialMode={sheet} onClose={() => setSheet(null)} />}
    </main>
  );
}
