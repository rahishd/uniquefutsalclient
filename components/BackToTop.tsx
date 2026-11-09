"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useT } from "@/lib/i18n";

// A small round red "back to top" button in the Home footer, between the payment methods and the footer line. Its place is always kept, but
// it only pops in (it grows and slides up) once the visitor has scrolled to the very end of the page, and it takes them smoothly back to the top.
export default function BackToTop() {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const doc = document.documentElement;
      setShow(window.scrollY + window.innerHeight >= doc.scrollHeight - 60);
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

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label={t("Back to top")}
      title={t("Back to top")}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={`grid h-9 w-9 place-items-center rounded-full bg-red-600 text-white shadow-[0_6px_14px_-5px_rgba(220,38,38,0.6)] ring-2 ring-white transition-all duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] active:scale-90 ${
        show ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-50 opacity-0"
      }`}
    >
      <ArrowUp size={18} strokeWidth={2.6} aria-hidden className={show ? "animate-bounce [animation-iteration-count:3]" : ""} />
    </button>
  );
}
