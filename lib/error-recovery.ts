// Shared by app/error.tsx and app/global-error.tsx.
//
// After a new version goes live, an app that was already open (or installed on a phone) can still ask for files of the OLD version, which no
// longer exist. That throws a "loading chunk" style error and the page crashes, although a reload fixes it. For that one kind of error the
// page reloads itself once; every other error stays on screen with its text so it can be reported.

const STALE = /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to load chunk/i;
const KEY = "uf-auto-reload-at";
const WAIT_MS = 60_000; // never reload in a loop

export const isStaleAppError = (error: unknown) => STALE.test(`${(error as Error | undefined)?.name ?? ""} ${(error as Error | undefined)?.message ?? ""}`);

/** Is this a stale-version error that has not already been reloaded for in the last minute? (the screen then says "Updating") */
export function shouldAutoReload(error: unknown): boolean {
  if (typeof window === "undefined" || !isStaleAppError(error)) return false;
  try {
    return Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) >= WAIT_MS;
  } catch {
    return false; // storage blocked: do not risk a reload loop
  }
}

/** Remember that we reloaded (so it never loops) and reload. */
export function autoReload() {
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* storage blocked: shouldAutoReload is already false */ }
  window.location.reload();
}

/** A short line to show (and report): the message plus the server's reference when there is one. */
export function errorLine(error: Error & { digest?: string }): string {
  const text = (error.message || "Unknown error").slice(0, 200);
  return error.digest ? `${text} (ref ${error.digest})` : text;
}
