"use client";

import { useSyncExternalStore } from "react";

// The same test as the `desk:` class (see globals.css). Lets a component mount only the phone version or only the desktop version of something
// (for example a header ad, so it is counted as a view once), instead of mounting both and hiding one with CSS.
const DESK = "(min-width: 1024px) and ((orientation: landscape) or ((hover: hover) and (pointer: fine)))";
const watch = (cb: () => void) => {
  const q = window.matchMedia(DESK);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};

export const useDesk = () => useSyncExternalStore(watch, () => window.matchMedia(DESK).matches, () => false);
