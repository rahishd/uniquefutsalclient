"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { signOut, useSession } from "@/lib/session";
import { useT } from "@/lib/i18n";
import { askConfirm } from "@/lib/confirm";

// Desktop header: sign out of the account (signed-in customer; it asks first, then goes back to Home as a guest), or Log in / Sign up (guest).
export default function HeaderLogout() {
  const session = useSession();
  const router = useRouter();
  const t = useT();
  if (!session) return null;
  if (!session.registered) {
    const link = "hidden items-center gap-1.5 whitespace-nowrap px-2.5 py-2 text-xs font-medium text-white/85 transition-colors hover:text-white desk:flex";
    return (
      <>
        <Link href="/login" className={link}><LogIn size={14} aria-hidden /> {t("Log in")}</Link>
        <Link href="/login?mode=up" className={link}>{t("Sign up")}</Link>
      </>
    );
  }
  return (
    <button
      type="button"
      onClick={async () => { if (await askConfirm(t("Sign out of Unique Futsal?"), { title: t("Sign out"), confirmLabel: t("Sign out") })) { signOut(); router.push("/"); } }}
      aria-label={t("Sign out")}
      title={t("Sign out")}
      className="hidden items-center gap-1.5 whitespace-nowrap px-2.5 py-2 text-xs font-medium !bg-transparent text-white/85 transition-colors hover:text-white desk:flex"
    >
      <LogOut size={14} aria-hidden /> {t("Logout")}
    </button>
  );
}
