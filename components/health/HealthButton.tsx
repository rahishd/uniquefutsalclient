"use client";

import Link from "next/link";
import { HeartPulse } from "lucide-react";
import LockedIcon from "@/components/LockedIcon";
import { useSession } from "@/lib/session";

// "My Health" icon on Home: the health tracker and play-day reminders. Guests see it with a lock and are taken to sign in.
export default function HealthButton() {
  const session = useSession();
  if (!session?.registered) return <LockedIcon label="My Health" message="Sign in to view your health details."><HeartPulse size={18} /></LockedIcon>;
  return (
    <Link href="/health" aria-label="My Health" title="My Health" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcebff] text-black shadow-sm">
      <HeartPulse size={18} />
    </Link>
  );
}
