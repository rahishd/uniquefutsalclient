"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { threadsStore, type ChatThreadRow } from "@/lib/chat";

const SHOW_MS = 6500;

// A pop-up at the top of the screen when a new chat message arrives, or a new chat appears (someone started one with you or added you to a
// group). Tap it to open that chat. It does not show for the chat you are already looking at, and it never shows the first time the chat list
// loads (that is not news). The chat list is refreshed every few seconds while the app is open (lib/chat.ts).
export default function ChatPopup() {
  const router = useRouter();
  const pathname = usePathname();
  const threads = threadsStore.use().data;
  const seen = useRef<Map<string, number> | null>(null); // thread id -> unread count the last time we looked
  const [popup, setPopup] = useState<{ id: string; title: string; text: string; more: number } | null>(null);
  const pathRef = useRef(pathname);

  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  useEffect(() => {
    if (!threads) return;
    // state changes happen inside the timer callback, like the rest of the app
    const t = setTimeout(() => {
      const before = seen.current;
      seen.current = new Map(threads.map((r) => [r.id, r.unread]));
      if (!before) return; // the first list is not news
      const open = pathRef.current.startsWith("/chat/") ? pathRef.current.split("/")[2] : null;
      const fresh = threads
        .filter((r: ChatThreadRow) => r.unread > (before.get(r.id) ?? 0) && r.id !== open)
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
      if (fresh.length === 0) return;
      const r = fresh[0];
      const text = r.lastMessage ? `${r.kind === "group" && r.lastFrom ? `${r.lastFrom}: ` : ""}${r.lastMessage}` : "New chat";
      setPopup({ id: r.id, title: r.title, text, more: fresh.length - 1 });
    }, 0);
    return () => clearTimeout(t);
  }, [threads]);

  // goes away by itself
  useEffect(() => {
    if (!popup) return;
    const t = setTimeout(() => setPopup(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [popup]);

  if (!popup) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[85] mx-auto flex w-full max-w-md justify-center px-3 tab:max-w-2xl" role="status" aria-live="polite">
      <div className="uf-chat-popup pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-white p-3 pr-2 text-[#0c0b5d] shadow-[0_14px_34px_-10px_rgba(12,11,93,0.45)] ring-1 ring-sky-100">
        <button
          type="button"
          onClick={() => { const id = popup.id; setPopup(null); router.push(`/chat/${id}`); }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`New message from ${popup.title}. Open the chat`}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0c0b5d] text-white"><MessageCircle size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{popup.title}</span>
            <span className="block truncate text-sm text-slate-600">{popup.text}</span>
            {popup.more > 0 && <span className="block text-[11px] font-medium text-brand">and {popup.more} more {popup.more === 1 ? "chat" : "chats"}</span>}
          </span>
        </button>
        <button type="button" onClick={() => setPopup(null)} aria-label="Dismiss" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X size={16} /></button>
      </div>
    </div>
  );
}
