"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, User } from "lucide-react";
import { useSession } from "@/lib/session";
import { useT } from "@/lib/i18n";

// Desktop header, far right: the Profile button (signed-in customer; signing out is on the Profile page), or Log in / Sign up (guest).
export default function HeaderLogout() {
  const session = useSession();
  const pathname = usePathname();
  const t = useT();
  if (!session) return null;
  if (!session.registered) {
    const link = "uf-hdr-outline hidden items-center gap-1.5 whitespace-nowrap text-[13px] transition-colors desk:flex";
    return (
      <>
        <Link href="/login" className={link}><LogIn size={14} aria-hidden /> {t("Log in")}</Link>
        <Link href="/login?mode=up" className={link}>{t("Sign up")}</Link>
      </>
    );
  }
  const here = pathname === "/profile" || pathname.startsWith("/profile/");
  return (
    <Link href="/profile" aria-current={here ? "page" : undefined} className="uf-hdr-outline hidden items-center gap-1.5 whitespace-nowrap text-[13px] transition-colors desk:flex">
      <User size={14} aria-hidden /> {t("Profile")}
    </Link>
  );
}
