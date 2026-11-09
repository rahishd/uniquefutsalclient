"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";

// Shown to a guest or a new visitor, just under the hero banner on Home: a plain invitation (no card) to log in or create an account.
// Signed-in customers never see it.
export default function GuestPrompt({ className = "" }: { className?: string }) {
  const session = useSession();
  if (!session || session.registered) return null;
  return (
    <section aria-label="Log in or create an account" className={`px-2 py-5 text-center ${className}`}>
      <h2 className="text-lg font-bold text-[#0c0b5d] desk:text-xl">Log in or create an account</h2>
      <p className="mx-auto mt-1 max-w-sm text-[13px] leading-snug text-slate-500 desk:max-w-md desk:text-sm">Book games, earn loyalty points and play with your team.</p>
      <div className="mx-auto mt-4 flex max-w-xs items-center justify-center gap-3">
        <Link href="/login" className="flex-1 rounded-xl border-0 bg-[#dbeafe] py-2.5 text-sm font-semibold text-[#0c0b5d] transition active:scale-[0.97]">Log in</Link>
        <Link href="/login?mode=up" className="flex-1 rounded-xl border border-[#bfd7ff] bg-white py-2.5 text-sm font-semibold text-[#0c0b5d] transition active:scale-[0.97]">Create account</Link>
      </div>
    </section>
  );
}
