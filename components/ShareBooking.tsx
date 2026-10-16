"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { FaWhatsapp } from "react-icons/fa6";
import { Check, Loader2, MessageCircle, Search, Share2, Users, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { sendMessage, threadsStore, type ChatThreadRow } from "@/lib/chat";
import { site } from "@/lib/site";

// "Share" on a booking confirmation: to WhatsApp (any contact or group there), to a chat or group inside this app, or
// through the phone's own share sheet. The message holds only what the customer sees on the confirmation.

/** The text that is shared: a title, the booking lines ("Date: ...") and the venue. */
export function bookingShareText(title: string, lines: [string, string][], code: string) {
  return [`${title} at ${site.name}`, ...lines.map(([k, v]) => `${k}: ${v}`), `Booking ID: ${code}`, `📍 ${site.address}`].join("\n");
}

const noopSubscribe = () => () => {};
const canNativeShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

export default function ShareBooking({ text, registered }: { text: string; registered: boolean }) {
  const [picking, setPicking] = useState(false);
  const native = useSyncExternalStore(noopSubscribe, canNativeShare, () => false);
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <section className="glass space-y-3 rounded-3xl p-5" aria-label="Share this booking">
      <p className="flex items-center gap-2 text-sm font-medium"><Share2 size={16} className="text-brand" /> Share with your team</p>
      <div className={`grid gap-2 ${registered ? "grid-cols-2" : "grid-cols-1"}`}>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-semibold" style={{ color: "#ffffff" }}>
          <FaWhatsapp size={18} aria-hidden /> WhatsApp
        </a>
        {registered && (
          <button type="button" onClick={() => setPicking(true)} className="flex items-center justify-center gap-2 rounded-full bg-[#0c0b5d] py-3 text-sm font-semibold" style={{ color: "#ffffff" }}>
            <MessageCircle size={18} aria-hidden /> Chat or Group
          </button>
        )}
      </div>
      {native && (
        <button type="button" onClick={() => navigator.share({ text }).catch(() => {})} className="w-full text-center text-xs font-medium text-brand">
          More ways to share…
        </button>
      )}
      {picking && <ChatPicker text={text} onClose={() => setPicking(false)} />}
    </section>
  );
}

// Pick one of your chats or groups and send the booking there as a message.
function ChatPicker({ text, onClose }: { text: string; onClose: () => void }) {
  const { data, status } = threadsStore.use();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, true>>({});
  const [error, setError] = useState<string | null>(null);

  const threads = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((t) => !s || t.title.toLowerCase().includes(s));
  }, [data, q]);

  async function send(t: ChatThreadRow) {
    setError(null);
    setBusy(t.id);
    try {
      await sendMessage(t.id, text);
      setSent((m) => ({ ...m, [t.id]: true }));
      threadsStore.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 desk:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Send to a chat or group" onClick={(e) => e.stopPropagation()} className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-white p-5 desk:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Send to a chat or group</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-slate-100"><X size={22} /></button>
        </div>
        <label className="relative mt-3 block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your chats" className="w-full rounded-2xl bg-slate-100 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand" />
        </label>
        {error && <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-2 text-sm text-rose-600">{error}</p>}
        <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
          {data === undefined && status !== "error" && <li className="h-14 animate-pulse rounded-2xl bg-slate-100" aria-label="Loading" />}
          {data === undefined && status === "error" && <li className="rounded-2xl bg-rose-50 px-4 py-4 text-center text-sm text-rose-600">Could not load your chats. Please try again.</li>}
          {data && threads.length === 0 && (
            <li className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              {data.length === 0 ? <>No chats yet. <Link href="/chat" className="font-medium text-brand">Start one in Chat</Link>.</> : "No chats match."}
            </li>
          )}
          {threads.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-brand">
                {t.kind === "group" ? <Users size={18} /> : <MessageCircle size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{t.title}</span>
                <span className="block text-xs text-slate-400">{t.kind === "group" ? `Group · ${t.memberCount} members` : "Chat"}</span>
              </span>
              {sent[t.id] ? (
                <Link href={`/chat/${t.id}`} className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-700"><Check size={14} /> Sent · Open</Link>
              ) : (
                <button type="button" onClick={() => send(t)} disabled={busy !== null} className="rounded-full bg-[#0c0b5d] px-4 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ color: "#ffffff" }}>
                  {busy === t.id ? <Loader2 size={14} className="animate-spin" /> : "Send"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
