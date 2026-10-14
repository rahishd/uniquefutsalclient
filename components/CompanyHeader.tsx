import Link from "next/link";
import { site } from "@/lib/site";
import AdStrip from "@/components/ads/AdStrip";
import DeskNav from "@/components/DeskNav";
import HeaderToggles from "@/components/HeaderToggles";
import NotificationBell from "@/components/NotificationBell";

// Top bar on EVERY page: clean and white. The logo and name sit on the left with some air around them, and the
// theme, language and notification buttons on the right. It stays pinned while the page scrolls. In desktop mode
// (see `desk:` in globals.css) the bar spans the page and carries the main navigation, because the bottom bar is
// hidden there.
export default function CompanyHeader() {
  return (
    <div className="sticky top-0 z-30 border-b border-slate-100 bg-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto w-full max-w-md px-5 desk:max-w-none desk:px-10">
        <div className="flex min-h-16 items-center gap-3 py-2 desk:gap-3 2xl:gap-6">
          <Link href="/" aria-label={`${site.name} home`} className="flex min-w-0 items-center gap-2.5 desk:shrink-0">
            {/* The logo picture is white on navy; it stays a small navy tile, so the player reads as a white mark. */}
            <span
              aria-hidden
              className="h-10 w-10 shrink-0 rounded-xl bg-[#0c0b5d] bg-no-repeat"
              style={{
                backgroundImage: "url(/logo.jpg)",
                backgroundSize: "68px 68px",
                backgroundPosition: "-12px -4px",
                backgroundBlendMode: "lighten",
              }}
            />
            <span className="min-w-0">
              <span className="block truncate text-lg font-extrabold uppercase leading-tight tracking-wide text-brand desk:whitespace-nowrap desk:max-xl:hidden">{site.name}</span>
              <span className="block truncate text-[10px] leading-snug text-slate-500 desk:max-2xl:hidden">1st Advanced tech Driven futsal In nepal</span>
            </span>
          </Link>
          <DeskNav />
          <HeaderToggles />
          <NotificationBell />
        </div>
        <div className="empty:hidden pb-2"><AdStrip placement="header" /></div>
      </div>
    </div>
  );
}
