import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FACILITIES } from "@/components/Facilities";

// Home, desktop only: "What makes us unique", the same list as What Makes Us Unique in the footer, two per row (five rows). It sits in the sidebar
// column beside the Goal Rush card (see components/HomeScreen.tsx). Plain server markup, no images, so it adds nothing to load.
export default function WhyUnique({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="why-unique-heading" className={className}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="why-unique-heading" className="text-lg font-bold desk:text-xl">What makes us unique</h2>
          <p className="text-sm font-semibold text-slate-500">More than a game</p>
        </div>
        <Link href="/about" className="flex items-center text-sm font-semibold text-brand">
          About <ChevronRight size={16} />
        </Link>
      </div>

      <ul className="mt-4 grid flex-1 auto-rows-fr grid-cols-2 overflow-hidden rounded-3xl border border-[#d6e4fb] bg-[#f5f9ff] shadow-[0_8px_24px_rgba(37,99,235,0.08)] [&>li:nth-child(odd)]:border-r [&>li:nth-last-child(-n+2)]:border-b-0">
        {FACILITIES.map(({ title, icon: Icon }) => (
          <li key={title} className="flex items-center gap-2.5 border-b border-[#e3ecfa] px-3 py-2.5 [&:nth-child(odd)]:border-r-[#e3ecfa]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[#0c0b5d]"><Icon size={18} strokeWidth={1.9} aria-hidden /></span>
            <span className="min-w-0 text-[13px] font-semibold leading-tight text-[#0c0b5d]">{title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
