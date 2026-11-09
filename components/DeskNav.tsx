"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

// Top navigation for desktop mode (see the `desk:` variant in globals.css). On phones and portrait tablets the
// bottom bar is used instead, so this is hidden there.
const LINKS = [
  { label: "Home", href: "/" },
  { label: "Book now", href: "/book" },
  { label: "Opponent", href: "/opponent" },
  { label: "Gamezone", href: "/gamezone" },
  { label: "Membership", href: "/member" },
  { label: "Tournaments", href: "/tournaments" },
  { label: "Points", href: "/points" },
  { label: "Profile", href: "/profile" },
];

// the page you are on is marked with a line under it and a faint liquid-glass sheen; both glide (with a little overshoot) to the next page you open
export default function DeskNav() {
  const pathname = usePathname();
  const t = useT();
  const nav = useRef<HTMLElement>(null);
  const [mark, setMark] = useState<{ left: number; width: number } | null>(null);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  useEffect(() => {
    const place = () => {
      const el = nav.current?.querySelector<HTMLElement>('a[aria-current="page"]');
      setMark(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [pathname]);

  return (
    <nav ref={nav} aria-label="Main" className="relative ml-auto hidden items-center gap-0 desk:flex">
      {mark && (
        <>
          {/* the glass sheen behind the current page */}
          <span aria-hidden className="uf-nav-glass pointer-events-none absolute inset-y-0 rounded-md border shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-md" style={{ left: mark.left, width: mark.width, background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.28)" }} />
          {/* the line under it */}
          <span aria-hidden className="uf-nav-glass pointer-events-none absolute -bottom-1.5 h-0.5 rounded-sm bg-[#ffffff]" style={{ left: mark.left + 8, width: Math.max(0, mark.width - 16) }} />
        </>
      )}
      {LINKS.map((l) => {
        const active = isActive(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative whitespace-nowrap rounded-md border-0 px-2.5 py-2 text-xs !bg-transparent transition-colors ${active ? "font-semibold text-white" : "font-medium text-white/70 hover:text-white"}`}
          >
            {t(l.label)}
          </Link>
        );
      })}
    </nav>
  );
}
