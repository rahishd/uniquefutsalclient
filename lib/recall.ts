"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

// Short-term memory for what the customer was doing. A drop-in for useState: the value is kept in the browser for RECALL_MS after it was
// last changed, so if they leave a page (Home, another tab, a call) and come back within a minute, the time slot, date, choices and typed
// details are still there. After that minute it is forgotten and the page starts fresh. Nothing leaves the device.
//   const [selHour, setSelHour] = useRecallState<number | null>("booking.hour", null);
// Options: `skip` ignores what was saved (for example when a link already chose the value); `save` changes what is written (for example to
// never remember a payment step); `ttl` overrides the minute.
export const RECALL_MS = 60_000;
const PREFIX = "uf_recall:";

function read<T>(key: string, ttl: number): { v: T } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const o = JSON.parse(raw) as { v: T; t: number };
    if (typeof o.t !== "number" || Date.now() - o.t > ttl) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return { v: o.v };
  } catch {
    return null;
  }
}

function write(key: string, v: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ v, t: Date.now() }));
  } catch {
    /* storage full or blocked: the page still works, it just forgets */
  }
}

export function forgetRecall(prefix: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX + prefix)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export function useRecallState<T>(key: string, initial: T, opts: { skip?: boolean; save?: (v: T) => T; ttl?: number } = {}): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const { skip, save, ttl = RECALL_MS } = opts;

  // after the first paint (so the server and the browser agree on the first render), bring back what was saved
  useEffect(() => {
    if (!skip) {
      const r = read<T>(key, ttl);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- bringing back what the browser saved is syncing with an external system
      if (r) setValue(r.v);
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) write(key, save ? save(value) : value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key, value]);

  return [value, setValue];
}
