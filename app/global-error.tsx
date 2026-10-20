"use client";

import { useEffect, useState } from "react";
import { autoReload, errorLine, shouldAutoReload } from "@/lib/error-recovery";

// The last safety net: the page itself (root layout) crashed. It replaces the whole document, so it carries its own tags and plain styles.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // a new version came out while the app was open: reload once to get it
  const [updating] = useState(() => shouldAutoReload(error));

  useEffect(() => {
    console.error(error);
    if (updating) autoReload();
  }, [error, updating]);

  const button = { border: 0, borderRadius: 999, padding: "12px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer" } as const;
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fff", color: "#0f172a" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{updating ? "Updating the app…" : "This page couldn't load"}</h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: "8px 0 0" }}>{updating ? "A new version is ready. One moment." : "Something went wrong. Try again, or reload the app."}</p>
          {!updating && (
            <>
              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                <button type="button" onClick={() => retry()} style={{ ...button, background: "#0c0b5d", color: "#fff" }}>Try again</button>
                <button type="button" onClick={() => window.location.reload()} style={{ ...button, background: "#f1f5f9", color: "#475569" }}>Reload app</button>
              </div>
              <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 24, wordBreak: "break-word" }}>If it keeps happening, tell us this: {errorLine(error)}</p>
            </>
          )}
        </main>
      </body>
    </html>
  );
}
