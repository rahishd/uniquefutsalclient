"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, MessageSquareWarning, UserRound } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { markReadByTypes } from "@/lib/notifications";
import { STATUS_TEXT, loadMine, photoUrl, type Complaint } from "@/lib/complaints";

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Profile > My complaints: what the customer sent to the venue, the status and the venue's reply. (Sending a new one is on /complaints.)
export default function MyComplaints() {
  const session = useSession();
  const [mine, setMine] = useState<Complaint[] | null>(null);
  const registered = session?.registered === true;

  useEffect(() => {
    if (!registered) return;
    let live = true;
    loadMine().then((m) => live && setMine(m)).catch(() => live && setMine([]));
    markReadByTypes(["complaint"]); // opening this page clears the replies badge
    return () => { live = false; };
  }, [registered]);

  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;
  if (!registered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand"><UserRound size={34} /></span>
        <h1 className="mt-6 text-2xl font-semibold">My complaints</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Sign in to see your complaints and our replies.</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4 desk:mx-auto desk:max-w-3xl">
      <Link href="/profile" className="flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Profile</Link>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My complaints</h1>
          <p className="text-sm text-slate-500">What you sent us, where it stands and our replies.</p>
        </div>
        <Link href="/complaints" className="glass-btn shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-white">New complaint</Link>
      </header>

      {mine === null && <div className="h-24 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />}
      {mine?.length === 0 && (
        <div className="glass flex flex-col items-center gap-2 rounded-3xl px-4 py-8 text-center text-sm text-slate-500">
          <MessageSquareWarning size={28} className="text-slate-400" />
          You have not sent any complaints.
        </div>
      )}
      <ul className="space-y-3">
        {mine?.map((c) => {
          const st = STATUS_TEXT[c.status];
          return (
            <li key={c.id} className="glass space-y-2 rounded-3xl p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{c.categoryLabel}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${st.tone}`}>{st.label}</span>
              </div>
              <p className="text-xs text-slate-400"><span className="font-mono">{c.code}</span> · {when(c.createdAt)}{c.bookingCode ? ` · booking ${c.bookingCode}` : ""}</p>
              <p className="whitespace-pre-line text-sm text-slate-600">{c.message}</p>
              {c.photos.length > 0 && (
                <div className="flex gap-2">
                  {c.photos.map((p, i) => (
                    <a key={p} href={photoUrl(p)} target="_blank" rel="noopener noreferrer" aria-label={`Open photo ${i + 1}`} className="block h-16 w-16 overflow-hidden rounded-xl bg-white/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl(p)} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {c.staffReply && (
                <div className="rounded-2xl bg-brand/10 px-4 py-3 text-sm">
                  <p className="text-xs font-semibold text-brand">Reply from the venue</p>
                  <p className="mt-1 whitespace-pre-line text-slate-700">{c.staffReply}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
