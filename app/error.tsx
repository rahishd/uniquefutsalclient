"use client";

import { useEffect, useState } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { autoReload, errorLine, shouldAutoReload } from "@/lib/error-recovery";

// Shown when something on a page crashes. The bottom bar and header stay, so the person can simply go to another tab.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // a new version came out while the app was open: reload once to get it
  const [updating] = useState(() => shouldAutoReload(error));

  useEffect(() => {
    console.error(error);
    if (updating) autoReload(); // a new version came out while the app was open
  }, [error, updating]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-600"><TriangleAlert size={28} /></span>
      <h1 className="mt-4 text-xl font-semibold">{updating ? "Updating the app…" : "This page couldn't load"}</h1>
      <p className="mt-1 text-sm text-slate-500">{updating ? "A new version is ready. One moment." : "Something went wrong on our side. Try again, or open another tab below."}</p>
      {!updating && (
        <>
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={() => retry()} className="glass-btn rounded-full px-5 py-2.5 text-sm font-semibold">Try again</button>
            <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-600"><RefreshCw size={14} /> Reload app</button>
          </div>
          <p className="mt-6 break-words text-[11px] text-slate-400">If it keeps happening, tell us this: {errorLine(error)}</p>
        </>
      )}
    </main>
  );
}
