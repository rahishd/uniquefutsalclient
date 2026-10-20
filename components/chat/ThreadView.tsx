"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, CalendarPlus, Check, CheckCheck, Flag, Info, Phone, Reply, Send, Trash2, Users, X } from "lucide-react";
import ShareBookingSheet from "@/components/chat/ShareBookingSheet";
import { errorText } from "@/lib/api";
import { BODY_MAX, chatTime, FALLBACK_REPORT_REASONS, deleteMessage, loadMessages, reportMessage, loadStatus, loadThread, sendMessage, threadsStore, unreadStore, type ChatInfo, type ChatMessage } from "@/lib/chat";
import { openSignIn, useSession } from "@/lib/session";
import { startCall, supported as callsSupported, useCall } from "@/lib/call";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import GroupInfoSheet from "@/components/chat/GroupInfoSheet";

// One conversation. New messages, read receipts and deletions are fetched every few seconds while the page is open.
export default function ThreadView({ id }: { id: string }) {
  const session = useSession();
  const call = useCall();
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
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null); // the message my next one answers
  const [flash, setFlash] = useState<string | null>(null); // a message briefly highlighted after tapping its quote
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false); // the share-a-booking sheet is open
  const [reporting, setReporting] = useState(false); // the sheet is on its report step
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [sendingReport, setSendingReport] = useState(false);
  const [reportDone, setReportDone] = useState<string | null>(null);
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  const last = useRef<string | undefined>(undefined);
  const bottom = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // am I at the bottom of the chat (so a new message should scroll into view)?
  const scrollNext = useRef<"auto" | "smooth" | null>(null); // scroll to the latest message once the new ones are on screen
  const started = useRef(false); // the first messages have been shown
  const shown = useRef<ChatMessage[]>([]); // what is on screen, to tell new messages from ones I already have
  const [newBelow, setNewBelow] = useState(false); // someone wrote while I was reading older messages
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = (m: ChatMessage, e: React.PointerEvent) => {
    pressAt.current = { x: e.clientX, y: e.clientY };
    press.current = setTimeout(() => {
      try { navigator.vibrate?.(15); } catch {}
      openMenu(m);
    }, 400);
  };
  const stopPress = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
  };
  // a real move (a scroll or a drag) cancels the hold, but the small wobble of a finger or mouse does not
  const movePress = (e: React.PointerEvent) => {
    const s = pressAt.current;
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12) stopPress();
  };
  const startReply = (m: ChatMessage) => {
    setReplyingTo(m);
    setMenuFor(null);
    setTimeout(() => document.getElementById("chat-box")?.focus(), 50);
  };
  // tapping a quote jumps to the original and lights it up for a moment
  const jumpTo = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(messageId);
    setTimeout(() => setFlash((f) => (f === messageId ? null : f)), 1400);
  };
  const openMenu = (m: ChatMessage) => {
    setReporting(false);
    setReason("");
    setNote("");
    setReportDone(null);
    setMenuFor(m);
  };
  const closeMenu = () => {
    setMenuFor(null);
    setReporting(false);
  };
  async function sendReport() {
    if (!menuFor || sendingReport || !reason) return;
    setSendingReport(true);
    setError(null);
    try {
      const r = await reportMessage(id, menuFor.id, reason, note.trim() || undefined);
      setReportDone(r.code);
    } catch (e) {
      setError(errorText(e));
      closeMenu();
    } finally {
      setSendingReport(false);
    }
  }

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
    const have = new Set(shown.current.map((m) => m.id));
    const added = fresh.filter((m) => !have.has(m.id));
    if (added.length === 0) return;
    // the first messages and anything I just sent scroll into view; someone else's message does too when I am already at the bottom,
    // otherwise a "New message" button says it arrived without moving what I am reading
    if (!started.current) { started.current = true; scrollNext.current = "auto"; }
    else if (added.some((m) => m.mine) || stick.current) scrollNext.current = "smooth";
    else setNewBelow(true);
    setMessages((cur) => {
      const have = new Set(cur.map((m) => m.id));
      return [...cur, ...fresh.filter((m) => !have.has(m.id))];
    });
  }, [setNewBelow]);

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

  // bring the latest message into view, above the message box and the bottom bar (the sentinel has a scroll margin for them)
  useEffect(() => {
    shown.current = messages;
    const how = scrollNext.current;
    if (!how) return;
    scrollNext.current = null;
    bottom.current?.scrollIntoView({ block: "end", behavior: how });
  }, [messages]);

  // am I at the bottom? (decides whether a friend's new message scrolls into view or shows the "New message" button)
  useEffect(() => {
    const onScroll = () => {
      const d = document.documentElement;
      const near = d.scrollHeight - (window.scrollY + window.innerHeight) < 260;
      stick.current = near;
      if (near) setNewBelow(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  async function submit(override?: string) {
    const body = (override ?? text).trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const m = await sendMessage(id, body, replyingTo?.id);
      if (override === undefined) setText("");
      setReplyingTo(null);
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
    <main className="mx-auto flex w-full max-w-md flex-col px-5 pb-40 pt-20 tab:max-w-2xl desk:max-w-2xl desk:pb-28 desk:pt-24" style={{ minHeight: "calc(100dvh - 9rem)" }}>
      <header className="fixed inset-x-0 top-[calc(max(calc(env(safe-area-inset-top)_-_0.625rem),0.5rem)_+_3.85rem)] desk:top-16 z-10 mx-auto flex w-full max-w-md items-center gap-3 border-b border-slate-100 bg-white px-5 py-3 tab:max-w-2xl desk:max-w-2xl">
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
        {info && !isGroup && callsSupported() && (
          <button type="button" onClick={() => void startCall(id, info.title, info.avatar)} disabled={call.phase !== "idle"} aria-label="Voice call" title="Voice call" className="rounded-full p-2 text-brand disabled:opacity-40">
            <Phone size={20} />
          </button>
        )}
        {isGroup && (
          <button type="button" onClick={() => setShowInfo(true)} aria-label="Group info" className="rounded-full p-2 text-brand"><Info size={20} /></button>
        )}
      </header>

      <div className="flex-1 space-y-2 py-4" aria-live="polite">
        {loaded && messages.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No messages yet. Say hello.</p>}
        {messages.map((m, i) => {
          const showName = isGroup && !m.mine && messages[i - 1]?.senderId !== m.senderId;
          const removed = m.deleted || gone.has(m.id);
          const seen = seenBy(m);
          const everyone = reads.length > 0 && seen === reads.length;
          const canAct = !removed; // yours to delete, someone else's to report
          return (
            <div key={m.id} id={`msg-${m.id}`} className={`flex items-end gap-1.5 rounded-2xl transition-colors duration-500 ${flash === m.id ? "bg-amber-100/70" : ""} ${m.mine ? "justify-end" : "justify-start"}`}>
              {m.mine && <span aria-hidden className="order-first mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0c0b5d] text-[10px] font-bold text-white ring-2 ring-white">Me</span>}
              {m.mine && canAct && (
                <button type="button" onClick={() => startReply(m)} aria-label="Reply" title="Reply" className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 active:bg-slate-100">
                  <Reply size={15} />
                </button>
              )}
              <div
                onPointerDown={canAct ? (e) => startPress(m, e) : undefined}
                onPointerUp={canAct ? stopPress : undefined}
                onPointerLeave={canAct ? stopPress : undefined}
                onPointerCancel={canAct ? stopPress : undefined}
                onPointerMove={canAct ? movePress : undefined}
                onContextMenu={canAct ? (e) => { e.preventDefault(); openMenu(m); } : undefined}
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${canAct ? "select-none [-webkit-touch-callout:none]" : ""} ${removed ? "bg-slate-50 text-slate-400 ring-1 ring-slate-100" : m.mine ? "bg-[#dbeafe] text-[#0c0b5d]" : "bg-slate-100 text-slate-800"}`}
              >
                {showName && <p className="mb-0.5 text-[11px] font-semibold text-brand">{m.senderName}</p>}
                {!removed && m.replyTo && (
                  <button type="button" onClick={() => jumpTo(m.replyTo!.id)} className="mb-1 block w-full rounded-lg border-l-4 border-[#0c0b5d]/60 bg-white/60 px-2 py-1 text-left">
                    <span className="block truncate text-[11px] font-semibold text-brand">{m.replyTo.senderName}</span>
                    <span className="block truncate text-xs text-slate-500">{m.replyTo.deleted ? "This message was deleted" : m.replyTo.body}</span>
                  </button>
                )}
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
              {!m.mine && canAct && (
                <button type="button" onClick={() => startReply(m)} aria-label="Reply" title="Reply" className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 active:bg-slate-100">
                  <Reply size={15} />
                </button>
              )}
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
        <div ref={bottom} className="scroll-mb-[calc(env(safe-area-inset-bottom)+9.5rem)] desk:scroll-mb-28" />
      </div>

      {newBelow && (
        <button
          type="button"
          onClick={() => { bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" }); setNewBelow(false); }}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+9.25rem)] left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#0c0b5d] px-4 py-2 text-xs font-semibold text-white shadow-lg desk:bottom-24"
        >
          New message ↓
        </button>
      )}

      {error && <p role="alert" className="mb-2 rounded-xl bg-red-500/10 p-2.5 text-sm text-red-600">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.75rem)] z-10 mx-auto flex w-full max-w-md flex-wrap items-end gap-2 border-t border-slate-100 bg-white px-5 py-3 tab:max-w-2xl desk:bottom-0 desk:max-w-2xl"
      >
        {replyingTo && (
          <div className="flex w-full items-center gap-2 rounded-xl border-l-4 border-[#0c0b5d] bg-slate-100 px-3 py-1.5">
            <Reply size={14} className="shrink-0 text-brand" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold text-brand">Replying to {replyingTo.mine ? "yourself" : replyingTo.senderName}</span>
              <span className="block truncate text-xs text-slate-500">{replyingTo.body}</span>
            </span>
            <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="shrink-0 rounded-full p-1 text-slate-400"><X size={16} /></button>
          </div>
        )}
        <button type="button" onClick={() => setSharing(true)} aria-label="Share a booking" title="Share a booking" className="glass-active flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#0c0b5d]">
          <CalendarPlus size={19} />
        </button>
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
          id="chat-box"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none"
        />
        <button type="submit" disabled={sending || !text.trim()} aria-label="Send" className="glass-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50">
          <Send size={18} />
        </button>
      </form>

      {sharing && (
        <ShareBookingSheet busy={sending} onClose={() => setSharing(false)} onPick={async (t) => { await submit(t); setSharing(false); }} />
      )}

      {menuFor && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm" onClick={closeMenu}>
          <div role="dialog" aria-modal="true" aria-label="Message options" onClick={(e) => e.stopPropagation()} className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8">
            <p className={`line-clamp-2 rounded-2xl px-3.5 py-2.5 text-sm ${menuFor.mine ? "bg-[#dbeafe] text-[#0c0b5d]" : "bg-slate-100 text-slate-800"}`}>{menuFor.body}</p>

            <button type="button" onClick={() => startReply(menuFor)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3.5 text-sm font-semibold text-[#0c0b5d]">
              <Reply size={17} /> Reply
            </button>

            {menuFor.mine ? (
              <>
                <button type="button" onClick={removeMessage} disabled={deleting} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3.5 text-sm font-semibold text-red-600 disabled:opacity-60">
                  <Trash2 size={17} /> {deleting ? "Deleting…" : "Delete message"}
                </button>
                <p className="mt-2 text-center text-xs text-slate-400">It will be deleted for everyone in this chat.</p>
              </>
            ) : reportDone ? (
              <div className="mt-5 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check size={28} /></span>
                <p className="mt-3 text-base font-semibold">Thank you, we got your report</p>
                <p className="mt-1 text-sm text-slate-500">Reference <span className="font-mono text-slate-700">{reportDone}</span>. The venue will look into it and answer under Complaints.</p>
              </div>
            ) : reporting ? (
              <div className="mt-4">
                <p className="text-sm font-semibold">Why are you reporting this message?</p>
                <div className="mt-2 grid gap-2" role="radiogroup" aria-label="Reason">
                  {FALLBACK_REPORT_REASONS.map((r) => (
                    <button key={r.id} type="button" role="radio" aria-checked={reason === r.id} onClick={() => setReason(r.id)}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm ${reason === r.id ? "bg-[#0c0b5d] font-semibold text-white" : "bg-slate-100 text-slate-700"}`}>
                      {r.label}
                      {reason === r.id && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <label className="mt-3 block text-xs font-medium text-slate-500">Anything we should know (optional)
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} placeholder="Tell us a little more"
                    className="mt-1 w-full rounded-2xl bg-slate-100 px-3.5 py-2.5 text-sm font-normal text-slate-800 outline-none ring-1 ring-black/5 focus:ring-[#0c0b5d]" />
                </label>
                <button type="button" onClick={sendReport} disabled={!reason || sendingReport} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0c0b5d] py-3.5 text-sm font-semibold text-white disabled:opacity-50">
                  <Flag size={16} /> {sendingReport ? "Sending…" : "Send report"}
                </button>
                <p className="mt-2 text-center text-xs text-slate-400">The venue team reads reports. The sender is not told it was you.</p>
              </div>
            ) : (
              <>
                <button type="button" onClick={() => setReporting(true)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-50 py-3.5 text-sm font-semibold text-amber-700">
                  <Flag size={17} /> Report message
                </button>
                <p className="mt-2 text-center text-xs text-slate-400">Tell the venue if this message is abusive, a scam or makes you feel unsafe.</p>
              </>
            )}

            <button type="button" onClick={closeMenu} className="mt-3 w-full rounded-2xl bg-slate-100 py-3.5 text-sm font-semibold text-slate-600">{reportDone ? "Close" : "Cancel"}</button>
          </div>
        </div>
      )}

      {showInfo && info && <GroupInfoSheet info={info} onClose={() => setShowInfo(false)} onChanged={reloadInfo} />}
    </main>
  );
}
