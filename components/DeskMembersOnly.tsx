"use client";

import { useSession } from "@/lib/session";

// A block of the Home page that guests do not see on the desktop web view (the phone view is unchanged). While the account is still loading
// it stays out of the way, so a guest never sees it flash.
export default function DeskMembersOnly({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const s = useSession();
  return <div className={`${className} ${s?.registered ? "" : "desk:hidden"}`}>{children}</div>;
}
