"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut, useSession } from "@/lib/session";
import { useT } from "@/lib/i18n";

// Desktop header: sign out of the account (only shown to a signed-in customer). It asks first, then goes back to Home as a guest.
export default function HeaderLogout() {
  const session = useSession();
  const router = useRouter();
  const t = useT();
  if (!session?.registered) return null;
  return (
    <button
      type="button"
      onClick={() => { if (window.confirm(t("Sign out of Unique Futsal?"))) { signOut(); router.push("/"); } }}
      aria-label={t("Sign out")}
      title={t("Sign out")}
      className="hidden items-center gap-1.5 whitespace-nowrap px-2.5 py-2 text-xs font-medium !bg-transparent text-white/85 transition-colors hover:text-white desk:flex"
    >
      <LogOut size={14} aria-hidden /> {t("Logout")}
    </button>
  );
}
