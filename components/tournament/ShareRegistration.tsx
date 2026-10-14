"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { registrationLink } from "@/lib/tournament";

// Copy or send the registration link of one tournament (WhatsApp opens with the message ready).
export default function ShareRegistration({ id, name }: { id: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => registrationLink(id);

  async function copy() {
    const link = url();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const t = document.createElement("textarea");
      t.value = link;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy"); } catch { /* the link is shown on screen anyway */ }
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
        {copied ? <><Check size={15} /> Link copied</> : <><Copy size={15} /> Copy link</>}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`Register your team for ${name} at Unique Futsal: ${url()}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => { e.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(`Register your team for ${name} at Unique Futsal: ${url()}`)}`; }}
        className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white"
      >
        <MessageCircle size={15} /> Share on WhatsApp
      </a>
    </div>
  );
}
