"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info, Send, Users } from "lucide-react";
import { errorText } from "@/lib/api";
import { BODY_MAX, chatTime, loadMessages, loadThread, sendMessage, threadsStore, unreadStore, type ChatInfo, type ChatMessage } from "@/lib/chat";
import { openSignIn, useSession } from "@/lib/session";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import GroupInfoSheet from "@/components/chat/GroupInfoSheet";

// One conversation. New messages are fetched every few seconds while the page is open.
export default function ThreadView({ id }: { id: string }) {
  const session = useSession();
  const registered = session?.registered === true;
  const [info, setInfo] = useState<ChatInfo | null>(null);
  const [missing, setMissing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const last = useRef<string | undefined>(undefined);
  const bottom = useRef<HTMLDivElement>(null);

  const reloadInfo = useCallback(() => {
    loadThread(id).then(setInfo).catch(() => setMissing(true));
  }, [id]);

  useEffect(() => {
    if (!registered) return;
    reloadInfo();
  }, [registered, reloadInfo]);

  const merge = useCallback((fresh: ChatMessage[]) => {
    if (!fresh.length) return;
    last.current = fresh[fresh.length - 1].createdAt;
    setMessages((cur) => {
      const have = new Set(cur.map((m) => m.id));
      return [...cur, ...fresh.filter((m) => !have.has(m.id))];
    });
  }, []);

  useEffect(() => {
    if (!registered || missing) return;
    let live = true;
    const pull = () =>
      loadMessages(id, last.current)
        .then((r) => {
          if (!live) return;
          merge(r);
          setLoaded(true);
          threadsStore.refresh();
          unreadStore.refresh();
        })
        .catch((e) => live && !loaded && setError(errorText(e)));
    pull();
    const t = setInterval(pull, 3000);
    return () => {
      live = false;
      clearInterval(t);
    };
    // `loaded` only matters for the first error message
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, registered, missing, merge]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function submit() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const m = await sendMessage(id, body);
      setText("");
      merge([m]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSending(false);
    }
  }

  if (!registered) {
    return (
      <main className="mx-auto w-full max-w-md px-5 pt-8 tab:max-w-2xl">
        <section className="glass rounded-3xl p-5 text-center">
          <p className="font-semibold">Sign in to chat</p>
          <button type="button" onClick={openSignIn} className="glass-btn mt-4 rounded-full px-6 py-3 text-sm font-semibold">Sign in</button>
        </section>
      </main>
    );
  }

  if (missing) {
    return (
      <main className="mx-auto w-full max-w-md px-5 pt-8 tab:max-w-2xl text-center">
        <p className="font-semibold">This chat is not available</p>
        <p className="mt-1 text-sm text-slate-500">You may have left the group, or it was closed.</p>
        <Link href="/chat" className="glass-btn mt-4 inline-block rounded-full px-6 py-3 text-sm font-semibold">Back to chats</Link>
      </main>
    );
  }

  const isGroup = info?.kind === "group";

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-5 tab:max-w-2xl desk:max-w-2xl" style={{ minHeight: "calc(100dvh - 9rem)" }}>
      <header className="sticky top-16 z-10 -mx-5 flex items-center gap-3 border-b border-slate-100 bg-white px-5 py-3">
        <Link href="/chat" aria-label="Back to chats" className="rounded-full p-1.5 text-brand"><ArrowLeft size={20} /></Link>
        {isGroup ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-brand"><Users size={20} /></span>
        ) : (
          <ProfileAvatar name={info?.title ?? "?"} captain={false} size={40} src={info?.avatar} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{info?.title ?? "Chat"}</span>
          {isGroup && <span className="block text-xs text-slate-500">{info?.members.length} people</span>}
        </span>
        {isGroup && (
          <button type="button" onClick={() => setShowInfo(true)} aria-label="Group info" className="rounded-full p-2 text-brand"><Info size={20} /></button>
        )}
      </header>

      <div className="flex-1 space-y-2 py-4" aria-live="polite">
        {loaded && messages.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No messages yet. Say hello.</p>}
        {messages.map((m, i) => {
          const showName = isGroup && !m.mine && messages[i - 1]?.senderId !== m.senderId;
          return (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.mine ? "bg-[#dbeafe] text-[#0c0b5d]" : "bg-slate-100 text-slate-800"}`}>
                {showName && <p className="mb-0.5 text-[11px] font-semibold text-brand">{m.senderName}</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-0.5 text-right text-[10px] text-slate-400">{chatTime(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {error && <p role="alert" className="mb-2 rounded-xl bg-red-500/10 p-2.5 text-sm text-red-600">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="sticky bottom-20 z-10 -mx-5 flex items-end gap-2 border-t border-slate-100 bg-white px-5 py-3 desk:bottom-0"
      >
        <textarea
          value={text}
          rows={1}
          maxLength={BODY_MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Write a message"
          aria-label="Message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none"
        />
        <button type="submit" disabled={sending || !text.trim()} aria-label="Send" className="glass-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50">
          <Send size={18} />
        </button>
      </form>

      {showInfo && info && <GroupInfoSheet info={info} onClose={() => setShowInfo(false)} onChanged={reloadInfo} />}
    </main>
  );
}
