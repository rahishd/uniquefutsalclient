"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Check, CheckCheck, Info, Send, Trash2, Users, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { BODY_MAX, chatTime, deleteMessage, loadMessages, loadStatus, loadThread, sendMessage, threadsStore, unreadStore, type ChatInfo, type ChatMessage } from "@/lib/chat";
import { openSignIn, useSession } from "@/lib/session";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import GroupInfoSheet from "@/components/chat/GroupInfoSheet";

const TIP_KEY = "uf_chat_tip_seen";

// One conversation. New messages, read receipts and deletions are fetched every few seconds while the page is open.
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
  const [reads, setReads] = useState<string[]>([]); // when each other member last opened the chat
  const [gone, setGone] = useState<Set<string>>(new Set()); // ids of messages deleted since they were loaded
  const [menuFor, setMenuFor] = useState<ChatMessage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tip, setTip] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem(TIP_KEY) !== "1"; } catch { return false; }
  });
  const last = useRef<string | undefined>(undefined);
  const bottom = useRef<HTMLDivElement>(null);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = (m: ChatMessage) => {
    press.current = setTimeout(() => setMenuFor(m), 450);
  };
  const stopPress = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
  };
  const closeTip = () => {
    setTip(false);
    try { localStorage.setItem(TIP_KEY, "1"); } catch {}
  };

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
        .then(async (r) => {
          if (!live) return;
          merge(r);
          setLoaded(true);
          threadsStore.refresh();
          unreadStore.refresh();
          // who has seen what, and what was deleted (a failed check just keeps what is shown)
          const s = await loadStatus(id).catch(() => null);
          if (live && s) {
            setReads(s.reads);
            setGone(new Set(s.deleted));
          }
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
  // how many other people have opened the chat since a message was sent
  const seenBy = (m: ChatMessage) => reads.filter((r) => new Date(r).getTime() >= new Date(m.createdAt).getTime()).length;
  const lastMine = [...messages].reverse().find((m) => m.mine && !m.deleted && !gone.has(m.id));

  async function removeMessage() {
    if (!menuFor || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteMessage(id, menuFor.id);
      const done = menuFor.id;
      setGone((cur) => new Set(cur).add(done));
      setMenuFor(null);
      threadsStore.refresh();
    } catch (e) {
      setError(errorText(e));
      setMenuFor(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-5 tab:max-w-2xl desk:max-w-2xl" style={{ minHeight: "calc(100dvh - 9rem)" }}>
      <header className="sticky top-[calc(env(safe-area-inset-top)+6.5rem)] desk:top-16 z-10 -mx-5 flex items-center gap-3 border-b border-slate-100 bg-white px-5 py-3">
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

      {tip && (
        <div role="note" className="mt-3 flex items-start gap-2.5 rounded-2xl bg-blue-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
          <Info size={16} className="mt-0.5 shrink-0 text-brand" />
          <p className="flex-1">
            <b className="text-slate-800">Good to know:</b> a single tick <Check size={12} className="inline text-slate-400" /> means sent and a blue double tick <CheckCheck size={13} className="inline text-blue-600" /> means seen.
            To delete one of your messages, press and hold it, then tap Delete message. It disappears for everyone.
          </p>
          <button type="button" onClick={closeTip} aria-label="Hide tip" className="shrink-0 rounded-full p-1 text-slate-400"><X size={14} /></button>
        </div>
      )}

      <div className="flex-1 space-y-2 py-4" aria-live="polite">
        {loaded && messages.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No messages yet. Say hello.</p>}
        {messages.map((m, i) => {
          const showName = isGroup && !m.mine && messages[i - 1]?.senderId !== m.senderId;
          const removed = m.deleted || gone.has(m.id);
          const seen = seenBy(m);
          const everyone = reads.length > 0 && seen === reads.length;
          const canDelete = m.mine && !removed;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${m.mine ? "justify-end" : "justify-start"}`}>
              {m.mine && <span aria-hidden className="order-first mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0c0b5d] text-[10px] font-bold text-white ring-2 ring-white">Me</span>}
              <div
                onPointerDown={canDelete ? () => startPress(m) : undefined}
                onPointerUp={canDelete ? stopPress : undefined}
                onPointerLeave={canDelete ? stopPress : undefined}
                onPointerCancel={canDelete ? stopPress : undefined}
                onPointerMove={canDelete ? stopPress : undefined}
                onContextMenu={canDelete ? (e) => { e.preventDefault(); setMenuFor(m); } : undefined}
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${canDelete ? "select-none [-webkit-touch-callout:none]" : ""} ${removed ? "bg-slate-50 text-slate-400 ring-1 ring-slate-100" : m.mine ? "bg-[#dbeafe] text-[#0c0b5d]" : "bg-slate-100 text-slate-800"}`}
              >
                {showName && <p className="mb-0.5 text-[11px] font-semibold text-brand">{m.senderName}</p>}
                {removed ? (
                  <p className="flex items-center gap-1.5 italic"><Ban size={13} /> This message was deleted</p>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                )}
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                  {chatTime(m.createdAt)}
                  {m.mine && !removed && (everyone ? <CheckCheck size={14} className="text-blue-600" aria-label="Seen" /> : <Check size={14} aria-label="Sent" />)}
                </p>
              </div>
            </div>
          );
        })}
        {lastMine && (
          <p className="pr-1 text-right text-[11px] font-medium text-slate-400" aria-live="polite">
            {reads.length > 0 && seenBy(lastMine) === reads.length
              ? "Seen"
              : isGroup && seenBy(lastMine) > 0
                ? `Seen by ${seenBy(lastMine)} of ${reads.length}`
                : "Unseen"}
          </p>
        )}
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

      {menuFor && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setMenuFor(null)}>
          <div role="dialog" aria-modal="true" aria-label="Message options" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8">
            <p className="line-clamp-2 rounded-2xl bg-[#dbeafe] px-3.5 py-2.5 text-sm text-[#0c0b5d]">{menuFor.body}</p>
            <button type="button" onClick={removeMessage} disabled={deleting} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3.5 text-sm font-semibold text-red-600 disabled:opacity-60">
              <Trash2 size={17} /> {deleting ? "Deleting…" : "Delete message"}
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">It will be deleted for everyone in this chat.</p>
            <button type="button" onClick={() => setMenuFor(null)} className="mt-3 w-full rounded-2xl bg-slate-100 py-3.5 text-sm font-semibold text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      {showInfo && info && <GroupInfoSheet info={info} onClose={() => setShowInfo(false)} onChanged={reloadInfo} />}
    </main>
  );
}
