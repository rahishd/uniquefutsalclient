"use client";

import Link from "next/link";
import { ArrowLeft, Check, CheckCheck, Info, Trash2 } from "lucide-react";

// Chat menu > About Chat: how messages work (ticks and deleting). The same hints show once at the top of a conversation.
export default function AboutChat() {
  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-5 pb-32 pt-6 tab:max-w-2xl desk:max-w-2xl desk:pb-16">
      <header className="flex items-center gap-3">
        <Link href="/chat" aria-label="Back to Chat" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand shadow-sm ring-1 ring-slate-100"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-semibold">About Chat</h1>
          <p className="text-sm text-slate-500">Good to know before you chat</p>
        </div>
      </header>

      <section className="flex items-start gap-2.5 rounded-2xl bg-blue-50 px-4 py-3.5 text-sm leading-relaxed text-slate-600">
        <Info size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <p>
          <b className="text-slate-800">Good to know:</b> a single tick <Check size={13} className="inline text-slate-400" aria-label="single tick" /> means sent and a blue double tick <CheckCheck size={14} className="inline text-blue-600" aria-label="blue double tick" /> means seen.
          To delete one of your messages, press and hold it, then tap Delete message. It disappears for everyone.
        </p>
      </section>

      <section className="glass rounded-3xl p-5" aria-label="Message ticks">
        <h2 className="text-base font-semibold">Ticks on your messages</h2>
        <ul className="mt-3 space-y-3 text-sm">
          <li className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Check size={18} className="text-slate-400" /></span><span><b>Single tick:</b> your message was sent.</span></li>
          <li className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50"><CheckCheck size={18} className="text-blue-600" /></span><span><b>Blue double tick:</b> your message was seen.</span></li>
        </ul>
      </section>

      <section className="glass rounded-3xl p-5" aria-label="Deleting a message">
        <h2 className="text-base font-semibold">Delete a message</h2>
        <ul className="mt-3 space-y-3 text-sm">
          <li className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50"><Trash2 size={18} className="text-rose-500" /></span><span>Press and hold one of your messages, then tap <b>Delete message</b>.</span></li>
          <li className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Info size={18} className="text-brand" /></span><span>It disappears for everyone in the chat.</span></li>
        </ul>
      </section>
    </main>
  );
}
