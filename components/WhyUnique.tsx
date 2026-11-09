import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FACILITIES } from "@/components/Facilities";

// Home, desktop only: "What makes us unique", the same list as What Makes Us Unique in the footer, one per row. It sits in the sidebar
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

      <ul className="mt-4 flex flex-1 flex-col overflow-hidden rounded-3xl border border-[#d6e4fb] bg-[#f5f9ff] shadow-[0_8px_24px_rgba(37,99,235,0.08)]">
        {FACILITIES.map(({ title, icon: Icon }) => (
          <li key={title} className="flex flex-1 items-center gap-3 border-b border-[#e3ecfa] px-4 py-2.5 last:border-b-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[#0c0b5d]"><Icon size={18} strokeWidth={1.9} aria-hidden /></span>
            <span className="min-w-0 text-sm font-semibold leading-tight text-[#0c0b5d]">{title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
