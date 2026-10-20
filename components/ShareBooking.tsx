"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, MessageCircle, Search, Share2, Users, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { sendMessage, threadsStore, type ChatThreadRow } from "@/lib/chat";
import { site } from "@/lib/site";
import SendPdfButton from "@/components/SendPdfButton";
import { pdfFileName, type PdfSpec } from "@/lib/branded-pdf";

// "Share" on a booking confirmation: to WhatsApp (any contact or group there), to a chat or group inside this app, or
// through the phone's own share sheet. The message holds only what the customer sees on the confirmation.

/** The text that is shared: a title, the booking lines ("Date: ...") and the venue. */
export function bookingShareText(title: string, lines: [string, string][], code: string) {
  return [`${title} at ${site.name}`, ...lines.map(([k, v]) => `${k}: ${v}`), `Booking ID: ${code}`, `📍 ${site.address}`].join("\n");
}

// The same text turned back into its parts (title, the "Key: Value" lines, the booking id) so it can be printed as a branded PDF page.
// The format is the one bookingShareText writes just above: keep the two together.
function bookingPdf(text: string): PdfSpec & { code: string } {
  const lines = text.split("\n");
  const title = (lines[0] ?? "Booking").replace(new RegExp(` at ${site.name}$`), "").replace(/^[^A-Za-z0-9]+/, "").trim();
  const rows: { label: string; value: string }[] = [];
  let code = "";
  for (const l of lines.slice(1)) {
    const i = l.indexOf(": ");
    if (i < 1 || l.startsWith("📍")) continue;
    const k = l.slice(0, i), v = l.slice(i + 2);
    if (k === "Booking ID") code = v; else rows.push({ label: k, value: v });
  }
  return {
    purpose: "BOOKING DETAILS", title, subtitle: `Your game at ${site.name}`, ref: code, code,
    rows: [...rows, { label: "Where", value: site.address }, { label: "Booking ID", value: code, big: true }],
    note: "Show this page or your Booking ID at the venue. To change or cancel, open My bookings in the Unique Futsal app.",
  };
}

export default function ShareBooking({ text, registered }: { text: string; registered: boolean }) {
  const [picking, setPicking] = useState(false);

  return (
    <section className="glass space-y-3 rounded-3xl p-5" aria-label="Share this booking">
      <p className="flex items-center gap-2 text-sm font-medium"><Share2 size={16} className="text-brand" /> Share with your team</p>
      <div className={`grid gap-2 ${registered ? "grid-cols-2" : "grid-cols-1"}`}>
        <SendPdfButton
          label="WhatsApp (PDF)"
          build={() => bookingPdf(text)}
          filename={(spec) => pdfFileName("booking", bookingPdf(text).code || spec.title)}
          message={() => `${bookingPdf(text).title} at ${site.name}. Booking ID ${bookingPdf(text).code}. The details are in the attached PDF.`}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-semibold text-white"
        />
        {registered && (
          <button type="button" onClick={() => setPicking(true)} className="flex items-center justify-center gap-2 rounded-full bg-[#0c0b5d] py-3 text-sm font-semibold" style={{ color: "#ffffff" }}>
            <MessageCircle size={18} aria-hidden /> Chat or Group
          </button>
        )}
      </div>
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
