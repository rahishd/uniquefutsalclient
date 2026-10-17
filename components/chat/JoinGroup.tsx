"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { errorText } from "@/lib/api";
import { joinInvite, loadInvite, threadsStore, type InvitePreview } from "@/lib/chat";
import { openSignIn, useSession } from "@/lib/session";

// The page behind a group invite link: /chat/join/<code>.
export default function JoinGroup({ code }: { code: string }) {
  const router = useRouter();
  const session = useSession();
  const registered = session?.registered === true;
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!registered) return;
    let live = true;
    loadInvite(code).then((p) => live && setPreview(p)).catch((e) => live && setError(errorText(e)));
    return () => {
      live = false;
    };
  }, [code, registered]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const { id } = await joinInvite(code);
      threadsStore.refresh();
      router.replace(`/chat/${id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-32 pt-10 tab:max-w-2xl">
      <section className="glass rounded-3xl p-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-brand"><Users size={26} /></span>
        {!registered ? (
          <>
            <p className="mt-3 font-semibold">Sign in to join this group</p>
            <button type="button" onClick={openSignIn} className="glass-btn mt-4 rounded-full px-6 py-3 text-sm font-semibold">Sign in</button>
          </>
        ) : error ? (
          <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>
        ) : !preview ? (
          <p className="mt-3 text-sm text-slate-500">Checking the invite…</p>
        ) : (
          <>
            <p className="mt-3 text-lg font-semibold">{preview.name}</p>
            <p className="text-sm text-slate-500">{preview.memberCount} people</p>
            {preview.alreadyIn ? (
              <button type="button" onClick={() => router.replace(`/chat/${preview.id}`)} className="glass-btn mt-5 rounded-full px-6 py-3 text-sm font-semibold">Open chat</button>
            ) : preview.full ? (
              <p className="mt-4 text-sm text-slate-500">This group is full.</p>
            ) : (
              <button type="button" disabled={busy} onClick={join} className="glass-btn mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-60">
                {busy && <Loader2 size={16} className="animate-spin" />} Join group
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
