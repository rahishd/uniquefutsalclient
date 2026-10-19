"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { useT } from "@/lib/i18n";

// A round "back to top" button on the right. It only appears once the page has been scrolled to its end (and only on a page
// long enough to scroll), and takes the visitor smoothly back to the top. On the phone it sits well above the bottom bar, clear of the footer text.
// Not shown on the Profile page itself (it would sit over the Settings rows).
export default function BackToTop() {
  const t = useT();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight > 300;
      const atEnd = window.scrollY + window.innerHeight >= doc.scrollHeight - 80;
      setShow(scrollable && atEnd);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  if (pathname === "/profile") return null;

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label={t("Back to top")}
      title={t("Back to top")}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={`glass-active fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bottom-[calc(env(safe-area-inset-bottom)+175px)] transition-all duration-300 desk:right-8 desk:bottom-[calc(env(safe-area-inset-bottom)+96px)] ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <ArrowUp size={22} strokeWidth={2.4} />
    </button>
  );
}
