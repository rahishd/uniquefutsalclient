import Link from "next/link";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";

// A Home quick icon a guest can see but not use: same look as the real one, with a lock badge, and a tap goes to sign in.
export default function LockedIcon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Link href="/login" aria-label={`${label} (sign in to use)`} title="Sign in to use" className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcebff] text-black shadow-sm">
      {children}
      <span aria-hidden className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-white ring-2 ring-white"><Lock size={9} /></span>
    </Link>
  );
}
